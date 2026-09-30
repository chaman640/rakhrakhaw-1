import { Router } from 'express';
import { z } from 'zod';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { requireFeature } from '../middleware/feature.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { QUOTE_STATUS } from '../models/Quotation.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as svc from '../services/quotation.service.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller, requireFeature('sales_pro'));

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const idP = z.object({ id: oid });
const line = z.object({
  itemId: oid,
  qty: z.coerce.number().positive().max(1e7),
  rate: z.coerce.number().min(0).max(1e8).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional().default(0),
});
const text = (n) => z.string().trim().max(n).optional();
const body = z.object({
  partyId: oid.nullable().optional(),
  leadId: oid.nullable().optional(),
  items: z.array(line).min(1).max(300),
  validUntil: z.coerce.date().nullable().optional(),
  notes: text(2000), terms: text(2000), deliveryTerms: text(300), paymentTerms: text(300),
});
const h = (fn, msg) => asyncHandler(async (req, res) => ok(res, await fn(req), msg));

router.get('/', requirePermission('orders:view'), validate({
  query: z.object({
    status: z.enum(['', 'open', ...QUOTE_STATUS]).optional().default(''),
    q: z.string().trim().max(60).optional().default(''),
    partyId: z.string().trim().max(24).optional().default(''),
    page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  }),
}), asyncHandler(async (req, res) => {
  const { rows, meta } = await svc.listQuotations(req.businessId, req.user, req.query);
  res.json({ success: true, message: 'OK', data: rows, meta });
}));
router.post('/', requirePermission('orders:create'), validate({ body }),
  asyncHandler(async (req, res) => created(res, await svc.createQuotation(req.businessId, req.user, req.body), 'Quotation created')));
router.get('/:id', requirePermission('orders:view'), validate({ params: idP }), h((req) => svc.getQuotation(req.businessId, req.user, req.params.id)));
router.put('/:id', requirePermission('orders:edit'), validate({ params: idP, body: body.omit({ partyId: true, leadId: true }).partial() }),
  h((req) => svc.updateQuotation(req.businessId, req.user, req.params.id, req.body), 'Quotation saved'));
router.post('/:id/status', requirePermission('orders:edit'), validate({
  params: idP, body: z.object({ status: z.enum(['sent', 'accepted', 'rejected']), reason: text(300) }),
}), h((req) => svc.setQuotationStatus(req.businessId, req.user, req.params.id, req.body), 'Quotation updated'));
router.post('/:id/revise', requirePermission('orders:create'), validate({ params: idP }),
  h((req) => svc.reviseQuotation(req.businessId, req.user, req.params.id), 'New revision created'));
router.post('/:id/convert', requirePermission('orders:create'), validate({
  params: idP, body: z.object({ expectedDeliveryAt: z.coerce.date().nullable().optional(), paymentMode: z.enum(['UDHAAR', 'CASH', 'UPI']).optional() }),
}), h((req) => svc.convertToOrder(req.businessId, req.user, req.params.id, req.body), 'Order created from quotation'));
router.delete('/:id', requirePermission('orders:delete'), validate({ params: idP }), h((req) => svc.deleteQuotation(req.businessId, req.user, req.params.id), 'Quotation deleted'));

export default router;

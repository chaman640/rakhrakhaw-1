import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/order.controller.js';
import { z } from 'zod';
import { requireFeature } from '../middleware/feature.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { createSellerOrder, updateDispatch } from '../services/order.service.js';
import {
  listOrdersQuerySchema, statusSchema, markPaidSchema, cancelSchema, updateItemsSchema, idParamSchema,
} from '../validators/order.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

router.get('/stats', requirePermission('orders:view'), ctrl.stats);

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
router.post('/', requirePermission('orders:create'), requireFeature('sales_pro'), validate({
  body: z.object({
    partyId: oid,
    items: z.array(z.object({ itemId: oid, qty: z.coerce.number().positive().max(1e7), rate: z.coerce.number().min(0).max(1e8).optional() })).min(1).max(300),
    note: z.string().trim().max(500).optional().default(''),
    paymentMode: z.enum(['UDHAAR', 'CASH', 'UPI']).optional(),
    expectedDeliveryAt: z.coerce.date().nullable().optional(),
  }),
}), asyncHandler(async (req, res) => created(res, await createSellerOrder(req.businessId, req.body, req.user._id, req.user), 'Order booked')));
router.put('/:id/dispatch', requirePermission('orders:edit'), requireFeature('sales_pro'), validate({
  params: idParamSchema,
  body: z.object({
    vehicleNo: z.string().trim().max(20).optional(),
    transporter: z.string().trim().max(80).optional(),
    lrNo: z.string().trim().max(40).optional(),
    driverName: z.string().trim().max(60).optional(),
    driverPhone: z.string().trim().max(15).optional(),
    packages: z.coerce.number().int().min(0).max(100000).optional(),
    note: z.string().trim().max(300).optional(),
    deliveredTo: z.string().trim().max(80).optional(),
    expectedDeliveryAt: z.coerce.date().nullable().optional(),
  }),
}), asyncHandler(async (req, res) => ok(res, await updateDispatch(req.businessId, req.params.id, req.body, req.user._id, req.user), 'Dispatch details saved')));
router.get('/', requirePermission('orders:view'), validate({ query: listOrdersQuerySchema }), ctrl.list);
router.get('/:id', requirePermission('orders:view'), validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/status', requirePermission('orders:edit'), validate({ params: idParamSchema, body: statusSchema }), ctrl.setStatus);
/*
  Ijazat `khata:create` hai, `orders:edit` nahi — kyunki ye kaam sach me khate
  ka hai. Jo salesman order pack kar sakta hai, wo apne aap paisa khate me
  chadha na de.
*/
router.post('/:id/payment', requirePermission('khata:create'), validate({ params: idParamSchema, body: markPaidSchema }), ctrl.markPaid);
router.post('/:id/cancel', requirePermission('orders:delete'), validate({ params: idParamSchema, body: cancelSchema }), ctrl.cancel);
router.put('/:id/items', requirePermission('orders:edit'), validate({ params: idParamSchema, body: updateItemsSchema }), ctrl.updateItems);

export default router;

import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/invoice.controller.js';
import {
  createInvoiceSchema, listInvoicesQuerySchema, cancelInvoiceSchema,
  idParamSchema, orderIdParamSchema,
} from '../validators/invoice.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/stats', requirePermission('invoices:view'), ctrl.stats);
router.get('/next-number', requirePermission('invoices:view'), ctrl.nextNumber);
router.get('/from-order/:orderId', requirePermission('invoices:view'), validate({ params: orderIdParamSchema }), ctrl.prefill);

router.get('/', requirePermission('invoices:view'), validate({ query: listInvoicesQuerySchema }), ctrl.list);
router.post('/', requirePermission('invoices:create'), validate({ body: createInvoiceSchema }), ctrl.create);

router.get('/:id', requirePermission('invoices:view'), validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/cancel', requirePermission('invoices:delete'), validate({ params: idParamSchema, body: cancelInvoiceSchema }), ctrl.cancel);

export default router;

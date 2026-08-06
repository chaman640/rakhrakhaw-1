import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
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

router.get('/stats', ctrl.stats);
router.get('/next-number', ctrl.nextNumber);
router.get('/from-order/:orderId', validate({ params: orderIdParamSchema }), ctrl.prefill);

router.get('/', validate({ query: listInvoicesQuerySchema }), ctrl.list);
router.post('/', validate({ body: createInvoiceSchema }), ctrl.create);

router.get('/:id', validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/cancel', validate({ params: idParamSchema, body: cancelInvoiceSchema }), ctrl.cancel);

export default router;

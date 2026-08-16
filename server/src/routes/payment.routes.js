import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/payment.controller.js';
import {
  createPaymentSchema, listPaymentsQuerySchema, rejectSchema, idParamSchema,
} from '../validators/payment.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/stats', requirePermission('khata:view'), ctrl.stats);

router.get('/', requirePermission('khata:view'), validate({ query: listPaymentsQuerySchema }), ctrl.list);
router.post('/', requirePermission('khata:create'), validate({ body: createPaymentSchema }), ctrl.create);

router.get('/:id', requirePermission('khata:view'), validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/confirm', requirePermission('khata:approve'), validate({ params: idParamSchema }), ctrl.confirm);
router.post('/:id/reject', requirePermission('khata:approve'), validate({ params: idParamSchema, body: rejectSchema }), ctrl.reject);
router.delete('/:id', requirePermission('khata:delete'), validate({ params: idParamSchema }), ctrl.remove);

export default router;

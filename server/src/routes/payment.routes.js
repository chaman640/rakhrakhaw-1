import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
import * as ctrl from '../controllers/payment.controller.js';
import {
  createPaymentSchema, listPaymentsQuerySchema, rejectSchema, idParamSchema,
} from '../validators/payment.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePermission(PERMISSIONS.KHATA));

router.get('/stats', ctrl.stats);

router.get('/', validate({ query: listPaymentsQuerySchema }), ctrl.list);
router.post('/', validate({ body: createPaymentSchema }), ctrl.create);

router.get('/:id', validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/confirm', validate({ params: idParamSchema }), ctrl.confirm);
router.post('/:id/reject', validate({ params: idParamSchema, body: rejectSchema }), ctrl.reject);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

export default router;

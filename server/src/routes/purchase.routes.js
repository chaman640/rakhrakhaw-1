import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/purchase.controller.js';
import {
  createPurchaseSchema, listPurchasesQuerySchema, idParamSchema,
} from '../validators/purchase.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

router.get('/stats', requirePermission('purchases:view'), ctrl.stats);
router.get('/next-number', requirePermission('purchases:view'), ctrl.nextNumber);

router.get('/', requirePermission('purchases:view'), validate({ query: listPurchasesQuerySchema }), ctrl.list);
router.post('/', requirePermission('purchases:create'), validate({ body: createPurchaseSchema }), ctrl.create);

router.get('/:id', requirePermission('purchases:view'), validate({ params: idParamSchema }), ctrl.detail);
router.delete('/:id', requirePermission('purchases:delete'), validate({ params: idParamSchema }), ctrl.remove);

export default router;

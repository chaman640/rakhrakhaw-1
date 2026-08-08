import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
import * as ctrl from '../controllers/purchase.controller.js';
import {
  createPurchaseSchema, listPurchasesQuerySchema, idParamSchema,
} from '../validators/purchase.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePermission(PERMISSIONS.PURCHASES));

router.get('/stats', ctrl.stats);
router.get('/next-number', ctrl.nextNumber);

router.get('/', validate({ query: listPurchasesQuerySchema }), ctrl.list);
router.post('/', validate({ body: createPurchaseSchema }), ctrl.create);

router.get('/:id', validate({ params: idParamSchema }), ctrl.detail);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

export default router;

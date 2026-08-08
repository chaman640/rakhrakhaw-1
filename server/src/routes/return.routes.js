import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
import * as ctrl from '../controllers/return.controller.js';
import {
  createReturnSchema, listReturnsQuerySchema, prefillParamSchema, idParamSchema,
} from '../validators/return.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePermission(PERMISSIONS.RETURNS));

router.get('/stats', ctrl.stats);
router.get('/prefill/:type/:docId', validate({ params: prefillParamSchema }), ctrl.prefill);

router.get('/', validate({ query: listReturnsQuerySchema }), ctrl.list);
router.post('/', validate({ body: createReturnSchema }), ctrl.create);

router.get('/:id', validate({ params: idParamSchema }), ctrl.detail);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

export default router;

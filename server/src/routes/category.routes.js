import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
import * as ctrl from '../controllers/category.controller.js';
import {
  createCategorySchema, updateCategorySchema, idParamSchema,
} from '../validators/category.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePermission(PERMISSIONS.ITEMS));

router.get('/', ctrl.list);
router.post('/', validate({ body: createCategorySchema }), ctrl.create);
router.put('/:id', validate({ params: idParamSchema, body: updateCategorySchema }), ctrl.update);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

export default router;

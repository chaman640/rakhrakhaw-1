import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/category.controller.js';
import {
  createCategorySchema, updateCategorySchema, idParamSchema,
} from '../validators/category.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

router.get('/', requirePermission('items:view'), ctrl.list);
router.post('/', requirePermission('items:create'), validate({ body: createCategorySchema }), ctrl.create);
router.put('/:id', requirePermission('items:edit'), validate({ params: idParamSchema, body: updateCategorySchema }), ctrl.update);
router.delete('/:id', requirePermission('items:delete'), validate({ params: idParamSchema }), ctrl.remove);

export default router;

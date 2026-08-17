import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/expense.controller.js';
import {
  createExpenseSchema, updateExpenseSchema, listExpensesQuerySchema, idParamSchema,
} from '../validators/expense.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

// Ye dono "/:id" se PEHLE — warna "stats" aur "categories" ko id samajh liya jayega
router.get('/stats', requirePermission('expenses:view'), ctrl.stats);
router.get('/categories', requirePermission('expenses:view'), ctrl.categories);

router.get('/', requirePermission('expenses:view'), validate({ query: listExpensesQuerySchema }), ctrl.list);
router.post('/', requirePermission('expenses:create'), validate({ body: createExpenseSchema }), ctrl.create);

router.get('/:id', requirePermission('expenses:view'), validate({ params: idParamSchema }), ctrl.detail);
router.put('/:id', requirePermission('expenses:edit'), validate({ params: idParamSchema, body: updateExpenseSchema }), ctrl.update);
router.delete('/:id', requirePermission('expenses:delete'), validate({ params: idParamSchema }), ctrl.remove);

export default router;

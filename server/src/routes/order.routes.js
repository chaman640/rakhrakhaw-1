import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/order.controller.js';
import {
  listOrdersQuerySchema, statusSchema, markPaidSchema, cancelSchema, updateItemsSchema, idParamSchema,
} from '../validators/order.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/stats', requirePermission('orders:view'), ctrl.stats);
router.get('/', requirePermission('orders:view'), validate({ query: listOrdersQuerySchema }), ctrl.list);
router.get('/:id', requirePermission('orders:view'), validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/status', requirePermission('orders:edit'), validate({ params: idParamSchema, body: statusSchema }), ctrl.setStatus);
/*
  Ijazat `khata:create` hai, `orders:edit` nahi — kyunki ye kaam sach me khate
  ka hai. Jo salesman order pack kar sakta hai, wo apne aap paisa khate me
  chadha na de.
*/
router.post('/:id/payment', requirePermission('khata:create'), validate({ params: idParamSchema, body: markPaidSchema }), ctrl.markPaid);
router.post('/:id/cancel', requirePermission('orders:delete'), validate({ params: idParamSchema, body: cancelSchema }), ctrl.cancel);
router.put('/:id/items', requirePermission('orders:edit'), validate({ params: idParamSchema, body: updateItemsSchema }), ctrl.updateItems);

export default router;

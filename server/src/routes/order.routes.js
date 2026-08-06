import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/order.controller.js';
import {
  listOrdersQuerySchema, statusSchema, cancelSchema, updateItemsSchema, idParamSchema,
} from '../validators/order.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/stats', ctrl.stats);
router.get('/', validate({ query: listOrdersQuerySchema }), ctrl.list);
router.get('/:id', validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/status', validate({ params: idParamSchema, body: statusSchema }), ctrl.setStatus);
router.post('/:id/cancel', validate({ params: idParamSchema, body: cancelSchema }), ctrl.cancel);
router.put('/:id/items', validate({ params: idParamSchema, body: updateItemsSchema }), ctrl.updateItems);

export default router;

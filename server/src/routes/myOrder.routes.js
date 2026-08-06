import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { withTenant, requireActiveParty } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/catalog.controller.js';
import { placeOrderSchema, idParamSchema, myOrdersQuerySchema } from '../validators/catalog.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.RETAILER), withTenant, requireActiveParty);

router.get('/summary', ctrl.myOrderSummary);
router.get('/', validate({ query: myOrdersQuerySchema }), ctrl.myOrders);
router.post('/', validate({ body: placeOrderSchema }), ctrl.placeOrder);
router.get('/:id', validate({ params: idParamSchema }), ctrl.myOrderDetail);
router.post('/:id/cancel', validate({ params: idParamSchema }), ctrl.cancelOrder);

export default router;

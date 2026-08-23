import { Router } from 'express';
import { protect, requireBuyer } from '../middleware/auth.js';
import { withBuyerTenant, requireActiveParty } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/catalog.controller.js';
import { placeOrderSchema, idParamSchema, myOrdersQuerySchema } from '../validators/catalog.validator.js';

const router = Router();
router.use(protect, requireBuyer, withBuyerTenant, requireActiveParty);

router.get('/summary', ctrl.myOrderSummary);
router.get('/', validate({ query: myOrdersQuerySchema }), ctrl.myOrders);
router.post('/', validate({ body: placeOrderSchema }), ctrl.placeOrder);
router.get('/:id', validate({ params: idParamSchema }), ctrl.myOrderDetail);
router.post('/:id/cancel', validate({ params: idParamSchema }), ctrl.cancelOrder);

export default router;

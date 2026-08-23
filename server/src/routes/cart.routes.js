import { Router } from 'express';
import { protect, requireBuyer } from '../middleware/auth.js';
import { withBuyerTenant, requireActiveParty } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/catalog.controller.js';
import { cartItemSchema, cartQtySchema, itemIdParamSchema } from '../validators/catalog.validator.js';

const router = Router();
router.use(protect, requireBuyer, withBuyerTenant, requireActiveParty);

router.get('/', ctrl.getCart);
router.get('/count', ctrl.cartCount);
router.post('/items', validate({ body: cartItemSchema }), ctrl.addToCart);
router.put('/items/:itemId', validate({ params: itemIdParamSchema, body: cartQtySchema }), ctrl.setQty);
router.delete('/items/:itemId', validate({ params: itemIdParamSchema }), ctrl.removeItem);
router.put('/note', ctrl.setNote);
router.delete('/', ctrl.clear);

export default router;

import { Router } from 'express';
import { protect, requireBuyer } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/buy.controller.js';
import { checkoutSchema } from '../validators/buy.validator.js';

/**
 * KAI DUKAANEIN EK SAATH.
 *
 * `/cart` (purana wala) ek waqt me EK dukaan ka cart sambhalta hai — usme daalo,
 * quantity badlo, hatao. Wo waisa hi rehta hai, aur `X-Shop-Id` se tay hota hai
 * ki kis dukaan ka.
 *
 * Ye router us se ooper ka kaam karta hai: SAB dukaanon ko ek saath dekhna aur
 * ek saath bhejna. Isliye yahan `withBuyerTenant` laga hi nahi hai — uska poora
 * kaam "ek dukaan chuno" hai, aur yahan chunne ko kuch hai hi nahi. Har route
 * khud saari Membership uthata hai.
 */
const router = Router();
router.use(protect, requireBuyer);

router.get('/cart', ctrl.groupedCart);
router.get('/cart/count', ctrl.cartCount);
router.post('/checkout', validate({ body: checkoutSchema }), ctrl.checkout);

export default router;

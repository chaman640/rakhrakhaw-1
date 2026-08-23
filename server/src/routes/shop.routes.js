import { Router } from 'express';
import { protect, requireBuyer } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/shop.controller.js';
import {
  shopLookupQuerySchema, shopConnectSchema, shopIdParamSchema, savedShopsQuerySchema,
} from '../validators/shop.validator.js';

/**
 * DUKAAN KHOJNA AUR JUDNA.
 *
 * Yahan `withBuyerTenant` JAAN-BOOJH KAR nahi lagta. Wo middleware poochta hai
 * "kis dukaan me ho?" — aur yahi wo jagah hai jahan uska jawab abhi bana hi
 * nahi hai. Isliye in raston pe sirf login aur "khareedne ka haq" ka pehra hai;
 * har route khud apni Membership dhoondhta hai.
 */
const router = Router();
router.use(protect, requireBuyer);

router.get('/saved', validate({ query: savedShopsQuerySchema }), ctrl.saved);
router.get('/lookup', validate({ query: shopLookupQuerySchema }), ctrl.lookup);
router.post('/connect', validate({ body: shopConnectSchema }), ctrl.connect);

router.get('/:id', validate({ params: shopIdParamSchema }), ctrl.detail);
router.post('/:id/save', validate({ params: shopIdParamSchema }), ctrl.save);
router.delete('/:id/save', validate({ params: shopIdParamSchema }), ctrl.unsave);
router.post('/:id/touch', validate({ params: shopIdParamSchema }), ctrl.touch);

export default router;

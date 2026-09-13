import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/tutorial.controller.js';
import { tutorialKeyParamSchema } from '../validators/tutorial.validator.js';

/**
 * Ye sirf PADHNE ke liye hai — koi bhi logged-in aadmi (dukaandaar, staff,
 * retailer) apna video dekh sake. LIKHNA sirf platform admin ka kaam hai,
 * wo `partner.routes.js` ke andar `/partner/admin/tutorials` pe hai —
 * jaan-boojh kar alag rakha, kyunki wahan bilkul alag pehra (`requirePartnerAdmin`)
 * lagta hai, dukaan wale token se nahi khulta.
 */
const router = Router();
router.use(protect);

router.get('/', ctrl.list);
router.get('/onboarding-tour', ctrl.onboardingTour);
router.get('/:key', validate({ params: tutorialKeyParamSchema }), ctrl.one);

export default router;

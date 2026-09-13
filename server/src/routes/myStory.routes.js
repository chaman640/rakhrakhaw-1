import { Router } from 'express';
import { z } from 'zod';
import { protect, requireBuyer } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/story.controller.js';
import { storyIdParamSchema } from '../validators/story.validator.js';

const businessIdParamSchema = z.object({
  businessId: z.string().regex(/^[a-f\d]{24}$/i, 'Galat id'),
});

/**
 * Ye jaan-boojh kar sirf ek business ki stories ke liye hai (route param se),
 * "abhi chuni hui dukaan" (X-Shop-Id) se nahi — retailer search list se seedha
 * kisi bhi judi hui dukaan ki story khol sakta hai, use pehle us dukaan ko
 * "active" banane ki zarurat nahi. Ijazat `story.service.js` ke andar hi
 * Membership dekh kar check hoti hai.
 */
const router = Router();
router.use(protect, requireBuyer);

router.get('/:businessId', validate({ params: businessIdParamSchema }), ctrl.viewStories);
router.post('/view/:id', validate({ params: storyIdParamSchema }), ctrl.markViewed);

export default router;

import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { ROLES } from '../config/constants.js';
import { validate } from '../middleware/validate.js';
import { checkoutSchema, verifySchema } from '../validators/billing.validator.js';
import * as ctrl from '../controllers/billing.controller.js';

const router = Router();

/*
  ─────────────────────────── YAHAN `requirePaidSeller` NAHI HAI ───────────────────────────

  Aur wahi is file ki sabse zaroori baat hai.

  Jiska plan khatam ho gaya hai, use ANDAR aakar plan lena hai. Usi aadmi ko
  billing ke raste se bahar rok dena wo bug hai jisme system khud ko hi band
  kar leta hai — aur wo bug tab pakda jata hai jab pehla graahak paisa dene
  ki koshish karta hai aur nahi kar paata.
*/

// Daam ki list — bina login ke (wajah controller me)
router.get('/plans', ctrl.plans);

/*
  Webhook — `protect` ke BAHAR, aur ye zaroori hai: Razorpay ke paas hamara
  token hota hi nahi. Pehchan signature se hoti hai.

  Body RAW chahiye (app.js me isi ek rraste ke liye alag parser laga hai) —
  parse ho jane par HMAC kabhi match nahi karega.
*/
router.post('/webhook', ctrl.webhook);

router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/me', ctrl.mine);
router.get('/history', ctrl.history);
router.post('/checkout', requirePermission('settings:edit'), validate({ body: checkoutSchema }), ctrl.checkout);
router.post('/verify', requirePermission('settings:edit'), validate({ body: verifySchema }), ctrl.verify);
router.post('/cancel', requirePermission('settings:edit'), ctrl.cancel);

export default router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { requireSalesman, requirePartnerAdmin } from '../middleware/partnerAuth.js';
import {
  partnerSignupSchema, partnerLoginSchema, partnerPasswordSchema, payoutSchema,
  adminLoginSchema, adminPasswordSchema, markPaidSchema, toggleSchema,
} from '../validators/partner.validator.js';
import * as ctrl from '../controllers/partner.controller.js';

const router = Router();

/*
  ─────────────────────── LOGIN PE KADI ROK ───────────────────────

  Yahan OTP nahi hai — sirf number aur password. Iska matlab hai ki koi ek hi
  number pe hazaron password aajma sakta hai, aur ye system PAISE se juda hai.

  Isliye login aur signup pe alag, kadi rok hai. Aam user ise kabhi nahi
  chhuega (kaun 15 minute me 10 baar login karta hai), par mashin se hone wali
  koshish yahin ruk jati hai.

  Admin ki rok aur bhi kadi hai — wahan ek hi email hai, yaani hamla karne
  wale ko sirf password dhoondhna hai.
*/
const loginRok = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bahut baar koshish ho chuki — 15 minute baad dobara try karein' },
});

const adminRok = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bahut baar koshish ho chuki — 15 minute baad dobara try karein' },
});

/* ────────────────────────── bina login ke ────────────────────────── */

router.post('/signup', loginRok, validate({ body: partnerSignupSchema }), ctrl.signup);
router.post('/login', loginRok, validate({ body: partnerLoginSchema }), ctrl.login);

// Link kholne wale ko dikhane ke liye — "X ne aapko bulaya hai"
router.get('/ref/:code', ctrl.refInfo);

/* ────────────────────────── salesman ────────────────────────── */

router.get('/me', requireSalesman, ctrl.dashboard);
router.post('/password', requireSalesman, validate({ body: partnerPasswordSchema }), ctrl.changePassword);
router.post('/payout', requireSalesman, validate({ body: payoutSchema }), ctrl.setPayout);

/* ────────────────────────── admin ────────────────────────── */

router.post('/admin/login', adminRok, validate({ body: adminLoginSchema }), ctrl.adminLogin);
router.get('/admin/list', requirePartnerAdmin, ctrl.adminList);
router.get('/admin/one/:id', requirePartnerAdmin, ctrl.adminOne);
router.post('/admin/paid/:id', requirePartnerAdmin, validate({ body: markPaidSchema }), ctrl.adminMarkPaid);
router.post('/admin/toggle/:id', requirePartnerAdmin, validate({ body: toggleSchema }), ctrl.adminToggle);
router.post('/admin/password', requirePartnerAdmin, validate({ body: adminPasswordSchema }), ctrl.adminChangePassword);

export default router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { requireSalesman, requirePartnerAdmin, requireAdminPerm } from '../middleware/partnerAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as adminAuth from '../services/adminAuth.service.js';
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
  limit: Number(process.env.ADMIN_LOGIN_LIMIT || 10),
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

const ctxOf = (req) => ({ ip: req.ip });
const code = z.string().trim().min(6).max(12);
router.post('/admin/login', adminRok, validate({ body: adminLoginSchema }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.login(req.body, ctxOf(req)))));
router.post('/admin/login/2fa', adminRok, validate({ body: z.object({ challenge: z.string().min(10).max(1000), code }) }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.loginSecondStep(req.body, ctxOf(req)))));
router.get('/admin/me', requirePartnerAdmin, asyncHandler(async (req, res) => ok(res, await adminAuth.me(req.adminId))));
router.post('/admin/logout', requirePartnerAdmin, validate({ body: z.object({ everywhere: z.boolean().optional().default(false) }) }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.logout(req.adminId, req.body, ctxOf(req)), 'Signed out')));
router.post('/admin/password', requirePartnerAdmin, validate({ body: adminPasswordSchema }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.changePassword(req.adminId, req.body, ctxOf(req)), 'Password changed')));
router.post('/admin/2fa/start', requirePartnerAdmin, asyncHandler(async (req, res) => ok(res, await adminAuth.start2fa(req.adminId))));
router.post('/admin/2fa/confirm', requirePartnerAdmin, validate({ body: z.object({ code }) }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.confirm2fa(req.adminId, req.body, ctxOf(req)), 'Two-step verification is on')));
router.post('/admin/2fa/disable', requirePartnerAdmin, validate({ body: z.object({ password: z.string().min(1).max(100), code }) }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.disable2fa(req.adminId, req.body, ctxOf(req)), 'Two-step verification is off')));

const manageAdmins = [requirePartnerAdmin, requireAdminPerm('admins:manage')];
const adminBody = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.enum(['super', 'admin', 'support', 'content', 'finance']),
  require2fa: z.boolean().optional(),
  active: z.boolean().optional(),
});
router.get('/admin/admins', ...manageAdmins, asyncHandler(async (req, res) => ok(res, await adminAuth.listAdmins())));
router.post('/admin/admins', ...manageAdmins, validate({ body: adminBody.extend({ email: z.string().trim().email().max(120), password: z.string().min(1).max(100) }) }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.createAdmin(req.adminId, req.body, ctxOf(req)), 'Admin added')));
router.put('/admin/admins/:id', ...manageAdmins, validate({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }), body: adminBody.partial() }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.updateAdmin(req.adminId, req.params.id, req.body, ctxOf(req)), 'Admin updated')));
router.post('/admin/admins/:id/reset', ...manageAdmins, validate({ params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }), body: z.object({ password: z.string().max(100).optional(), reset2fa: z.boolean().optional() }) }),
  asyncHandler(async (req, res) => ok(res, await adminAuth.resetAdmin(req.adminId, req.params.id, req.body, ctxOf(req)), 'Admin reset')));

const partners = [requirePartnerAdmin, requireAdminPerm('partners:manage')];
router.get('/admin/list', ...partners, ctrl.adminList);
router.get('/admin/one/:id', ...partners, ctrl.adminOne);
router.post('/admin/paid/:id', ...partners, validate({ body: markPaidSchema }), ctrl.adminMarkPaid);
router.post('/admin/toggle/:id', ...partners, validate({ body: toggleSchema }), ctrl.adminToggle);

export default router;

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { saveShortcuts } from '../services/auth.service.js';
import * as ctrl from '../controllers/auth.controller.js';
import {
  wholesalerSignupSchema, loginSchema, retailerSignupSchema,
  changePasswordSchema, inviteCodeParamSchema, updateProfileSchema,
  sendOtpSchema, verifyOtpSchema, resetPasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

/*
  OTP — signup aur "password bhool gaye", dono ke liye.

  Ye teeno raste bina login ke khulte hain (khulne hi chahiye — jo login nahi
  kar pa raha wahi to yahan aata hai). Rok yahan role se nahi lagti, balki OTP
  ki apni hadd se: ek minute me ek SMS, ghante me paanch, aur paanch galat
  koshish ke baad code mar jata hai (otp.service.js me poora kanoon).
*/
router.post('/otp/send', validate({ body: sendOtpSchema }), ctrl.sendOtp);
router.post('/otp/verify', validate({ body: verifyOtpSchema }), ctrl.verifyOtp);
router.post('/reset-password', validate({ body: resetPasswordSchema }), ctrl.resetPassword);

// Public
router.post('/wholesaler/signup', validate({ body: wholesalerSignupSchema }), ctrl.signupWholesaler);
router.post('/login', validate({ body: loginSchema }), ctrl.login);
router.get('/invite/:code', validate({ params: inviteCodeParamSchema }), ctrl.inviteInfo);
router.post('/retailer/signup', validate({ body: retailerSignupSchema }), ctrl.signupRetailer);

// Logged in
router.get('/me', protect, ctrl.me);
router.put('/profile', protect, validate({ body: updateProfileSchema }), ctrl.updateProfile);
router.post('/change-password', protect, validate({ body: changePasswordSchema }), ctrl.changePassword);
router.post('/logout', protect, ctrl.logout);
router.put('/shortcuts', protect, validate({ body: z.object({ shortcuts: z.array(z.string().trim().regex(/^[a-z_]{2,30}$/)).max(12) }) }),
  asyncHandler(async (req, res) => ok(res, await saveShortcuts(req.user._id, req.body.shortcuts), 'Shortcuts saved')));

export default router;

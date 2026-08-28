import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as authService from '../services/auth.service.js';
import * as otpService from '../services/otp.service.js';

export const signupWholesaler = asyncHandler(async (req, res) => {
  const result = await authService.signupWholesaler(req.body);
  return created(res, result, 'Account ban gaya');
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ok(res, result, 'Login ho gaya');
});

export const inviteInfo = asyncHandler(async (req, res) => {
  const result = await authService.getInviteInfo(req.params.code);
  return ok(res, result);
});

export const signupRetailer = asyncHandler(async (req, res) => {
  const result = await authService.signupRetailer(req.body);
  return created(res, result, 'Account ban gaya');
});

export const me = asyncHandler(async (req, res) => {
  const result = await authService.buildSession(req.user);
  return ok(res, result);
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body);
  return ok(res, null, 'Password badal gaya');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const result = await authService.updateProfile(req.user, req.body);
  return ok(res, result, 'Profile save ho gaya');
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  return ok(res, null, 'Logout ho gaya');
});

/* ─────────────────────────── OTP ─────────────────────────── */

export const sendOtp = asyncHandler(async (req, res) => {
  const result = await otpService.sendOtp(req.body);
  return ok(res, result, `OTP bhej diya — ${result.phone} pe dekh lijiye`);
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const result = await otpService.verifyOtp(req.body);
  return ok(res, result, 'Number verify ho gaya');
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  return ok(res, result, 'Naya password lag gaya — ab login karein');
});

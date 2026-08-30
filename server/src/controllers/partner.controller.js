import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as svc from '../services/partner.service.js';
import * as admin from '../services/partnerAdmin.service.js';

/* ── salesman ── */

export const signup = asyncHandler(async (req, res) =>
  created(res, await svc.partnerSignup(req.body), 'Account ban gaya'));

export const login = asyncHandler(async (req, res) =>
  ok(res, await svc.partnerLogin(req.body), 'Login ho gaya'));

export const dashboard = asyncHandler(async (req, res) =>
  ok(res, await svc.partnerDashboard(req.salesman._id)));

export const changePassword = asyncHandler(async (req, res) =>
  ok(res, await svc.changePartnerPassword(req.salesman._id, req.body), 'Password badal gaya'));

export const setPayout = asyncHandler(async (req, res) =>
  ok(res, await svc.updatePayout(req.salesman._id, req.body.payout), 'Save ho gaya'));

/** Link kholne wale ko dikhane ke liye — kiska link hai */
export const refInfo = asyncHandler(async (req, res) =>
  ok(res, await svc.refInfo(req.params.code)));

/* ── admin ── */

export const adminLogin = asyncHandler(async (req, res) =>
  ok(res, await admin.adminLogin(req.body), 'Login ho gaya'));

export const adminList = asyncHandler(async (req, res) =>
  ok(res, await admin.adminList({ q: req.query.q })));

export const adminOne = asyncHandler(async (req, res) =>
  ok(res, await admin.adminOne(req.params.id)));

export const adminMarkPaid = asyncHandler(async (req, res) =>
  ok(res, await admin.adminMarkPaid(req.params.id, req.body), 'De diya — record me chadh gaya'));

export const adminToggle = asyncHandler(async (req, res) =>
  ok(res, await admin.adminToggle(req.params.id, req.body?.active), 'Ho gaya'));

export const adminChangePassword = asyncHandler(async (req, res) =>
  ok(res, await admin.adminChangePassword(req.adminId, req.body), 'Password badal gaya'));

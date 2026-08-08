import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/staff.service.js';

export const list = asyncHandler(async (req, res) =>
  ok(res, await service.listStaff(req.businessId)));

export const add = asyncHandler(async (req, res) => {
  const staff = await service.addStaff(req.businessId, req.body, req.user._id);
  return created(res, staff, `${staff.name} ka login ban gaya`);
});

export const update = asyncHandler(async (req, res) => {
  const staff = await service.updateStaff(req.businessId, req.params.id, req.body);
  return ok(res, staff, 'Save ho gaya');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.removeStaff(req.businessId, req.params.id, req.user._id);
  return ok(res, result, result.message);
});

/** Ye har logged-in user ke liye — apna hi password badalta hai */
export const changeMyPassword = asyncHandler(async (req, res) =>
  ok(res, await service.changeOwnPassword(req.user._id, req.body), 'Password badal gaya'));

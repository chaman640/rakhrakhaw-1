import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { PARTY_STATUS } from '../config/constants.js';
import { STATES } from '../config/states.js';
import * as businessService from '../services/business.service.js';

export const getMyBusiness = asyncHandler(async (req, res) => {
  // `req.user` dena zaroori hai — malik ko poora profile, staff ko sirf
  // wo hissa jo bill pe chhapta hai (dekho utils/businessView.js)
  const business = await businessService.getBusiness(req.businessId, req.user);
  return ok(res, business);
});

export const updateMyBusiness = asyncHandler(async (req, res) => {
  const business = await businessService.updateBusiness(req.businessId, req.body, req.user);
  return ok(res, business, 'Profile save ho gaya');
});

export const uploadLogo = asyncHandler(async (req, res) => {
  const result = await businessService.setLogo(req.businessId, req.file);
  return ok(res, result, 'Logo upload ho gaya');
});

export const deleteLogo = asyncHandler(async (req, res) => {
  const result = await businessService.removeLogo(req.businessId);
  return ok(res, result, 'Logo hata diya');
});

export const regenerateInvite = asyncHandler(async (req, res) => {
  const result = await businessService.regenerateInvite(req.businessId);
  return ok(res, result, 'Naya link ban gaya — purana ab kaam nahi karega');
});

export const listRetailers = asyncHandler(async (req, res) => {
  const result = await businessService.listRetailers(req.businessId, req.query.status, req.user);
  return ok(res, result);
});

export const approveRetailer = asyncHandler(async (req, res) => {
  const party = await businessService.setRetailerStatus(req.businessId, req.params.id, PARTY_STATUS.ACTIVE, req.user);
  return ok(res, party, `${party.name} ab order kar sakta hai`);
});

export const blockRetailer = asyncHandler(async (req, res) => {
  const party = await businessService.setRetailerStatus(req.businessId, req.params.id, PARTY_STATUS.BLOCKED, req.user);
  return ok(res, party, `${party.name} ko block kar diya`);
});

export const listStates = asyncHandler(async (req, res) => ok(res, STATES));

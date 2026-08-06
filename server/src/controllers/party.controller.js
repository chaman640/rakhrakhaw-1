import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/party.service.js';

export const list = asyncHandler(async (req, res) => {
  const { parties, meta } = await service.listParties(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: parties, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId, req.query.type || 'retailer')));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getParty(req.businessId, req.params.id)));

export const create = asyncHandler(async (req, res) =>
  created(res, await service.createParty(req.businessId, req.body, req.user._id), `${req.body.name} add ho gaya`));

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.updateParty(req.businessId, req.params.id, req.body), 'Save ho gaya'));

export const setStatus = asyncHandler(async (req, res) => {
  const party = await service.setStatus(req.businessId, req.params.id, req.body.status);
  const messages = {
    active: `${party.name} ab order kar sakta hai`,
    blocked: `${party.name} ko block kar diya`,
    pending: `${party.name} wapas pending me daal diya`,
  };
  return ok(res, party, messages[req.body.status]);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteParty(req.businessId, req.params.id);
  return ok(res, result, result.message);
});

export const listRates = asyncHandler(async (req, res) => {
  const { party, rows, customCount, meta } = await service.listRates(req.businessId, req.params.id, req.query);
  return res.json({ success: true, message: 'OK', data: { party, rows, customCount }, meta });
});

export const setRate = asyncHandler(async (req, res) => {
  const result = await service.setRate(req.businessId, req.params.id, req.params.itemId, req.body.rate);
  return ok(res, result, result.message);
});

export const bulkRates = asyncHandler(async (req, res) => {
  const result = await service.bulkSetRates(req.businessId, req.params.id, req.body);
  return ok(res, result, result.message);
});

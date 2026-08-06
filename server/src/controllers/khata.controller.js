import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/khata.service.js';

/* --------------------------------------------------------- wholesaler ka side */

export const list = asyncHandler(async (req, res) => {
  const { parties, meta } = await service.listKhata(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: parties, meta });
});

export const summary = asyncHandler(async (req, res) =>
  ok(res, await service.getKhataSummary(req.businessId)));

export const partyLedger = asyncHandler(async (req, res) =>
  ok(res, await service.getPartyLedger(req.businessId, req.params.partyId, req.query)));

/* ----------------------------------------------------------- retailer ka side */

export const myKhata = asyncHandler(async (req, res) =>
  ok(res, await service.getMyKhata(req.businessId, req.partyId, req.query)));

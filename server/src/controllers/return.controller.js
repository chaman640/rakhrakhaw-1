import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/return.service.js';
import { logAction } from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const { returns, meta } = await service.listReturns(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: returns, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId)));

export const prefill = asyncHandler(async (req, res) =>
  ok(res, await service.prefillFromDoc(req.businessId, req.params.type, req.params.docId)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getReturn(req.businessId, req.params.id)));

export const create = asyncHandler(async (req, res) => {
  const note = await service.createReturn(req.businessId, req.body, req.user._id);
  await logAction(req, {
    action: 'return.create',
    entityType: 'ReturnNote', entityId: note._id, entityLabel: note.returnNo,
    summary: `${note.returnNo} — ₹${note.grandTotal} (${note.type === 'SALE_RETURN' ? 'maal wapas aaya' : 'maal wapas bheja'})`,
  });
  return created(res, note, `${note.returnNo} ban gaya — stock aur khata dono update ho gaye`);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteReturn(req.businessId, req.params.id, req.user._id);
  await logAction(req, {
    action: 'return.delete',
    entityType: 'ReturnNote', entityId: req.params.id, entityLabel: result.returnNo || '',
    summary: `${result.returnNo || 'Return note'} mitaya`,
  });
  return ok(res, result, result.message);
});

/* --------------------------------------------------------- retailer side */

export const myList = asyncHandler(async (req, res) => {
  const { returns, meta } = await service.listMyReturns(req.businessId, req.partyId, req.query);
  return res.json({ success: true, message: 'OK', data: returns, meta });
});

export const myDetail = asyncHandler(async (req, res) =>
  ok(res, await service.getReturn(req.businessId, req.params.id, { partyId: req.partyId })));

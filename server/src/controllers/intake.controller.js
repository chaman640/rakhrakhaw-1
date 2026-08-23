import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as intake from '../services/intake.service.js';

export const list = asyncHandler(async (req, res) => {
  const { rows, meta } = await intake.listIntakes(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: rows, meta });
});

/** Menu ke badge ke liye — kitne bill ka maal abhi stock me daalna baaki hai */
export const count = asyncHandler(async (req, res) =>
  ok(res, await intake.pendingIntakeCount(req.businessId)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await intake.getIntake(req.businessId, req.params.id)));

/** "Ye mera kaunsa item hai?" — app ke apne andaze */
export const matches = asyncHandler(async (req, res) =>
  ok(res, await intake.matchesForLine(req.businessId, req.params.id, req.params.index)));

/** "Add karke aage" — ek line ka faisla */
export const decide = asyncHandler(async (req, res) => {
  const updated = await intake.decideLine(
    req.businessId, req.params.id, req.params.index, req.body, req.user._id,
  );
  return ok(res, updated, req.body.skip ? 'Ye item chhod diya' : 'Item add ho gaya');
});

/** Faisla badalna — peeche jane par */
export const reset = asyncHandler(async (req, res) =>
  ok(res, await intake.resetLine(req.businessId, req.params.id, req.params.index),
    'Dobara chun lijiye'));

/** Aakhri kadam — ab maal sach me stock me aata hai */
export const finish = asyncHandler(async (req, res) => {
  const result = await intake.finishIntake(req.businessId, req.params.id, req.body, req.user._id);
  return created(
    res, result,
    `Maal stock me aa gaya — purchase ${result.purchase.purchaseNo} ban gayi`,
  );
});

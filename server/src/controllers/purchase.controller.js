import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/purchase.service.js';
import { logAction } from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const { purchases, meta } = await service.listPurchases(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: purchases, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId)));

export const nextNumber = asyncHandler(async (req, res) =>
  ok(res, await service.nextNumber(req.businessId)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getPurchase(req.businessId, req.params.id)));

export const create = asyncHandler(async (req, res) => {
  const purchase = await service.createPurchase(req.businessId, req.body, req.user._id);
  await logAction(req, {
    action: 'purchase.create',
    entityType: 'Purchase', entityId: purchase._id, entityLabel: purchase.purchaseNo,
    summary: `${purchase.purchaseNo} — ₹${purchase.grandTotal} (${purchase.supplier?.name || 'supplier'})`,
  });
  return created(res, purchase, `${purchase.purchaseNo} save ho gayi — stock badh gaya`);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deletePurchase(req.businessId, req.params.id, req.user._id);
  await logAction(req, {
    action: 'purchase.delete',
    entityType: 'Purchase', entityId: req.params.id, entityLabel: result.purchaseNo || '',
    summary: `${result.purchaseNo || 'Purchase'} mitaya — stock wapas ghata`,
  });
  return ok(res, result, result.message);
});

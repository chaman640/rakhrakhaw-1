import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as shops from '../services/shop.service.js';

/** Search kholte hi jo dikhti hain — save ki hui dukaanein */
export const saved = asyncHandler(async (req, res) =>
  ok(res, await shops.listSavedShops(req.user, { all: req.query.all === '1' })));

/** Number daal kar khoj */
export const lookup = asyncHandler(async (req, res) =>
  ok(res, await shops.lookupShop(req.user, req.query.phone)));

/** Ek tap me jud jao — Party aur Membership dono ban jate hain */
export const connect = asyncHandler(async (req, res) => {
  const shop = await shops.connectShop(req.user, req.body);
  const message = shop.partyStatus === 'pending'
    ? `${shop.name} se jud gaye — ab unke approve karne ka intezaar hai`
    : `${shop.name} se jud gaye`;
  return created(res, shop, message);
});

/** Ek dukaan ka poora page */
export const detail = asyncHandler(async (req, res) =>
  ok(res, await shops.getShopProfile(req.user, req.params.id)));

/** Save (follow jaisa) */
export const save = asyncHandler(async (req, res) =>
  ok(res, await shops.setShopSaved(req.user, req.params.id, true), 'Dukaan save ho gayi'));

/** Save hataana — rishta phir bhi bana rehta hai (khata wahin rehta hai) */
export const unsave = asyncHandler(async (req, res) =>
  ok(res, await shops.setShopSaved(req.user, req.params.id, false), 'Save hata diya'));

/** "Abhi isi dukaan me hoon" — search history ka kram isse banta hai */
export const touch = asyncHandler(async (req, res) => {
  await shops.touchShop(req.user, req.params.id);
  return ok(res, { ok: true });
});

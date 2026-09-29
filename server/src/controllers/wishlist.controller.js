import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/wishlist.service.js';

/* Kharidaar — `withBuyerTenant` ne dukaan (`businessId`) aur uski party (`partyId`) tay kar di hai */
export const list = asyncHandler(async (req, res) =>
  ok(res, await service.listWishlist(req.businessId, req.partyId)));

export const ids = asyncHandler(async (req, res) =>
  ok(res, await service.wishlistItemIds(req.businessId, req.partyId)));

export const add = asyncHandler(async (req, res) =>
  created(res, await service.addWish(req.businessId, req.partyId, req.body), 'Wishlist me daal diya'));

export const remove = asyncHandler(async (req, res) =>
  ok(res, await service.removeWish(req.businessId, req.partyId, req.params.id), 'Wishlist se hata diya'));

export const removeItem = asyncHandler(async (req, res) =>
  ok(res, await service.removeWishForItem(req.businessId, req.partyId, req.params.itemId), 'Wishlist se hata diya'));

/* Malik — log kya maang rahe hain */
export const demand = asyncHandler(async (req, res) =>
  ok(res, await service.demandFor(req.businessId)));

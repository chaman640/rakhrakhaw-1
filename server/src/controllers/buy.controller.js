import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as buy from '../services/buy.service.js';

/** Sab dukaanon ka cart ek saath — har ek ka apna jod, aakhir me kul jod */
export const groupedCart = asyncHandler(async (req, res) =>
  ok(res, await buy.getGroupedCart(req.user)));

/** Neeche wali patti ke badge ke liye */
export const cartCount = asyncHandler(async (req, res) =>
  ok(res, await buy.getGroupedCartCount(req.user)));

/**
 * Ek confirm — har dukaan ka apna order.
 *
 * Jawab me dono list jati hain (gaye aur nahi gaye), isliye sandesh bhi wahi
 * batata hai jo sach me hua. "Order chala gaya" likh kar aadhi baat chhupa dena
 * yahan sabse bura hoga — kharidaar ko lagta ki teeno gaye, aur ek dukaan ka
 * maal kabhi aata hi nahi.
 */
export const checkout = asyncHandler(async (req, res) => {
  const result = await buy.checkoutMany(req.user, req.body);

  const n = result.placed.length;
  const message = result.failed.length
    ? `${n} dukaan ko order chala gaya — ${result.failed.length} ka nahi ja saka`
    : (n === 1
      ? `Order ${result.placed[0].orderNo} chala gaya`
      : `${n} dukaan ko order chala gaya`);

  return created(res, result, message);
});

import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/constants.js';
import { buyerFilter } from '../utils/buyer.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * MULTI-TENANCY KA DIL.
 *
 * Har wholesaler ka data uske businessId se alag hota hai.
 * Ye middleware req.businessId set karta hai — har query me ye filter lagana ZAROORI hai.
 *
 * Wholesaler  -> apna business (BECHNE wala darwaza)
 * Retailer    -> jis wholesaler se juda hai uska business
 *
 * Ye wala BECHNE ke raste pe lagta hai. KHAREEDNE ke raste pe `withBuyerTenant`
 * lagta hai — neeche uski poori wajah likhi hai.
 */
export function withTenant(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());

  const businessId = req.user.businessId;
  if (!businessId) {
    return next(ApiError.forbidden('Pehle business profile banaiye'));
  }

  req.businessId = businessId;
  req.partyId = req.user.partyId || null; // retailer ke liye uski party id
  next();
}

const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));

/**
 * KHAREEDNE KA DARWAZA — har request pe "kis dukaan se?" ka jawab.
 *
 * `withTenant` ek hi tenant jaanta hai: wo jo user ke andar likha hai. Usi ek
 * khaane ki wajah se ek retailer ek hi wholesaler se bandha rehta tha.
 *
 * Yahan tenant har request pe CHUNA jata hai — client `X-Shop-Id` header me
 * bhejta hai. Chunaav manzoor tabhi hota hai jab us user ki us dukaan ke saath
 * `Membership` ho; nahi to 403. Yaani "kaunsi dukaan" client tay karta hai, par
 * "ijazat hai ya nahi" hamesha server.
 *
 * Header hi kyun, query ya body kyun nahi:
 * har buy-side route pe pehle se zod ka validator laga hai. `shopId` ko body/
 * query me daalne se har ek schema me use jodna padta — 20 jagah badlaav, aur
 * ek bhi jagah bhoolne pe wo route chup-chaap "Validation failed" dene lagta.
 * Header kisi validator se guzarta hi nahi, isliye ek bhi purana schema chhedna
 * nahi pada.
 *
 * PURANA RASTA JAISA KA WAISA: header na aaye to retailer ke liye bilkul wahi
 * hota hai jo pehle hota tha — `user.businessId` + `user.partyId`. Isliye purana
 * client, purana bookmark aur purana token — sab bina badle chalte rehte hain.
 */
export async function withBuyerTenant(req, res, next) {
  try {
    if (!req.user) return next(ApiError.unauthorized());

    const wanted = req.get('x-shop-id') || null;
    const { Membership } = await import('../models/index.js');

    // Kharidaar kaun — retailer ka login, ya wholesaler ki poori dukaan
    const mine = buyerFilter(req.user);

    /* ---- 1. Client ne dukaan chuni hai ---- */
    if (wanted) {
      if (!isObjectId(wanted)) return next(ApiError.badRequest('Dukaan ki pehchan galat hai'));

      const membership = mine
        ? await Membership.findOne({ ...mine, businessId: wanted }).lean()
        : null;

      if (membership) {
        req.businessId = membership.businessId;
        req.partyId = membership.partyId;
        req.membership = membership;
        return next();
      }

      /*
        Membership nahi mili par ye uski APNI purani dukaan hai.
        (Backfill kisi wajah se na chala ho — tab bhi retailer ka kaam na ruke.)
      */
      if (String(req.user.businessId || '') === String(wanted) && req.user.partyId) {
        req.businessId = req.user.businessId;
        req.partyId = req.user.partyId;
        return next();
      }

      return next(ApiError.forbidden('Aap is dukaan se jude nahi hain. Pehle number search karke jodein.'));
    }

    /* ---- 2. Dukaan nahi chuni — purana rasta ---- */
    if (req.user.role === ROLES.RETAILER && req.user.businessId && req.user.partyId) {
      req.businessId = req.user.businessId;
      req.partyId = req.user.partyId;
      return next();
    }

    /*
      Wholesaler khareedne aaya hai par dukaan nahi batayi.

      Ek hi dukaan judi ho to poochhna bekaar hai — wahi chun lete hain. Ek se
      zyada ho to chunaav uska hai, hamara andaza nahi: galat dukaan ka cart
      khul jana usse bura hai ki ek baar poochh liya jaye.
    */
    if (!mine) return next(ApiError.forbidden('Pehle business profile banaiye'));

    const list = await Membership.find(mine)
      .sort({ lastUsedAt: -1 }).limit(2).lean();

    if (list.length === 1) {
      req.businessId = list[0].businessId;
      req.partyId = list[0].partyId;
      req.membership = list[0];
      return next();
    }

    if (!list.length) {
      return next(ApiError.badRequest('Pehle dukaan ka number search karke jodein'));
    }
    return next(ApiError.badRequest('Pehle dukaan chunein'));
  } catch (err) {
    next(err);
  }
}

/**
 * Kharidaar tabhi aage badh sakta hai jab bechne wale ne approve kiya ho.
 *
 * Pehle ye sirf `role === 'retailer'` par chalta tha aur party seedha
 * `req.user.partyId` se uthata tha. Ab party wo hai jo ABHI CHUNI GAYI dukaan
 * me hai (`req.partyId`) — isliye wholesaler jab kharidne aata hai tab bhi wahi
 * pehra lagta hai, aur retailer ke liye kuch badla nahi.
 *
 * Party ko `businessId` ke saath dhoondhna bhi jaan-boojh kar hai: agar kabhi
 * galat jodi bhej di jaye to yahan hi ruk jayegi, aage ja kar kisi aur dukaan
 * ka data nahi khol payegi.
 */
export async function requireActiveParty(req, res, next) {
  try {
    if (!req.user) return next(ApiError.unauthorized());

    // Bechne wala apni hi dukaan me hai — yahan check karne ko kuch hai hi nahi
    if (!req.partyId) return next();

    const { Party } = await import('../models/index.js');
    const party = await Party.findOne({ _id: req.partyId, businessId: req.businessId })
      .select('status name shopName').lean();

    if (!party) return next(ApiError.forbidden('Aapki dukaan ki entry nahi mili'));
    if (party.status === 'pending') {
      return next(ApiError.forbidden('Wholesaler ne abhi aapko approve nahi kiya hai'));
    }
    if (party.status === 'blocked') {
      return next(ApiError.forbidden('Aapka access band kar diya gaya hai'));
    }

    req.party = party;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * ═══════════════ BECHNE KA DARWAZA (Step 1) ═══════════════
 *
 * `withTenant` ke TURANT BAAD lagta hai — us waqt tak `req.businessId` pata
 * chal chuka hota hai.
 *
 * Sirf BECHNE wale hisse pe. Kharidne wala hissa (`withBuyerTenant` wale
 * router) isse guzarta hi nahi — wo hamesha free hai, aur wahi is poore
 * dhande ki jaan hai: retailer free me maal dekhta hai, tabhi wholesaler ke
 * liye app ka koi matlab hai.
 *
 * `BILLING_MODE=free` me ye ek `if` se aage nikal jata hai. Yaani aaj iska
 * koi asar nahi — par jis din switch badlega, us din kuch "jodna" nahi
 * padega.
 *
 * Profile, settings aur billing ke raste JAAN-BOOJH KAR khule rakhe hain.
 * Jiska plan khatam ho gaya use andar aakar plan lena hai; use hi bahar rok
 * dena sabse bewakoofi wali rok hogi.
 */
export const requirePaidSeller = asyncHandler(async (req, res, next) => {
  const { assertCanSell } = await import('../services/billing.service.js');
  await assertCanSell(req.businessId);
  next();
});

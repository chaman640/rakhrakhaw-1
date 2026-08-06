import ApiError from '../utils/ApiError.js';

/**
 * MULTI-TENANCY KA DIL.
 *
 * Har wholesaler ka data uske businessId se alag hota hai.
 * Ye middleware req.businessId set karta hai — har query me ye filter lagana ZAROORI hai.
 *
 * Wholesaler  -> apna business
 * Retailer    -> jis wholesaler se juda hai uska business (1:1 lock)
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

/**
 * Retailer tabhi aage badh sakta hai jab wholesaler ne approve kiya ho.
 * Part 6 (catalog) aur Part 7 (orders) me har route pe lagega.
 */
export async function requireActiveParty(req, res, next) {
  try {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role !== 'retailer') return next();

    const { Party } = await import('../models/index.js');
    const party = await Party.findById(req.user.partyId).select('status name').lean();

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

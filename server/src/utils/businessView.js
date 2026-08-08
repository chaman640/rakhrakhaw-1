import { clientOrigin } from '../config/origin.js';
import { ROLES, STAFF_ROLES } from '../config/constants.js';

/** Invite link — ek hi URL wale deploy me app khud pata laga leta hai ki wo kis URL pe chal raha hai */
export const buildInviteLink = (code) => (code ? `${clientOrigin()}/join/${code}` : '');

/**
 * BUSINESS KA EK HI DARWAZA.
 *
 * "Kis user ko dukaan ki kaunsi baat dikhegi" — ye faisla sirf yahan hota hai.
 * Poore project me `Business` doc kabhi seedha response me mat bhejna, warna
 * do jagah do alag jawab ban jayenge (pehle yahi hua tha: `/business/me` aur
 * `/auth/me` dono poora doc de rahe the).
 *
 * Teen tarah ke log hain:
 *
 *   malik    — sab kuch (Settings page usi ka hai)
 *   staff    — dukaan ki wo pehchaan jo bill pe chhapti hai, aur kuch nahi
 *   retailer — sirf itna jitna ek graahak ko dikhna chahiye
 *
 * Staff se kya chhupta hai aur kyun:
 *   inviteCode / inviteLink  — jiske paas link hai wo retailer ban kar ghus
 *                              sakta hai. Naya link sirf malik bana sakta hai,
 *                              isliye leak hone par malik ko pata bhi nahi chalega.
 *   upiId / upiName          — malik ka apna paisa lene ka handle
 *   email                    — dukaan ka account wala email (password reset ka rasta)
 *   inviteEnabled            — kaun andar aa sakta hai, ye malik ka faisla hai
 *   autoApproveRetailers     — wahi baat
 *   ownerUserId, logoPublicId — bahar ki duniya ka kaam nahi
 *
 * GSTIN aur address JAAN-BOOJH KAR staff ko dete hain — ye har bill ke upar
 * chhapte hain, chhupane se billing hi toot jayegi.
 */

// Bill banane/chhapne ke liye jitna chahiye — utna hi
const STAFF_FIELDS = [
  '_id', 'name', 'phone', 'address', 'gstEnabled', 'gstin', 'logoUrl',
  'invoicePrefix', 'orderPrefix', 'termsAndConditions', 'invoiceFooterNote',
  'lowStockThreshold', 'currency', 'isActive', 'createdAt', 'updatedAt',
];

// Retailer ko sirf dukaan ki pehchaan
const RETAILER_FIELDS = ['_id', 'name', 'phone', 'address', 'logoUrl', 'gstEnabled'];

const pick = (obj, fields) => {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
};

export const isOwnerUser = (user) =>
  user?.role === ROLES.WHOLESALER
  && (user.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER;

export function businessForUser(business, user) {
  if (!business) return null;
  const plain = business.toObject ? business.toObject() : business;

  if (user?.role === ROLES.RETAILER) return pick(plain, RETAILER_FIELDS);

  if (!isOwnerUser(user)) return pick(plain, STAFF_FIELDS);

  // Malik ko sab kuch, invite link ke saath
  return { ...plain, inviteLink: buildInviteLink(plain.inviteCode) };
}

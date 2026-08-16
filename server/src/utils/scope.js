import mongoose from 'mongoose';
import { Party } from '../models/index.js';
import { SCOPES, STAFF_ROLES } from '../config/permissions.js';

/**
 * "SIRF APNA KAAM" — data ki hadd.
 *
 * Ijazat (permission) batati hai ki kaun sa kaam kar sakte ho.
 * Ye file batati hai ki kis KE data pe kar sakte ho.
 *
 * Do bilkul alag cheezein hain, aur dono chahiye. Salesman ko bill banane ki
 * ijazat de di, par hadd nahi lagayi — to wo doosre salesman ke retailer ka
 * bill bhi bana lega, unke khaas rate dekh lega, aur unka udhaar bhi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Retailer "kiska" hai — ye Party pe likha hota hai:
 *
 *     assignedToUserId  — malik ne jiske naam kiya (asli maalikana)
 *     createdBy         — jisne add kiya (jab tak kisi ke naam na ho)
 *
 * Order, bill aur khata ka apna maalik nahi hota — wo us RETAILER ke saath
 * chalte hain jiska wo hai. Isliye pehle "mere retailer" nikalte hain, phir
 * unhi ke order/bill dikhate hain. Isse ek hi jagah niyam badalna padta hai.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Is aadmi ko sirf apna data dikhega? Malik ko hamesha sab dikhta hai. */
export function isScoped(user) {
  if (!user) return false;
  if ((user.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER) return false;
  return user.scope === SCOPES.OWN;
}

/**
 * "Mere" retailer/supplier ki id.
 *
 * Ek request me ye kai baar chahiye hoti hai (list, stats, count) — isliye
 * jawab usi `user` object pe rakh dete hain jo `protect` har request ke liye
 * naya banata hai. Yaani ek request me ek hi baar database jata hai, aur
 * agli request pe purana jawab kabhi nahi chipakta.
 */
export async function ownPartyIds(businessId, user) {
  if (user.__ownPartyIds) return user.__ownPartyIds;

  const ids = await Party.find({
    businessId,
    $or: [{ assignedToUserId: user._id }, { createdBy: user._id }],
  }).distinct('_id');

  // eslint-disable-next-line no-param-reassign
  user.__ownPartyIds = ids;
  return ids;
}

/**
 * Party ki list pe hadd lagana.
 *
 * `filter` waisa ka waisa wapas milta hai agar hadd hai hi nahi — isliye har
 * jagah bina soche laga sakte hain.
 */
export function scopeParties(filter, user) {
  if (!isScoped(user)) return filter;
  return {
    ...filter,
    $and: [
      ...(filter.$and || []),
      { $or: [{ assignedToUserId: user._id }, { createdBy: user._id }] },
    ],
  };
}

/**
 * Un cheezon pe hadd jo kisi party se judi hain — order, bill, khata, payment.
 *
 * `alsoMine` true ho to apna banaya hua bhi dikhega, chahe party kisi aur ki
 * ho. Bill ke liye ye theek hai: aaj salesman ne kisi aur ke retailer ka bill
 * bana diya, to apna banaya hua bill to dikhna hi chahiye.
 */
export async function scopeByParty(filter, businessId, user, { alsoMine = false } = {}) {
  if (!isScoped(user)) return filter;

  const ids = await ownPartyIds(businessId, user);
  const or = [{ partyId: { $in: ids } }];
  if (alsoMine) or.push({ createdBy: user._id });

  return { ...filter, $and: [...(filter.$and || []), { $or: or }] };
}

/**
 * Ek khaas cheez khol kar dekhne se pehle: ye iska hai bhi ya nahi?
 *
 * Sirf list chhupa dena kaafi nahi hota — id to URL me daali ja sakti hai.
 * Bina is check ke "sirf apna kaam" sirf dikhawa reh jata hai.
 */
export async function canSeeParty(partyId, businessId, user) {
  if (!isScoped(user)) return true;
  const ids = await ownPartyIds(businessId, user);
  return ids.some((id) => String(id) === String(partyId));
}

/** Bill/order jaisi cheez — ya to uski party meri ho, ya maine khud banayi ho */
export async function canSeeDoc(doc, businessId, user) {
  if (!isScoped(user)) return true;
  if (!doc) return false;
  if (doc.createdBy && String(doc.createdBy) === String(user._id)) return true;
  return canSeeParty(doc.partyId, businessId, user);
}

/** Aggregation ke `$match` me lagane ke liye (id ko ObjectId chahiye) */
export const toObjectIds = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));

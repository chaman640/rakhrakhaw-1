import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { Party, LedgerEntry } from '../models/index.js';

/**
 * KHATA ka ek hi darwaza.
 *
 * `balance` ka matlab (dono taraf +ve = "hisaab baaki hai"):
 *   retailer  +ve  ->  usne hamara paisa dena hai (udhaar)
 *   supplier  +ve  ->  humne uska paisa dena hai
 *
 * `debit`  = hisaab BADHA   (bill bana / maal aaya)
 * `credit` = hisaab GHATA   (paisa diya / paisa aaya)
 *
 * balanceAfter = purana balance + debit − credit
 *
 * Part 9 (payments) bhi yahi function use karega — do jagah hisaab mat likhna.
 */
export async function postEntry({
  businessId, partyId, type, debit = 0, credit = 0,
  date = new Date(), refType = null, refId = null, refNo = '',
  note = '', userId = null,
}) {
  const d = round2(debit || 0);
  const c = round2(credit || 0);
  if (d === 0 && c === 0) throw ApiError.badRequest('Khali entry khate me nahi jayegi');

  // Party.balance ko atomically badha kar naya balance le lo —
  // do entry ek saath aayein tab bhi running balance galat nahi hoga
  const party = await Party.findOneAndUpdate(
    { _id: partyId, businessId },
    { $inc: { balance: d - c } },
    { new: true }
  );
  if (!party) throw ApiError.notFound('Party nahi mili');

  const entry = await LedgerEntry.create({
    businessId, partyId, type, date,
    debit: d, credit: c,
    balanceAfter: round2(party.balance),
    refType, refId, refNo, note, createdBy: userId,
  });

  // Purani date pe entry daali? To ye entry beech me ghus gayi hai aur uske
  // aage wali sab entries ka running balance khisak gaya — dobara jod do.
  const laterExists = await LedgerEntry.exists({
    businessId, partyId, _id: { $ne: entry._id }, date: { $gt: date },
  });
  if (laterExists) {
    const balance = await recalcBalances(businessId, partyId);
    const fresh = await LedgerEntry.findById(entry._id).lean();
    return { entry: fresh, balance };
  }

  return { entry, balance: round2(party.balance) };
}

/** Kisi ref (purchase/invoice/payment) ki saari entries ulti kar do */
export async function reverseEntriesFor({ businessId, refType, refId, userId = null }) {
  const entries = await LedgerEntry.find({ businessId, refType, refId }).lean();
  if (!entries.length) return { reversed: 0 };

  const partyIds = [...new Set(entries.map((e) => String(e.partyId)))];

  await LedgerEntry.deleteMany({ businessId, refType, refId });

  // Beech ki entry hatne se aage wali saari entries ka running balance galat ho
  // jata hai — isliye us party ka poora khata dobara jod dete hain.
  for (const partyId of partyIds) {
    await recalcBalances(businessId, partyId);
  }

  return { reversed: entries.length };
}

/**
 * Ek party ke poore khate ka running balance dobara ginta hai.
 *
 * Kab chahiye:
 *   - koi entry beech me se hat jaye (bill cancel, payment/return delete)
 *   - koi entry PURANI date pe daali jaye (aage wali sab peeche khisak jati hain)
 *
 * Party.balance bhi yahin set hota hai — isliye khata aur balance kabhi
 * alag nahi ho sakte. Ye khud hi theek kar deta hai.
 */
export async function recalcBalances(businessId, partyId) {
  const entries = await LedgerEntry.find({ businessId, partyId })
    .sort({ date: 1, createdAt: 1 })
    .select('_id debit credit')
    .lean();

  let running = 0;
  const ops = [];
  for (const e of entries) {
    running = round2(running + (e.debit || 0) - (e.credit || 0));
    ops.push({ updateOne: { filter: { _id: e._id }, update: { $set: { balanceAfter: running } } } });
  }

  if (ops.length) await LedgerEntry.bulkWrite(ops);
  await Party.updateOne({ _id: partyId, businessId }, { $set: { balance: running } });

  return running;
}

export async function getLedger(businessId, partyId, { limit = 100 } = {}) {
  return LedgerEntry.find({ businessId, partyId })
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

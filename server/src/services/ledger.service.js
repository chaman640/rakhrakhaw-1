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

  return { entry, balance: round2(party.balance) };
}

/** Kisi ref (purchase/invoice/payment) ki saari entries ulti kar do */
export async function reverseEntriesFor({ businessId, refType, refId, userId = null }) {
  const entries = await LedgerEntry.find({ businessId, refType, refId }).lean();
  if (!entries.length) return { reversed: 0 };

  for (const e of entries) {
    // Ulta karo: jo debit tha wo credit, jo credit tha wo debit
    await Party.updateOne(
      { _id: e.partyId, businessId },
      { $inc: { balance: round2(e.credit - e.debit) } }
    );
  }

  await LedgerEntry.deleteMany({ businessId, refType, refId });
  return { reversed: entries.length };
}

export async function getLedger(businessId, partyId, { limit = 100 } = {}) {
  return LedgerEntry.find({ businessId, partyId })
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

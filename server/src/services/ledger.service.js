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

/*
  Ek party ke khate pe ek waqt me ek hi likhai.

  `$inc` akela kaafi nahi tha: purani tareekh ki entry ya entry hatne pe
  `recalcBalances` poora khata padh kar balance SET karta hai. Usi pal doosri
  payment ka `$inc` lag chuka ho par entry abhi bani na ho, to wo payment
  balance se gayab ho jati thi (3 payment ek saath → balance −300, khata −600).
  Ab dusra kaam fail nahi hota, thoda ruk kar apni baari pe chalta hai.
*/
const LOCK_STALE_MS = 30 * 1000;
const LOCK_WAIT_MS = 15 * 1000;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function withPartyLedger(businessId, partyId, fn) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  let token;
  for (let wait = 5; ; wait = Math.min(wait * 2, 100)) {
    token = new Date();
    const got = await Party.updateOne(
      { _id: partyId, businessId, $or: [{ ledgerLockAt: null }, { ledgerLockAt: { $lt: new Date(token.getTime() - LOCK_STALE_MS) } }] },
      { $set: { ledgerLockAt: token } },
    );
    if (got.modifiedCount) break;
    if (!(await Party.exists({ _id: partyId, businessId }))) throw ApiError.notFound('Party nahi mili');
    if (Date.now() > deadline) throw ApiError.conflict('Khata abhi vyast hai — thodi der me dobara koshish karein');
    await sleep(wait);
  }
  try {
    return await fn();
  } finally {
    await Party.updateOne({ _id: partyId, ledgerLockAt: token }, { $unset: { ledgerLockAt: 1 } }).catch(() => {});
  }
}
export function postEntry(args) {
  return withPartyLedger(args.businessId, args.partyId, () => postEntryLocked(args));
}

async function postEntryLocked({
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

  /*
    `$inc` lag chuka hai. Ab entry na bani to `Party.balance` aur khata
    HAMESHA ke liye alag ho jate — aur wo farak kabhi apne aap theek nahi
    hota, kyunki `recalcBalances` tabhi chalta hai jab koi use bulaye.

    Isliye yahan wahi compensating pattern hai jo `createInvoice` me hai:
    fail hone par apna hi `$inc` ulta karo, phir asli error aage bhejo.
  */
  let entry;
  try {
    entry = await LedgerEntry.create({
      businessId, partyId, type, date,
      debit: d, credit: c,
      balanceAfter: round2(party.balance),
      refType, refId, refNo, note, createdBy: userId,
    });
  } catch (err) {
    await Party.updateOne({ _id: partyId, businessId }, { $inc: { balance: c - d } })
      .catch(() => {
        // Ulta karna bhi fail — ab sirf poora khata dobara jodna hi bachta hai
        console.error(`[ledger] ${partyId} ka balance ulta nahi ho paya — recalc chala rahe hain`);
        return recalcUnlocked(businessId, partyId).catch(() => {});
      });
    throw err;
  }

  // Purani date pe entry daali? To ye entry beech me ghus gayi hai aur uske
  // aage wali sab entries ka running balance khisak gaya — dobara jod do.
  const laterExists = await LedgerEntry.exists({
    businessId, partyId, _id: { $ne: entry._id }, date: { $gt: date },
  });
  if (laterExists) {
    const balance = await recalcUnlocked(businessId, partyId);
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
export function recalcBalances(businessId, partyId) {
  return withPartyLedger(businessId, partyId, () => recalcUnlocked(businessId, partyId));
}

async function recalcUnlocked(businessId, partyId) {
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

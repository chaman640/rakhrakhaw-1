import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { PARTY_TYPES, LEDGER_TYPES, NOTIFICATION_TYPES } from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { Party, LedgerEntry, Business, Invoice } from '../models/index.js';
import { notifyRetailer } from './notification.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TYPE_LABEL = {
  OPENING: 'Purana hisaab',
  INVOICE: 'Bill',
  PURCHASE: 'Maal aaya',
  PAYMENT_IN: 'Paisa aaya',
  PAYMENT_OUT: 'Paisa diya',
  ADJUSTMENT: 'Adjustment',
  SALE_RETURN: 'Maal wapas aaya',
  PURCHASE_RETURN: 'Maal wapas bheja',
};

/* ------------------------------------------------------------- khata list */

export async function listKhata(businessId, q) {
  const filter = { businessId };
  if (q.type !== 'all') filter.type = q.type;
  if (q.filter === 'due') filter.balance = { $gt: 0 };
  else if (q.filter === 'clear') filter.balance = { $lte: 0 };

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { shopName: rx }, { phone: rx }];
  }

  const skip = (q.page - 1) * q.limit;
  const sort = q.sort === 'name' ? { name: 1 }
    : q.sort === 'balance' ? { balance: 1 } : { balance: -1 };

  const [parties, total] = await Promise.all([
    Party.find(filter).sort(sort).skip(skip).limit(q.limit)
      .select('name shopName phone type balance creditLimit status updatedAt').lean(),
    Party.countDocuments(filter),
  ]);

  // Har party ka aakhri lena-dena kab hua
  const ids = parties.map((p) => p._id);
  const lastEntries = await LedgerEntry.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId), partyId: { $in: ids } } },
    { $sort: { date: -1, createdAt: -1 } },
    { $group: { _id: '$partyId', lastDate: { $first: '$date' }, lastType: { $first: '$type' } } },
  ]);
  const lastMap = Object.fromEntries(lastEntries.map((e) => [String(e._id), e]));

  return {
    parties: parties.map((p) => ({
      ...p,
      lastActivity: lastMap[String(p._id)]?.lastDate || null,
      lastType: lastMap[String(p._id)]?.lastType || null,
      overLimit: p.creditLimit > 0 && p.balance > p.creditLimit,
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function getKhataSummary(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const [rows] = await Party.aggregate([
    { $match: { businessId: bid } },
    {
      $group: {
        _id: null,
        receivable: {
          $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] },
        },
        payable: {
          $sum: { $cond: [{ $and: [{ $eq: ['$type', 'supplier'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] },
        },
        retailersWithDue: {
          $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $gt: ['$balance', 0] }] }, 1, 0] },
        },
        overLimit: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$creditLimit', 0] }, { $gt: ['$balance', '$creditLimit'] }] },
              1, 0,
            ],
          },
        },
      },
    },
  ]);

  // Sabse zyada udhaar wale 5
  const topDebtors = await Party.find({ businessId, type: PARTY_TYPES.RETAILER, balance: { $gt: 0 } })
    .sort({ balance: -1 }).limit(5).select('name shopName balance phone').lean();

  return {
    receivable: round2(rows?.receivable || 0),
    payable: round2(rows?.payable || 0),
    net: round2((rows?.receivable || 0) - (rows?.payable || 0)),
    retailersWithDue: rows?.retailersWithDue || 0,
    overLimit: rows?.overLimit || 0,
    topDebtors,
  };
}

/* ----------------------------------------------------------- party ledger */

/**
 * Ek party ka poora khata.
 *
 * `balanceAfter` har entry ke saath pehle se store hai (ledger.service se),
 * isliye running balance dobara ginne ki zarurat nahi — bas ye dhyan rakhna
 * hai ki limit lagne par KAUNSI entries kati.
 */
export async function getPartyLedger(businessId, partyId, { from, to, limit = 200 } = {}) {
  const party = await Party.findOne({ _id: partyId, businessId }).lean();
  if (!party) throw ApiError.notFound('Party nahi mili');

  const filter = { businessId, partyId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); filter.date.$lte = t; }
  }

  // ULTA nikalte hain (naya pehle), phir palat dete hain.
  //
  // Pehle seedha nikalte the — us se limit PURANI entries pakadti thi. Jis party
  // ke 200 se zyada lena-dena ho gaye, uske khate me aaj ka bill dikhta hi nahi tha
  // aur neeche "Baaki" me mahino purana number chipak jata tha. Ab limit hamesha
  // NAYI entries pakadti hai, isliye closing hamesha aaj ka sach hota hai.
  const [newestFirst, total] = await Promise.all([
    LedgerEntry.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).lean(),
    LedgerEntry.countDocuments(filter),
  ]);
  const entries = newestFirst.reverse();

  // Jo dikh raha hai us se PEHLE ka hisaab.
  //
  // Pehli dikhne wali entry se ulta jod kar nikalte hain. Isse
  // "opening + badha − ghata = closing" HAMESHA barabar rehta hai — chahe
  // entries limit se kati hon, chahe date range laga ho, chahe dono.
  let opening = 0;
  if (entries.length) {
    const first = entries[0];
    opening = round2((first.balanceAfter || 0) - (first.debit || 0) + (first.credit || 0));
  } else if (from) {
    const before = await LedgerEntry.findOne({ businessId, partyId, date: { $lt: from } })
      .sort({ date: -1, createdAt: -1 }).select('balanceAfter').lean();
    opening = round2(before?.balanceAfter || 0);
  }

  const totalDebit = round2(entries.reduce((s, e) => s + e.debit, 0));
  const totalCredit = round2(entries.reduce((s, e) => s + e.credit, 0));

  return {
    party: {
      _id: party._id, name: party.name, shopName: party.shopName, phone: party.phone,
      type: party.type, balance: round2(party.balance), creditLimit: party.creditLimit,
      gstin: party.gstin, address: party.address,
    },
    opening,
    entries: entries.map((e) => ({ ...e, typeLabel: TYPE_LABEL[e.type] || e.type })),
    totalDebit,
    totalCredit,
    closing: round2(entries.length ? entries[entries.length - 1].balanceAfter : opening),
    // UI ko batana hai ki kuch purani entries chhup gayi hain
    total,
    shown: entries.length,
    truncated: total > entries.length,
  };
}

/** Retailer apna khata dekhe — bill ke link ke saath */
export async function getMyKhata(businessId, partyId, opts) {
  const data = await getPartyLedger(businessId, partyId, opts);

  const business = await Business.findById(businessId)
    .select('name phone upiId upiName logoUrl').lean();

  // Kaunse bill ke paise baaki hain
  const openInvoices = await Invoice.find({
    businessId, partyId, isCancelled: false, dueAmount: { $gt: 0 },
  }).sort({ invoiceDate: 1 }).select('invoiceNo invoiceDate grandTotal paidAmount dueAmount').lean();

  return {
    ...data,
    openInvoices,
    upi: business?.upiId
      ? { id: business.upiId, name: business.upiName || business.name }
      : null,
    shopName: business?.name,
  };
}


/* --------------------------------------------------- udhaar ki yaad dilana */

/**
 * "Bhaiya, paisa bhej dijiye" — app ke andar hi.
 *
 * SMS nahi, WhatsApp nahi — sirf notification. Retailer app khole to dikh jayega,
 * aur usi jagah se UPI se paisa bhi bhej sakta hai.
 */
export async function sendReminder(businessId, partyId, { message = '' } = {}) {
  const party = await Party.findOne({ _id: partyId, businessId })
    .select('name shopName balance linkedUserId').lean();
  if (!party) throw ApiError.notFound('Party nahi mili');
  if (party.balance <= 0) throw ApiError.badRequest('Inka hisaab barabar hai, yaad dilane ki zarurat nahi');
  if (!party.linkedUserId) throw ApiError.badRequest('Ye abhi app pe nahi aaya — phone karna padega');

  const business = await Business.findById(businessId).select('name').lean();

  await notifyRetailer(businessId, partyId, {
    type: NOTIFICATION_TYPES.PAYMENT_REMINDER,
    title: `${business?.name || 'Wholesaler'} ne yaad dilaya hai`,
    body: message || `${round2(party.balance)} baaki hai — bhej dijiye`,
    link: '/my-khata',
    data: { balance: round2(party.balance) },
  });

  return { sent: true, balance: round2(party.balance) };
}

export { TYPE_LABEL };

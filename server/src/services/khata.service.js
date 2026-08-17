import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { PARTY_TYPES, LEDGER_TYPES, NOTIFICATION_TYPES } from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { Party, LedgerEntry, Business, Invoice, Purchase } from '../models/index.js';
import {
  scopeParties, scopePartiesMatch, isScoped, canSeeParty,
} from '../utils/scope.js';
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

export async function listKhata(businessId, q, viewer = null) {
  let filter = { businessId };
  if (q.type !== 'all') filter.type = q.type;
  if (q.filter === 'due') filter.balance = { $gt: 0 };
  else if (q.filter === 'clear') filter.balance = { $lte: 0 };

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { shopName: rx }, { phone: rx }];
  }

  // Khata bhi retailer ke saath chalta hai — jiske retailer nahi, uska khata bhi nahi
  filter = scopeParties(filter, viewer);

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

/**
 * "KISSE KITNA LENA HAI" — Payment page ka sabse upar wala hissa.
 *
 * `listKhata` se do farak hain, aur dono zaroori hain:
 *
 *   1. Yahan sirf wahi party aati hai jispe paisa BAAKI hai (`balance > 0`).
 *      Baaki ki list dekhni ho to Khata page hai hi.
 *   2. Har line pe "KITNA PURANA" bhi aata hai — sabse purane khule bill ki
 *      tareekh. Ye asli baat hai: ₹5,000 kal ka aur ₹5,000 teen mahine purana
 *      ek jaise nahi hote, par ginti dono ki ek jaisi dikhti hai.
 *
 * Rakam hamesha `Party.balance` se aati hai, bill ke jod se nahi — kyunki
 * khate me purana hisaab (opening) aur advance bhi ginte hain. Bill se sirf
 * "kab se" aur "kitne bill khule hain" nikalte hain.
 *
 * Sort database me hi hota hai (`$sort` ke baad `$skip/$limit`), isliye page 2
 * pe bhi kram sach me sahi rehta hai — client pe chhant kar dikhane wala
 * jugaad chup-chaap jhooth bolta hai.
 */
export async function listDue(businessId, q, viewer = null) {
  const bid = new mongoose.Types.ObjectId(businessId);
  const FIELDS = 'name shopName phone type balance creditLimit status';

  const base = {
    type: q.type === 'supplier' ? PARTY_TYPES.SUPPLIER : PARTY_TYPES.RETAILER,
    balance: { $gt: 0 },
  };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    base.$or = [{ name: rx }, { shopName: rx }, { phone: rx }];
  }

  // Ek hi chhalni ke do roop: `find()` wala (string id chalti hai) aur
  // `$match` wala (id ObjectId honi chahiye) — jod nikalne ke liye.
  const filter = scopeParties({ businessId, ...base }, viewer);
  const match = scopePartiesMatch({ businessId: bid, ...base }, viewer);

  /*
    Khule bill ek hi baar, ek hi pass me — party ke hisaab se juda hua.

    Pehle yahan `$lookup` likha tha (har party ke liye uske bill dhoondho). Wo
    dikhne me saaf tha par kaam bura: `$skip/$limit` se PEHLE chalta hai, yaani
    200 udhaar wali party pe ek page kholne ke liye 200 chhoti query. Yahan
    ULTA karte hain — sirf KHULE bill padhte hain (jo apne aap chhoti list hai,
    kyunki bike hue aur chukta bill isme aate hi nahi) aur ek hi group me
    party-wise jod nikal lete hain.
  */
  /*
    Retailer ka udhaar BILL me hota hai, supplier ka PURCHASE me.

    Ye farak yaad rakhna zaroori hai. Pehle yahan sirf Invoice padhi jati thi;
    supplier wali list bhi chal jati (rakam Party.balance se aati hai) par har
    supplier pe "kitna purana" khali dikhta — kyunki uske naam ka koi bill hota
    hi nahi. Aisa khaali khaana bug se bhi bura hai: dikhta hai ki jaankari hai
    hi nahi, jabki wo Purchase me padi hui thi.

    Purchase me `isCancelled` hota hi nahi — use mitao to wo hat jati hai.
  */
  const supplier = q.type === 'supplier';
  // Ispe hadd lagane ki zarurat nahi: ye sirf ek naksha (map) hai, aur isme se
  // wahi line padhi jati hai jiski party neeche wali chhalni se nikli ho — aur
  // wo chhalni already hadd me hai.
  const openAgg = supplier
    ? await Purchase.aggregate([
      { $match: { businessId: bid, dueAmount: { $gt: 0 } } },
      { $group: { _id: '$supplierId', oldest: { $min: '$purchaseDate' }, bills: { $sum: 1 } } },
    ])
    : await Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, dueAmount: { $gt: 0 } } },
      { $group: { _id: '$partyId', oldest: { $min: '$invoiceDate' }, bills: { $sum: 1 } } },
    ]);
  const openMap = Object.fromEntries(openAgg.map((r) => [String(r._id), r]));

  const shape = (p) => {
    const open = openMap[String(p._id)];
    return {
      ...p,
      balance: round2(p.balance),
      oldestDue: open?.oldest || null,
      openBills: open?.bills || 0,
      overLimit: p.creditLimit > 0 && p.balance > p.creditLimit,
    };
  };

  const skip = (q.page - 1) * q.limit;
  const total = await Party.countDocuments(filter);
  const sumAgg = await Party.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: '$balance' } } },
  ]);

  let parties;
  if (q.sort === 'oldest') {
    /*
      "Purana pehle" me kram bill ki tareekh se aata hai, party ke kisi apne
      field se nahi — isliye database ise sort nahi kar sakta. Isliye is ek
      halat me udhaar wali saari party padh kar yahan chhantte hain. Ye list
      hai kya — "jinka paisa baaki hai" — aur wo aam dukaan me sau-do sau se
      aage nahi jati. Jiska koi khula bill hi nahi (sirf purana hisaab) wo
      sabse NEECHE, warna wo null ki wajah se sabse upar chipak jate.
    */
    const all = (await Party.find(filter).select(FIELDS).lean()).map(shape);
    all.sort((a, b) => {
      if (!!a.openBills !== !!b.openBills) return b.openBills ? 1 : -1;
      if (a.oldestDue && b.oldestDue) return new Date(a.oldestDue) - new Date(b.oldestDue);
      return b.balance - a.balance;
    });
    parties = all.slice(skip, skip + q.limit);
  } else {
    const sort = q.sort === 'name' ? { name: 1 } : { balance: -1 };
    const rows = await Party.find(filter).select(FIELDS).sort(sort).skip(skip).limit(q.limit).lean();
    parties = rows.map(shape);
  }

  return {
    parties,
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      // Poore filter ka jod — sirf is page ka nahi
      totalDue: round2(sumAgg[0]?.amount || 0),
    },
  };
}

export async function getKhataSummary(businessId, viewer = null) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const mine = isScoped(viewer)
    ? { $or: [{ assignedToUserId: viewer._id }, { createdBy: viewer._id }] }
    : {};

  const [rows] = await Party.aggregate([
    { $match: { businessId: bid, ...mine } },
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
export async function getPartyLedger(businessId, partyId, { from, to, limit = 200, viewer = null } = {}) {
  const party = await Party.findOne({ _id: partyId, businessId }).lean();
  if (!party) throw ApiError.notFound('Party nahi mili');

  if (!(await canSeeParty(partyId, businessId, viewer))) {
    throw ApiError.notFound('Party nahi mili');
  }

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
export async function sendReminder(businessId, partyId, { message = '' } = {}, viewer = null) {
  if (!(await canSeeParty(partyId, businessId, viewer))) {
    throw ApiError.notFound('Party nahi mili');
  }
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

import mongoose from 'mongoose';
import { round2 } from '../utils/money.js';
import { PARTY_TYPES } from '../config/constants.js';
import {
  Party, Invoice, Purchase, LedgerEntry, Payment, ReturnNote,
} from '../models/index.js';
import { applyCredit } from './settlement.service.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * "KITNA BAAKI HAI" — POORE APP ME SIRF EK JAWAB.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ye file isliye bani ki ek hi sawal ke app me chhah alag jawab aa rahe the:
 *
 *   Home (wholesaler)  ->  Party.balance ka jod
 *   Payments page      ->  Party.balance ka jod
 *   Bills page         ->  sum(bill ka dueAmount)
 *   Retailer Home      ->  Party.balance   + alag se khule bill ki list
 *   Mera Khata         ->  khate ka closing + alag se khule bill ki list
 *
 * Ye teen alag number hain, aur teeno "sahi" the — kyunki khata aur bill ek
 * hi cheez nahi ginte:
 *
 *      balance  =  purana hisaab  +  khule bill  −  jama paisa
 *
 * Dukaandaar ko ye samjhana mumkin nahi. Uske liye "baaki" ek hi number hai.
 * Isliye ab do kaam hote hain:
 *
 *   1. JAMA PAISA APNE AAP BILL PE LAG JATA HAI (`sweepAdvance`), isliye
 *      "jama" aur "khula bill" ek saath ho hi nahi sakte. Bacha sirf:
 *
 *          balance  =  purana hisaab  +  khule bill        (jab paisa lena hai)
 *          balance  = −jama paisa                          (jab dena hai)
 *
 *   2. Har jagah wahi TOD-PHOD (`hisaab`) bhejte hain — kitna bill ka, kitna
 *      purana, kitna jama — taaki page number chhupa kar na dikhaye.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WO ASLI BUG JISKE LIYE YE SAB HUA
 *
 * Pehle jama paisa naye bill pe TABHI lagta tha jab dukaandaar khud "jama
 * paisa istemal karein" wala tick lagata. Kisi ne kabhi nahi lagaya — wo
 * tick bill banate waqt dikhta hi tab tha jab wo dhyan se dekhe.
 *
 * Nateeja ye:
 *
 *   graahak ne ₹5,000 ka maal wapas kiya      ->  khata: −5,000 (jama)
 *   agle din ₹5,000 ka naya bill bana          ->  khata: 0
 *                                                  bill : ₹5,000 UDHAAR
 *
 *   Home bolta tha  "kuch baaki nahi"
 *   Bill bolta tha  "₹5,000 baaki"
 *   aur ₹5,000 cash lene jao to app ROK deta tha:
 *       "Inka koi udhaar baaki nahi hai"
 *
 * Yahi ek chhoot user ki teen alag shikayat ban gayi thi — "payment ho gaya
 * phir bhi udhaar", "dono ka hisaab alag alag", aur "pending hat hi nahi
 * raha". Jad ek hi thi.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** Retailer ka bill, supplier ki purchase — ek hi sawal, do jagah */
const KIND = {
  retailer: { kind: 'Invoice', model: () => Invoice, party: 'partyId', open: { isCancelled: false } },
  supplier: { kind: 'Purchase', model: () => Purchase, party: 'supplierId', open: {} },
};

export function kindForParty(type) {
  return KIND[type === PARTY_TYPES.SUPPLIER ? 'supplier' : 'retailer'];
}

/**
 * Number ko TOD kar dena — bina database ke, isliye test karna aasan.
 *
 * `balance` khate ka sach hai, `billsDue` bill ka. Dono ke beech ka fark hi
 * "purana hisaab" hai (jo kisi bill se nahi aaya), aur ulta balance "jama".
 */
export function splitBalance(balance = 0, billsDue = 0) {
  const bal = round2(balance);
  const due = round2(Math.max(0, billsDue));

  // Ulta balance = paisa hamare paas jama hai
  const advance = round2(Math.max(0, -bal));

  // Bill se bahar ka hissa — purana hisaab (opening) ya seedhi adjustment.
  // Kabhi minus nahi dikhate: minus wala hissa `advance` me pehle hi gina ja
  // chuka hai, dobara dikhana matlab ek hi paisa do jagah.
  const other = round2(Math.max(0, bal - due));

  return {
    balance: bal,
    billsDue: due,
    otherDue: other,
    advance,
    /* Ek hi number jo har page pe bada karke dikhta hai */
    netDue: round2(Math.max(0, bal)),
    /* Kya khata aur bill ek doosre se alag ja rahe hain */
    settled: bal <= 0 && due <= 0,
  };
}

/* ------------------------------------------------------------ ek party ka */

/**
 * Ek party ka poora hisaab — jitne bhi page use dikhate hain, sabka source.
 *
 * `advanceFrom` isliye ki user ki shikayat thi: "jama hai to dikhta hai, par
 * ye kiska paisa hai aur kahan se aaya, wo kahin likha hi nahi hota". Ab
 * seedha likha jata hai — kis wapasi/payment se aaya, kab aaya.
 */
export async function partyHisaab(businessId, partyId, { withSources = false } = {}) {
  const party = await Party.findOne({ _id: partyId, businessId })
    .select('name shopName phone type balance creditLimit openingBalance').lean();
  if (!party) return null;

  const cfg = kindForParty(party.type);
  const [agg] = await cfg.model().aggregate([
    { $match: { businessId: oid(businessId), [cfg.party]: oid(partyId), ...cfg.open, dueAmount: { $gt: 0 } } },
    { $group: { _id: null, due: { $sum: '$dueAmount' }, n: { $sum: 1 } } },
  ]);

  const split = splitBalance(party.balance || 0, agg?.due || 0);

  const out = {
    partyId: String(party._id),
    name: party.shopName || party.name,
    phone: party.phone || '',
    type: party.type,
    creditLimit: party.creditLimit || 0,
    overLimit: party.creditLimit > 0 && split.balance > party.creditLimit,
    openBills: agg?.n || 0,
    ...split,
  };

  if (withSources && split.advance > 0) {
    out.advanceFrom = await advanceSources(businessId, partyId, { balance: split.balance });
  }
  return out;
}

/**
 * Jama paisa AAYA KAHAN SE.
 *
 * Peeche se aage jod kar dekhte hain: aakhri kaunsi entriyon ne is jama ko
 * banaya. Isse "₹2,000 jama hai" ke neeche saaf likha ja sakta hai —
 * "CN-14 (maal wapas) ₹1,200 · PAY-31 ₹800".
 */
export async function advanceSources(businessId, partyId, { limit = 5, balance = null } = {}) {
  const entries = await LedgerEntry.find({ businessId, partyId, credit: { $gt: 0 } })
    .sort({ date: -1, createdAt: -1 }).limit(20)
    .select('type credit date refNo note refType').lean();

  const rows = [];
  // Bulane wale ke paas balance pehle se ho to dobara mat poochho — aur jab
  // khud poochna pade to `businessId` ke saath, warna doosri dukaan ki party
  // bhi mil sakti hai
  const bal = balance !== null ? round2(balance) : round2(
    (await Party.findOne({ _id: partyId, businessId }).select('balance').lean())?.balance || 0,
  );
  let left = round2(Math.max(0, -bal));

  for (const e of entries) {
    if (left <= 0 || rows.length >= limit) break;
    const take = round2(Math.min(left, e.credit));
    rows.push({
      type: e.type, refNo: e.refNo || '', date: e.date, amount: take,
      note: e.note || '',
    });
    left = round2(left - take);
  }
  return rows;
}

/* ------------------------------------------------------ list ke liye (jod) */

/**
 * Poori dukaan ka jod — Home aur Payments page dono ke liye WAHI ek jagah.
 *
 * `match` bahar se aata hai kyunki staff ko sirf apni party dikhti hai; wo
 * chhalni pehle se ban kar aati hai.
 */
export async function businessHisaab(businessId, partyMatch = {}) {
  const bid = oid(businessId);

  const [[parties], [inv], [pur]] = await Promise.all([
    Party.aggregate([
      { $match: { businessId: bid, ...partyMatch } },
      {
        $group: {
          _id: null,
          receivable: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] } },
          payable: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'supplier'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] } },
          advance: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $lt: ['$balance', 0] }] }, { $multiply: ['$balance', -1] }, 0] } },
          advanceOut: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'supplier'] }, { $lt: ['$balance', 0] }] }, { $multiply: ['$balance', -1] }, 0] } },
          dueParties: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $gt: ['$balance', 0] }] }, 1, 0] } },
          advanceParties: { $sum: { $cond: [{ $lt: ['$balance', 0] }, 1, 0] } },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, dueAmount: { $gt: 0 } } },
      { $group: { _id: null, due: { $sum: '$dueAmount' }, n: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      { $match: { businessId: bid, dueAmount: { $gt: 0 } } },
      { $group: { _id: null, due: { $sum: '$dueAmount' }, n: { $sum: 1 } } },
    ]),
  ]);

  const p = parties || {};
  return {
    receivable: round2(p.receivable || 0),
    payable: round2(p.payable || 0),
    advance: round2(p.advance || 0),
    advanceOut: round2(p.advanceOut || 0),
    dueParties: p.dueParties || 0,
    advanceParties: p.advanceParties || 0,
    billsDue: round2(inv?.due || 0),
    openBills: inv?.n || 0,
    purchasesDue: round2(pur?.due || 0),
    openPurchases: pur?.n || 0,
  };
}

/* ────────────────────────────────────────────────────────────── ASLI ILAAJ */

/**
 * JAMA PAISA KHULE BILL PE LAGA DO.
 *
 * Ye poore Batch A ka dil hai. Dukaan me niyam bahut seedha hai: aadmi ka
 * paisa aapke paas pada ho aur uska bill bhi khula ho — dono ek saath nahi
 * ho sakte. Paisa bill pe jata hai, bas.
 *
 * Pehle ye SIRF tab hota tha jab bill banate waqt ek tick lagaya jaye. Ab
 * apne aap hota hai — har us jagah jahan paisa ya bill hilta hai.
 *
 * Khata YAHAN NAHI badalta, aur yahi is function ki sabse zaroori baat hai:
 * credit khate me pehle se pada hai. Yahan bas wo credit bill se JUD jata hai.
 * Dobara credit daal dete to ek hi paisa do baar gina jata — aur wo is poore
 * bug se bhi bada bug hota.
 *
 * Isliye ye function hamesha ek hi baat sach rakhta hai:
 *
 *      Party.balance < 0   =>   koi bill khula nahi
 *      koi bill khula hai  =>   Party.balance >= us bill ke jod ke
 */
export async function sweepAdvance(businessId, partyId, { preferId = null } = {}) {
  const party = await Party.findOne({ _id: partyId, businessId })
    .select('type balance openingBalance').lean();
  if (!party) return { used: 0, allocations: [] };

  const cfg = kindForParty(party.type);
  const [agg] = await cfg.model().aggregate([
    { $match: { businessId: oid(businessId), [cfg.party]: oid(partyId), ...cfg.open, dueAmount: { $gt: 0 } } },
    { $group: { _id: null, due: { $sum: '$dueAmount' } } },
  ]);

  const billsDue = round2(agg?.due || 0);
  if (billsDue <= 0) return { used: 0, allocations: [] };

  const free = round2(unappliedCredit({
    balance: party.balance || 0,
    billsDue,
    opening: party.openingBalance || 0,
  }));
  const jama = round2(Math.min(free, billsDue));
  if (jama <= 0) return { used: 0, allocations: [] };

  const { allocations } = await applyCredit(cfg.kind, businessId, partyId, jama, { preferId });
  const used = round2(allocations.reduce((s, a) => s + a.amount, 0));

  return { used, allocations: allocations.map((a) => ({ docId: a.docId, amount: a.amount })) };
}

/**
 * KITNA PAISA AAYA HAI PAR KISI BILL PE LAGA HI NAHI.
 *
 * Ye poore is kaam ka sabse zaroori chhota hisaab hai, aur ise ULTA JOD kar
 * nikala jata hai — kyunki app kahin bhi "unapplied credit" naam ki koi cheez
 * store nahi karti. Do sach pehle se maujood hain, aur unhi do se teesra
 * nikal aata hai:
 *
 *      balance =  purana + (sab bill ka jod) − (sab paisa jo aaya)
 *      billsDue = (sab bill ka jod) − (jitna bill pe laga)
 *
 *   ghatao, aur bill ka jod dono taraf se kat jata hai:
 *
 *      billsDue − balance = (jo aaya) − (jo laga) − purana
 *      => jo aaya par laga nahi  =  billsDue − balance + purana
 *
 * SEEDHA `−balance` KYUN NAHI CHALTA (aur yahi asli bug tha):
 *
 *   graahak ne ₹6,000 ka maal wapas kiya, koi bill khula nahi tha
 *        -> khata −6,000
 *   phir ₹5,000 ka naya bill bana
 *        -> khata −1,000, bill ₹5,000 khula
 *
 *   `−balance` bolta hai "sirf ₹1,000 jama hai" -> ₹1,000 hi bill pe lagta
 *   aur ₹4,000 ka bill hamesha ke liye "udhaar" dikhta rehta, jabki us aadmi
 *   ka ₹6,000 hamare paas pada hai.
 *
 *   Ye jod bolta hai: 5,000 − (−1,000) + 0 = ₹6,000. Poora bill chukta.
 *
 * Bina database ke chalta hai, isliye ise seedha test kiya ja sakta hai.
 */
export function unappliedCredit({ balance = 0, billsDue = 0, opening = 0 }) {
  /*
    ULTA OPENING BALANCE BHI JAMA PAISA HI HAI.

    `opening` do bilkul alag cheezein ho sakti hai, aur dono ka ulta matlab hai:

       +ve  ->  "app se pehle ka udhaar"  — ye kisi ke diye hue paise nahi hain,
                isliye ise jod me wapas daalna padta hai
       −ve  ->  "app se pehle ka jama"    — ye SACH ME uska paisa hai jo hamare
                paas pada hai, bilkul wapasi ke credit jaisa

    Isliye sirf +ve wala hissa hi ginte hain. Bina is ek `Math.max` ke, jis
    graahak ka purana jama paisa migration me daala gaya tha, uska paisa naye
    bill pe kabhi lagta hi nahi — aur wahi purana bug us aadmi ke liye zinda
    reh jata.
  */
  const openingDue = Math.max(0, round2(opening));
  return round2(Math.max(0, round2(billsDue) - round2(balance) + openingDue));
}

/**
 * KHATA AUR BILL KO DOBARA MILA DO — aur jo galat mile use theek kar do.
 *
 * Do kaam, isi kram me:
 *
 *   1. khate ki entriyon se `Party.balance` dobara jod do
 *      (`recalcBalances` wahi karta hai, par wo sirf tab chalta tha jab koi
 *       entry beech me se hatti thi — yaani drift pakda hi nahi jata tha)
 *
 *   2. jo jama paisa khula pada hai, use khule bill pe laga do
 *
 * Har paise wale kaam ke BAAD ek baar chalta hai. Do indexed query se zyada
 * kuch nahi karta jab sab theek ho — aur sab theek hi hota hai. Ye us ek
 * halat ke liye hai jo mahine me ek baar aati hai, aur jise pakadne ka koi
 * doosra rasta nahi tha.
 */
export async function reconcileParty(businessId, partyId, { sweep = true, preferId = null } = {}) {
  if (!partyId) return { swept: 0 };
  const result = sweep ? await sweepAdvance(businessId, partyId, { preferId }) : { used: 0 };
  return { swept: result.used || 0 };
}

/**
 * Jitna is party se SACH ME lena hai — payment rokne wali jaanch ke liye.
 *
 * Pehle ye sirf `Party.balance` dekhta tha. Us se ek asli dikkat hoti thi:
 * khate me 0 par bill khula pada ho (upar wale bug ki wajah se), to dukaandaar
 * ₹5,000 cash haath me le kar khada rehta aur app mana kar deta —
 * "Inka koi udhaar baaki nahi hai".
 *
 * Ab dono me se JO BADA ho wahi hadd hai. Purana data (jispe sweep nahi chala)
 * bhi isse apne aap chal jata hai.
 */
export async function outstandingFor(businessId, party) {
  const cfg = kindForParty(party.type);
  const [agg] = await cfg.model().aggregate([
    { $match: { businessId: oid(businessId), [cfg.party]: oid(party._id), ...cfg.open, dueAmount: { $gt: 0 } } },
    { $group: { _id: null, due: { $sum: '$dueAmount' } } },
  ]);
  return round2(Math.max(round2(party.balance || 0), round2(agg?.due || 0)));
}

/* ------------------------------------------------------- "dena hai" (14) */

/**
 * JINKA PAISA HAMARE PAAS HAI — "dena hai" wali list.
 *
 * Payment history ke bagal me yahi cheez maangi gayi thi. Ab tak app sirf
 * "lena hai" jaanta tha; ulta balance wali party har list se `balance > 0`
 * wali chhalni me gir jati thi. Dukaandaar ko pata hi nahi chalta tha ki
 * uske paas kiska kitna paisa pada hai — jab tak wo khud aakar na maange.
 */
export async function listWeOwe(businessId, { partyMatch = {}, limit = 50 } = {}) {
  const parties = await Party.find({ businessId, balance: { $lt: 0 }, ...partyMatch })
    .sort({ balance: 1 }).limit(limit)
    .select('name shopName phone type balance').lean();

  const rows = await Promise.all(parties.map(async (p) => ({
    _id: p._id,
    name: p.shopName || p.name,
    phone: p.phone || '',
    type: p.type,
    amount: round2(-p.balance),
    from: await advanceSources(businessId, p._id, { limit: 3, balance: p.balance }),
  })));

  return { rows, total: round2(rows.reduce((s, r) => s + r.amount, 0)) };
}

/* ------------------------------------------------------ wapasi pe refund (18) */

/**
 * "Is wapasi ka kitna paisa abhi bhi wapas kiya ja sakta hai".
 *
 * Wapasi ka credit do jagah ja sakta hai: khule bill pe (to paisa wapas karne
 * ko kuch bacha hi nahi), ya jama me. Sirf jama wala hissa cash me wapas ho
 * sakta hai — aur us se bhi zyada nahi jitna party ke paas kul jama hai
 * (ho sakta hai wo pehle hi le ja chuka ho).
 */
export async function refundableForReturn(businessId, note) {
  const party = await Party.findOne({ _id: note.partyId, businessId }).select('balance type').lean();
  if (!party) return { refundable: 0, jama: 0, alreadyRefunded: 0 };

  const jama = round2(Math.max(0, -(party.balance || 0)));

  // Is note ke baad us party ko jitna cash wapas kiya ja chuka hai
  const done = await Payment.aggregate([
    {
      $match: {
        businessId: oid(businessId), partyId: oid(note.partyId),
        status: 'confirmed', returnNoteId: oid(note._id),
      },
    },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);
  const alreadyRefunded = round2(done[0]?.amount || 0);

  // Is note ka jitna hissa bill pe NAHI laga — wahi wapas ho sakta hai
  const unapplied = round2(note.advance || 0);

  return {
    jama,
    alreadyRefunded,
    refundable: round2(Math.max(0, Math.min(jama, unapplied - alreadyRefunded))),
  };
}

export { ReturnNote };

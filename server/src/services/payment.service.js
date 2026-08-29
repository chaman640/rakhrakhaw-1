import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  PARTY_TYPES, LEDGER_TYPES, PAYMENT_STATUS, COUNTER_KEYS, NOTIFICATION_TYPES,
} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import {
  Payment, Party, Invoice, Counter, Business, LedgerEntry, Order, ReturnNote,
} from '../models/index.js';
import {
  scopeByParty, scopePartiesMatch, isScoped, canSeeDoc, ownPartyIds, toObjectIds,
} from '../utils/scope.js';
import { postEntry, reverseEntriesFor, recalcBalances } from './ledger.service.js';
import { applyCredit, applyPaidAtomic as settleApply } from './settlement.service.js';
import {
  outstandingFor, sweepAdvance, listWeOwe, refundableForReturn, businessHisaab,
} from './balance.service.js';
import { notifyWholesaler, notifyRetailer } from './notification.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ list */

/** Hadd wale staff ke liye: ye payment iske retailer ka hai bhi ya nahi */
async function assertCanTouch(businessId, id, viewer) {
  if (!isScoped(viewer)) return;
  const doc = await Payment.findOne({ _id: id, businessId }).select('partyId createdBy').lean();
  if (!(await canSeeDoc(doc, businessId, viewer))) {
    throw ApiError.notFound('Payment nahi mila');
  }
}

export async function listPayments(businessId, q, viewer = null) {
  let filter = { businessId };
  if (q.partyId) filter.partyId = q.partyId;
  if (q.direction !== 'all') filter.direction = q.direction;
  if (q.mode !== 'all') filter.mode = q.mode;
  if (q.status !== 'all') filter.status = q.status;

  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = q.from;
    if (q.to) { const t = new Date(q.to); t.setHours(23, 59, 59, 999); filter.date.$lte = t; }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const parties = await Party.find({ businessId, $or: [{ name: rx }, { shopName: rx }, { phone: rx }] })
      .select('_id').lean();
    filter.$or = [{ paymentNo: rx }, { reference: rx }, { partyId: { $in: parties.map((p) => p._id) } }];
  }

  // Bill ki tarah yahan bhi hadd lagti hai — paisa kis party se aaya, ye bhi
  // utni hi niji baat hai (dekho invoice.service.js me isi jagah ka note)
  filter = await scopeByParty(filter, businessId, viewer, { alsoMine: true });

  const skip = (q.page - 1) * q.limit;
  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(q.limit)
      .populate('partyId', 'name shopName phone type').lean(),
    Payment.countDocuments(filter),
  ]);

  return {
    payments: payments.map((p) => ({
      ...p,
      party: p.partyId ? {
        _id: p.partyId._id, name: p.partyId.shopName || p.partyId.name,
        phone: p.partyId.phone, type: p.partyId.type,
      } : null,
      partyId: p.partyId?._id || p.partyId,
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function getStats(businessId, viewer = null) {
  const bid = new mongoose.Types.ObjectId(businessId);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const mine = isScoped(viewer)
    ? { $or: [
      { partyId: { $in: toObjectIds(await ownPartyIds(businessId, viewer)) } },
      { createdBy: viewer._id },
    ] }
    : {};

  /*
    "Kul lena hai" — Payment page ka sabse bada number.

    Ye Party.balance se aata hai, bill ke jod se nahi: khate me purana hisaab
    (opening) aur advance bhi ginte hain, aur dukaandaar ke liye "lena hai"
    matlab wahi khata hai. Hadd yahan bhi lagti hai, warna page ke upar poori
    dukaan ka udhaar dikhta aur neeche ki list sirf apni — aadha sach.
  */
  const [[today], [month], [pending], [receivable]] = await Promise.all([
    Payment.aggregate([
      { $match: { businessId: bid, ...mine, status: 'confirmed', direction: 'IN', date: { $gte: todayStart } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { businessId: bid, ...mine, status: 'confirmed', direction: 'IN', date: { $gte: monthStart } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { businessId: bid, ...mine, status: 'pending' } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Party.aggregate([
      { $match: scopePartiesMatch({ businessId: bid, type: PARTY_TYPES.RETAILER }, viewer) },
      {
        $group: {
          _id: null,
          n: { $sum: { $cond: [{ $gt: ['$balance', 0] }, 1, 0] } },
          amount: { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
          // Jama paisa — ulta balance. Isi ek ginti ke na hone se ye paisa
          // poori app me kahin dikhta hi nahi tha.
          advance: { $sum: { $cond: [{ $lt: ['$balance', 0] }, { $multiply: ['$balance', -1] }, 0] } },
          advanceParties: { $sum: { $cond: [{ $lt: ['$balance', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  /*
    Bade number ke neeche uski TOD-PHOD.

    "Kul lena hai ₹4,20,000" ke saath ab ye bhi jata hai ki usme se kitna
    khule bill ka hai. Pehle Payments page ye number dikhata tha aur Bills
    page ek doosra — dono sahi, par dukaandaar ke liye do alag jawab. Ab wahi
    hisaab dono jagah se aata hai (balance.service).
  */
  /*
    Hadd wale staff ko bill ka jod NAHI bhejte.

    Uski party ki list to chhanti hai, par khule bill ka jod poori dukaan ka
    hota — yaani salesman ko chhupa hua total dikh jata. Aisi halat me ye
    khaana hi nahi bhejte; screen bas bada number dikhati hai, tod-phod nahi.
  */
  const hisaab = isScoped(viewer) ? null : await businessHisaab(businessId);

  return {
    todayCount: today?.n || 0,
    todayAmount: round2(today?.amount || 0),
    monthCount: month?.n || 0,
    monthAmount: round2(month?.amount || 0),
    pendingCount: pending?.n || 0,
    pendingAmount: round2(pending?.amount || 0),
    totalReceivable: round2(receivable?.amount || 0),
    dueParties: receivable?.n || 0,
    totalAdvance: round2(receivable?.advance || 0),
    advanceParties: receivable?.advanceParties || 0,
    ...(hisaab ? { billsDue: hisaab.billsDue, openBills: hisaab.openBills } : {}),
  };
}

export async function getPayment(businessId, id, { partyId = null, viewer = null } = {}) {
  const filter = { _id: id, businessId };
  if (partyId) filter.partyId = partyId;
  const payment = await Payment.findOne(filter).populate('partyId', 'name shopName phone type').lean();
  if (!payment) throw ApiError.notFound('Payment nahi mili');
  return { ...payment, party: payment.partyId, partyId: payment.partyId?._id || payment.partyId };
}

/* ------------------------------------------------------ invoice allocation */

/**
 * Bill pe paisa ghatane/badhane ka ek hi rasta — ab wo `settlement.service.js`
 * me hai, kyunki wahi kaam wapasi (return) ko bhi karna padta hai.
 *
 * Pehle ye sirf yahan tha, aur isi wajah se return kabhi bill ko chhuti hi
 * nahi thi: uske paas is darwaze ki chaabi thi hi nahi.
 */
const applyPaidAtomic = (businessId, invoiceId, delta, opts) =>
  settleApply('Invoice', businessId, invoiceId, delta, opts);

export async function allocateToInvoices(businessId, partyId, amount) {
  const { allocations, left } = await applyCredit('Invoice', businessId, partyId, amount);
  const rows = allocations.map((a) => ({ invoiceId: a.docId, amount: a.amount }));
  return { allocations: rows, allocatedTo: rows.map((a) => a.invoiceId), advance: left };
}

/**
 * Payment delete/reject hone par allocation wapas kholo.
 *
 * Nayi payments me `allocations` hai — kis bill pe kitna laga tha, likha hua.
 * Purani payments me sirf `againstInvoiceIds` hai, unke liye purana (andaze wala)
 * tarika chalta hai.
 */
async function deallocate(businessId, payment) {
  /*
    Supplier ki payment me `allocations[].invoiceId` ke andar PURCHASE ki id
    padi hoti hai — khaane ka naam purana hai, matlab nahi.

    Isliye party ka type dekh kar tay karte hain ki kis collection me wapas
    karna hai. Pehle yahan hamesha 'Invoice' jata tha: Purchase ki id Invoice
    me dhoondhi jati, kuch milta hi nahi, aur reversal BINA KISI ERROR ke
    gayab ho jata. Nateeja — supplier ki payment delete karo to khata theek ho
    jata par purchase hamesha "chukta" dikhati rehti.
  */
  const party = await Party.findOne({ _id: payment.partyId, businessId })
    .select('type').lean();
  const kind = party?.type === PARTY_TYPES.SUPPLIER ? 'Purchase' : 'Invoice';

  const rows = (payment.allocations || []).filter((a) => a.invoiceId && a.amount > 0);

  if (rows.length) {
    for (const a of rows) {
      await settleApply(kind, businessId, a.invoiceId, -a.amount);
    }
    return;
  }

  // Purana data sirf Invoice wali taraf tha
  if (kind !== 'Invoice') return;

  // ---- purana data ----
  if (!payment.againstInvoiceIds?.length) return;

  let left = round2(payment.amount);
  const invoices = await Invoice.find({ _id: { $in: payment.againstInvoiceIds }, businessId })
    .sort({ invoiceDate: -1 }).lean();

  for (const inv of invoices) {
    if (left <= 0) break;
    const take = round2(Math.min(left, inv.paidAmount));
    if (take <= 0) continue;
    await applyPaidAtomic(businessId, inv._id, -take);
    left = round2(left - take);
  }
}

/**
 * Payment ki khata entry ulti karo.
 *
 * Nayi payments ki entry `refType: 'Payment'` ke saath banti hai — bill ke saath
 * aayi payment ki bhi.
 *
 * Purane data me bill wali payment ki entry `refType: 'Invoice'` ke saath thi.
 * Usse pehchanna aasan hai: bill ka apna entry `type: 'INVOICE'` hota hai aur
 * payment ka `PAYMENT_IN`/`PAYMENT_OUT` — isliye galti se bill ka entry nahi hatega.
 *
 * Yahi wo chhed tha jiski wajah se payment delete karne pe bill to theek ho jata tha
 * par khate me credit pada reh jata tha.
 */
async function reverseLedgerForPayment(businessId, payment, userId) {
  const { reversed } = await reverseEntriesFor({
    businessId, refType: 'Payment', refId: payment._id, userId,
  });
  if (reversed) return reversed;

  const invoiceIds = [
    ...(payment.sourceInvoiceId ? [payment.sourceInvoiceId] : []),
    ...(payment.againstInvoiceIds || []),
  ];
  if (!invoiceIds.length) return 0;

  const legacy = await LedgerEntry.findOne({
    businessId,
    partyId: payment.partyId,
    refType: 'Invoice',
    refId: { $in: invoiceIds },
    type: payment.direction === 'IN' ? LEDGER_TYPES.PAYMENT_IN : LEDGER_TYPES.PAYMENT_OUT,
    credit: payment.amount,
  }).select('_id').lean();

  if (!legacy) return 0;

  await LedgerEntry.deleteOne({ _id: legacy._id });
  await recalcBalances(businessId, payment.partyId);
  return 1;
}

/**
 * Bill cancel hone par uspe lagi payments ko chhodna.
 *
 * DHYAN: payment DELETE nahi hoti — paisa to sach me aaya tha. Bas is bill ka
 * hissa hata kar wo paisa doosre khule bill pe laga diya jata hai (FIFO), aur
 * kuch bacha to advance ban jata hai.
 *
 * Pehle yahan `Payment.deleteMany({ againstInvoiceIds })` tha — wo har us payment
 * ko uda deta tha jiska kuch hissa is bill pe laga tha, chahe wo mahine baad aayi ho.
 */
export async function releaseInvoiceFromPayments(businessId, invoice, paidBefore) {
  const payments = await Payment.find({
    businessId,
    status: PAYMENT_STATUS.CONFIRMED,
    sourceInvoiceId: { $ne: invoice._id },
    $or: [{ 'allocations.invoiceId': invoice._id }, { againstInvoiceIds: invoice._id }],
  });

  let released = 0;

  for (const p of payments) {
    const rows = (p.allocations || []).filter((a) => a.invoiceId);
    let freed;

    if (rows.length) {
      freed = round2(rows
        .filter((a) => String(a.invoiceId) === String(invoice._id))
        .reduce((s, a) => s + (a.amount || 0), 0));
      p.allocations = rows.filter((a) => String(a.invoiceId) !== String(invoice._id));
    } else {
      // Purana data — kitna laga tha likha hi nahi hai. Jitna is bill pe pada tha
      // usse zyada nahi ho sakta, aur payment se bhi zyada nahi.
      freed = round2(Math.min(p.amount, paidBefore || 0));
      p.allocations = [];
      p.againstInvoiceIds = (p.againstInvoiceIds || [])
        .filter((x) => String(x) !== String(invoice._id));
    }

    if (freed > 0) {
      const { allocations } = await allocateToInvoices(businessId, p.partyId, freed);
      p.allocations = [...p.allocations, ...allocations];
      released = round2(released + freed);
    }

    p.againstInvoiceIds = p.allocations.map((a) => a.invoiceId);
    await p.save();
  }

  return released;
}

/** Bill cancel hone par uske SAATH aayi payment ko hatana (ye sach me delete hoti hai) */
export async function removeInlinePayments(businessId, invoice, userId) {
  const payments = await Payment.find({
    businessId,
    $or: [
      { sourceInvoiceId: invoice._id },
      // purana data: bill ke saath bani payment ka note aisa hota tha
      { againstInvoiceIds: invoice._id, note: `${invoice.invoiceNo} ke saath` },
    ],
  });

  let removed = 0;
  for (const p of payments) {
    if (p.status === PAYMENT_STATUS.CONFIRMED) {
      await deallocate(businessId, p);
      await reverseLedgerForPayment(businessId, p, userId);
    }
    await p.deleteOne();
    removed = round2(removed + p.amount);
  }
  return removed;
}

/* ---------------------------------------------------------------- create */

/**
 * Wholesaler khud entry kar raha hai — seedha confirmed.
 * direction IN  = retailer se paisa aaya
 * direction OUT = supplier ko paisa diya
 */
/**
 * "Itna to baaki hi nahi" — zyada paisa pe rok.
 *
 * Pehle koi rok thi hi nahi: ₹5,000 ka udhaar tha aur ₹50,000 ki entry ho
 * jati thi. Bacha hua paisa chup-chaap "advance" ban jata tha — kahin dikhta
 * nahi tha, aur aksar wo asli advance hota bhi nahi tha, sirf ungli se ek
 * zero zyada dab gaya hota tha. Mahine baad khata milane baithe to samajh hi
 * nahi aata tha ki ye paisa aaya kahan se.
 *
 * Ab rok lagti hai — par darwaza band nahi hota. Jawab me poora hisaab jata
 * hai (`extra`, `outstanding`), taaki app poochh sake: "₹3,000 zyada hai.
 * Jama kar dein?" Haan dabate hi wahi request `allowAdvance: true` ke saath
 * dobara jati hai aur paisa saaf-saaf jama ban jata hai.
 *
 * Yaani advance ab ek FAISLA hai, ek haadsa nahi.
 */
function assertNotOverpaying({ amount, outstanding, allowAdvance, kaunsa = 'udhaar' }) {
  const extra = round2(amount - outstanding);
  if (extra <= 0 || allowAdvance) return round2(Math.max(0, extra));

  throw ApiError.badRequest(
    outstanding <= 0
      ? `Inka koi ${kaunsa} baaki nahi hai. Ye ₹${round2(amount)} jama karna ho to "Jama kar dein" dabaein.`
      : `${kaunsa} sirf ₹${outstanding} hai — ₹${extra} zyada hai. Jama karna ho to "Jama kar dein" dabaein.`,
    { extra, outstanding: round2(outstanding), amount: round2(amount), needsAdvance: true },
  );
}

export async function createPayment(businessId, payload, userId) {
  const party = await Party.findOne({ _id: payload.partyId, businessId }).lean();
  if (!party) throw ApiError.badRequest('Party nahi mili');

  const direction = payload.direction || (party.type === PARTY_TYPES.SUPPLIER ? 'OUT' : 'IN');

  const { number: paymentNo } = await Counter.nextNumber({
    businessId, key: COUNTER_KEYS.PAYMENT, prefix: 'PAY', date: payload.date || new Date(),
  });

  const amount = round2(payload.amount);
  let allocation = { allocations: [], allocatedTo: [], advance: amount };

  if (direction === 'IN' && party.type === PARTY_TYPES.RETAILER) {
    /*
      Hadd BILL ke jod se nahi, KHATE se lagti hai.

      Khate me purana hisaab (opening) bhi hota hai aur pichhli wapasi ka
      credit bhi. Sirf khule bill jodne se ek aadmi jiska purana udhaar khate
      me pada hai, uska paisa "zyada" bata kar rok diya jata — jo galat hai.
    */
    /*
      HADD AB DONO ME SE JO BADA HO — khata ya khule bill.

      Pehle sirf `party.balance` dekhta tha, aur wahi ek asli rukawat ban gaya
      tha. Purane data me (jab jama paisa apne aap bill pe nahi lagta tha) aisi
      halat ban jati thi: khata 0, aur bill ₹5,000 khula. Dukaandaar ₹5,000
      cash haath me le kar khada rehta aur app mana kar deta —
      "Inka koi udhaar baaki nahi hai". Paisa aa chuka tha, entry ho hi nahi
      pati thi.

      `outstandingFor` dono dekhta hai. Naye data me dono barabar hi hote hain
      (`sweepAdvance` ki wajah se), aur purana data bhi bina kisi migration ke
      apne aap chal jata hai.
    */
    assertNotOverpaying({
      amount,
      outstanding: await outstandingFor(businessId, party),
      allowAdvance: payload.allowAdvance === true,
    });
    allocation = await allocateToInvoices(businessId, party._id, amount);
  }

  /*
    PAISA WAPAS KARNA (refund) — ULTI TARAF KA HISAAB.

    Ab tak har payment khate me CREDIT daalti thi, chahe kaisi bhi ho. Retailer
    ke liye wo theek hai (paisa aaya -> udhaar ghata) aur supplier ke liye bhi
    (paisa diya -> dena ghata). Par jab jama paisa WAPAS karna ho — yaani
    retailer ko paisa DENA ho — tab bhi credit hi jata tha, aur uska jama paisa
    ghatne ki jagah BADH jata tha. Yaani paisa haath se bhi gaya aur khate me
    bhi hum aur karzdaar ho gaye.

    Isliye ab do sawal alag alag hain:
      "kis taraf paisa gaya"        -> direction
      "us party ka hisaab badha ya ghata" -> neeche wala niyam

    Ulti taraf ka paisa = wapasi. Wo DEBIT hai, credit nahi.
  */
  const chalanTaraf = party.type === PARTY_TYPES.SUPPLIER ? 'OUT' : 'IN';
  const isRefund = direction !== chalanTaraf;

  if (isRefund) {
    // Jitna jama hai usse zyada wapas nahi ho sakta
    const jama = round2(Math.max(0, -(party.balance || 0)));
    if (amount > jama) {
      throw ApiError.badRequest(
        jama <= 0
          ? 'Inka koi jama paisa hai hi nahi — wapas karne ko kuch nahi hai.'
          : `Jama sirf ₹${jama} hai — ₹${round2(amount - jama)} zyada hai.`,
        { jama, amount },
      );
    }
  }

  if (!isRefund && direction === 'OUT' && party.type === PARTY_TYPES.SUPPLIER) {
    assertNotOverpaying({
      amount,
      outstanding: await outstandingFor(businessId, party),
      allowAdvance: payload.allowAdvance === true,
      kaunsa: 'dena',
    });
    const applied = await applyCredit('Purchase', businessId, party._id, amount);
    allocation = {
      allocations: applied.allocations.map((a) => ({ invoiceId: a.docId, amount: a.amount })),
      allocatedTo: applied.allocations.map((a) => a.docId),
      advance: applied.left,
    };
  }

  const payment = await Payment.create({
    businessId, partyId: party._id, paymentNo,
    date: payload.date || new Date(),
    direction, amount,
    mode: payload.mode || 'CASH',
    reference: payload.reference || '',
    status: PAYMENT_STATUS.CONFIRMED,
    confirmedAt: new Date(),
    confirmedBy: userId,
    allocations: allocation.allocations,
    againstInvoiceIds: allocation.allocatedTo,
    // Kis wapasi ka paisa wapas kiya — taaki wahi paisa dobara na diya ja sake
    returnNoteId: isRefund ? (payload.returnNoteId || null) : null,
    note: payload.note || '',
    recordedBy: userId,
  });

  // Khata: seedhi taraf ka paisa hisaab GHATATA hai, ulti taraf ka BADHATA hai
  await postEntry({
    businessId, partyId: party._id,
    type: direction === 'IN' ? LEDGER_TYPES.PAYMENT_IN : LEDGER_TYPES.PAYMENT_OUT,
    ...(isRefund ? { debit: amount } : { credit: amount }),
    date: payment.date,
    refType: 'Payment', refId: payment._id, refNo: paymentNo,
    note: payload.note
      || (isRefund ? 'Jama paisa wapas' : (payload.mode === 'CASH' ? 'Cash' : payload.mode)),
    userId,
  });

  if (direction === 'IN') {
    await notifyRetailer(businessId, party._id, {
      type: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
      title: `Payment mil gaya — ${paymentNo}`,
      body: `${amount} ${payload.mode || 'CASH'} se`,
      link: '/my-khata',
      data: { paymentId: payment._id },
    });
  }

  /*
    Bacha hua paisa kisi khule bill pe rah to nahi gaya — ek baar aur dekh lo.

    Aam haalat me yahan kuch nahi hota (`allocateToInvoices` upar hi sab laga
    chuka hota hai). Ye us PURANE data ke liye hai jo is fix se pehle bana tha:
    jaise hi us party pe koi bhi paisa hilta hai, uska bigda hua hisaab apne
    aap seedha ho jata hai. Bina kisi migration ke, bina kisi ko bataye.
  */
  await sweepAdvance(businessId, party._id);

  return { payment: await getPayment(businessId, payment._id), advance: allocation.advance };
}

/* ------------------------------------------------- retailer ka UPI claim */

/**
 * Retailer ne UPI se bheja aur "maine bhej diya" dabaya.
 * Abhi PENDING hai — khate me kuch nahi jata. Wholesaler confirm karega tabhi.
 */
export async function claimPayment(businessId, partyId, payload, userId) {
  const business = await Business.findById(businessId).select('upiId').lean();
  if (!business?.upiId) throw ApiError.badRequest('Wholesaler ne abhi UPI set nahi kiya');

  const party = await Party.findOne({ _id: partyId, businessId }).select('name shopName').lean();
  if (!party) throw ApiError.notFound('Aapki dukaan ki entry nahi mili');

  const { number: paymentNo } = await Counter.nextNumber({
    businessId, key: COUNTER_KEYS.PAYMENT, prefix: 'PAY',
  });

  const payment = await Payment.create({
    businessId, partyId, paymentNo,
    date: new Date(),
    direction: 'IN',
    amount: round2(payload.amount),
    mode: 'UPI',
    reference: payload.reference || '',
    status: PAYMENT_STATUS.PENDING,   // <-- khata abhi nahi badlega
    note: payload.note || '',
    recordedBy: userId,
  });

  await notifyWholesaler(businessId, {
    type: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
    title: `UPI payment — ${party.shopName || party.name}`,
    body: `${payload.amount} bheja hai, confirm karein`,
    link: '/payments?status=pending',
    data: { paymentId: payment._id },
  });

  return getPayment(businessId, payment._id, { partyId });
}

/* --------------------------------------------------------------- confirm */

export async function confirmPayment(businessId, id, userId, viewer = null) {
  await assertCanTouch(businessId, id, viewer);
  /**
   * PEHLE JHANDA GAADO, PHIR KAAM KARO.
   *
   * Pehle yahan padho-check-karo-phir-likho tha: `findOne()`, `status === CONFIRMED`
   * check, aur aage badh jao. Button do baar dab jaye (ya net slow ho aur user
   * dobara tap kare) to dono request ne `pending` padha, dono check paas kar gaye,
   * aur dono ne khate me credit daal diya — 5000 ka payment khate me 10000 ban gaya.
   *
   * Ab `findOneAndUpdate` filter me hi `status: PENDING` hai. MongoDB ek document pe
   * ek waqt me ek hi update chalata hai, isliye do me se sirf EK ko document milta
   * hai — doosre ko `null`, aur usse saaf "pehle se confirm hai" bata dete hain.
   */
  const payment = await Payment.findOneAndUpdate(
    { _id: id, businessId, status: PAYMENT_STATUS.PENDING },
    { $set: { status: PAYMENT_STATUS.CONFIRMED, confirmedAt: new Date(), confirmedBy: userId } },
    { new: true }
  );

  if (!payment) {
    const exists = await Payment.findOne({ _id: id, businessId }).select('status').lean();
    if (!exists) throw ApiError.notFound('Payment nahi mili');
    if (exists.status === PAYMENT_STATUS.CONFIRMED) throw ApiError.badRequest('Ye payment pehle se confirm hai');
    throw ApiError.badRequest('Ye payment reject ho chuki hai');
  }

  // Jhanda gad chuka hai. Ab aage kuch gadbad ho to wapas PENDING kar dete hain,
  // warna payment "confirm" dikhegi par khate me kuch hoga hi nahi.
  try {
    // Sirf retailer se aaya paisa hi bill pe lagta hai
    const party = await Party.findOne({ _id: payment.partyId, businessId }).select('type').lean();
    const allocation = payment.direction === 'IN' && party?.type === PARTY_TYPES.RETAILER
      ? await allocateToInvoices(businessId, payment.partyId, payment.amount)
      : { allocations: [], allocatedTo: [], advance: payment.amount };

    payment.allocations = allocation.allocations;
    payment.againstInvoiceIds = allocation.allocatedTo;
    await payment.save();

    await postEntry({
      businessId, partyId: payment.partyId,
      type: payment.direction === 'IN' ? LEDGER_TYPES.PAYMENT_IN : LEDGER_TYPES.PAYMENT_OUT,
      credit: payment.amount,
      date: payment.date,
      refType: 'Payment', refId: payment._id, refNo: payment.paymentNo,
      note: payment.reference ? `UPI ${payment.reference}` : 'UPI',
      userId,
    });
  } catch (err) {
    await Payment.updateOne(
      { _id: payment._id, businessId },
      { $set: { status: PAYMENT_STATUS.PENDING, confirmedAt: null, confirmedBy: null } }
    );
    throw err;
  }

  await sweepAdvance(businessId, payment.partyId);

  await notifyRetailer(businessId, payment.partyId, {
    type: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
    title: `Payment confirm ho gaya — ${payment.paymentNo}`,
    body: `${payment.amount} khate me lag gaya`,
    link: '/my-khata',
    data: { paymentId: payment._id },
  });

  return getPayment(businessId, id);
}

export async function rejectPayment(businessId, id, { reason }, userId, viewer = null) {
  await assertCanTouch(businessId, id, viewer);
  // Confirm ki tarah yahan bhi jhanda pehle. Warna ek hi payment pe confirm aur
  // reject ek saath chal sakte the: payment "reject" dikhti aur khate me credit
  // pada reh jata.
  const payment = await Payment.findOneAndUpdate(
    { _id: id, businessId, status: PAYMENT_STATUS.PENDING },
    { $set: { status: PAYMENT_STATUS.FAILED } },
    { new: true }
  );

  if (!payment) {
    const exists = await Payment.findOne({ _id: id, businessId }).select('status').lean();
    if (!exists) throw ApiError.notFound('Payment nahi mili');
    throw ApiError.badRequest('Sirf pending payment reject ho sakti hai');
  }

  payment.note = [payment.note, `REJECTED: ${reason || 'paisa nahi mila'}`].filter(Boolean).join(' | ');
  await payment.save();

  await notifyRetailer(businessId, payment.partyId, {
    type: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
    title: `Payment reject — ${payment.paymentNo}`,
    body: reason || 'Wholesaler ko paisa nahi mila',
    link: '/my-khata',
    data: { paymentId: payment._id },
  });

  return getPayment(businessId, id);
}

/* ---------------------------------------------------------------- delete */

export async function deletePayment(businessId, id, userId, viewer = null) {
  await assertCanTouch(businessId, id, viewer);
  /**
   * Payment PEHLE hata lete hain (`findOneAndDelete`), phir uska asar ulta karte hain.
   *
   * Do baar delete dab jaye to purana code dono baar ulta kar deta tha — bill se
   * paisa DO baar hat jata tha (5000 wali payment delete karne pe bill pe 10000
   * ka udhaar wapas aa jata). MongoDB ek document ko sirf ek hi baar delete karta
   * hai, isliye doosri request ko `null` milta hai aur wo saaf mana kar deti hai.
   */
  const payment = await Payment.findOneAndDelete({ _id: id, businessId });
  if (!payment) throw ApiError.notFound('Payment nahi mili');

  if (payment.status === PAYMENT_STATUS.CONFIRMED) {
    await deallocate(businessId, payment);

    const reversed = await reverseLedgerForPayment(businessId, payment, userId);
    if (!reversed) {
      // Aisa hona hi nahi chahiye. Chup-chaap khata galat chhodne se behtar hai
      // ki log me dikhe aur khata dobara jod diya jaye.
      console.warn(`[payment] ${payment.paymentNo} ki khata entry nahi mili — khata dobara jod rahe hain`);
      await recalcBalances(businessId, payment.partyId);
    }
  }

  /*
    Agar ye paisa kisi order ke "payment mili" se aaya tha, to us order pe se
    nishaan bhi hatana hai.

    Bina iske order hamesha ke liye "paisa aa gaya" dikhata rehta, jabki khate
    me kuch bhi na hota — aur wahi ek jhooth hai jisse bachne ke liye humne
    order pe alag tick rakha hi nahi tha.
  */
  await Order.updateOne({ businessId, paymentId: payment._id }, { $set: { paymentId: null } });

  /*
    Payment hatne se bill dobara khul gaya hai. Agar us party ka koi aur paisa
    hamare paas jama pada hai, to wo ab is khule bill pe lagna chahiye — warna
    ek taraf bill udhaar dikhata aur doosri taraf uska hi paisa hamare paas
    pada rehta.
  */
  await sweepAdvance(businessId, payment.partyId);

  return {
    deleted: true,
    message: `${payment.paymentNo} hata diya — bill aur khata dono wapas theek kar diye`,
  };
}

/* --------------------------------------------------------- retailer side */

export async function listMyPayments(businessId, partyId, q) {
  return listPayments(businessId, { ...q, partyId: String(partyId) });
}


/* ═══════════════════════════════════════════════ "DENA HAI" — ulti taraf ki list */

/**
 * JINKA PAISA HAMARE PAAS PADA HAI.
 *
 * App abhi tak sirf ek hi taraf jaanta tha — "lena hai". Har list me
 * `balance > 0` wali chhalni lagti thi, isliye jis party ka paisa HAMARE paas
 * jama tha wo har jagah se chup-chaap gir jati thi. Dukaandaar ko pata hi nahi
 * chalta tha ki kiska kitna dena hai, jab tak wo aadmi khud aakar na kahe.
 *
 * Ab payment history ke bagal me yahi list khulti hai — naam, rakam, aur paisa
 * AAYA KAHAN SE (kaunsi wapasi, kaunsi payment). Wahin se seedha wapas bhi
 * kiya ja sakta hai.
 */
export async function listWeOwePayments(businessId, viewer = null) {
  // Hadd wale staff ko sirf apni party — wahi chhalni jo baaki har list pe hai
  return listWeOwe(businessId, { partyMatch: scopePartiesMatch({}, viewer) });
}

/* ══════════════════════════════════════════════ WAPASI KA PAISA WAPAS (item 18) */

/**
 * Maal wapas aaya — ab uska PAISA bhi wapas.
 *
 * Ab tak wapasi sirf khate me credit daalti thi. Wo aadhi baat hai: bahut baar
 * graahak dobara kuch lega hi nahi, use apna paisa cash me chahiye. Uska koi
 * rasta hi nahi tha — dukaandaar galti se "payment" bana deta tha, jo khate me
 * ULTA lagta tha aur uska jama paisa ghatne ki jagah BADH jata tha.
 *
 * Teen rok, teeno zaroori:
 *   1. jitna is wapasi ka paisa bill pe lag chuka hai wo wapas nahi ho sakta
 *      (wo to bill chukane me kharch ho gaya)
 *   2. is wapasi ka paisa DOBARA wapas nahi ho sakta (`returnNoteId` se ginti)
 *   3. party ke paas jitna jama hai us se zyada kabhi nahi
 *
 * Aage ka poora kaam `createPayment` hi karta hai — wahi ek darwaza. Ulti
 * taraf ka paisa wo khud pehchan kar khate me DEBIT daalta hai.
 */
export async function refundReturn(businessId, returnNoteId, payload, userId) {
  const note = await ReturnNote.findOne({ _id: returnNoteId, businessId }).lean();
  if (!note) throw ApiError.notFound('Ye return nahi mila');

  const { refundable, jama, alreadyRefunded } = await refundableForReturn(businessId, note);
  const amount = round2(payload.amount || refundable);

  if (amount <= 0) throw ApiError.badRequest('Wapas karne ko kuch bacha hi nahi');
  if (amount > refundable) {
    throw ApiError.badRequest(
      alreadyRefunded > 0
        ? `Is wapasi ka ₹${alreadyRefunded} pehle hi wapas ho chuka hai — ab sirf ₹${refundable} bacha hai`
        : `Sirf ₹${refundable} wapas ho sakta hai (jama ₹${jama})`,
      { refundable, jama, alreadyRefunded },
    );
  }

  const party = await Party.findOne({ _id: note.partyId, businessId }).select('type').lean();
  if (!party) throw ApiError.badRequest('Party nahi mili');

  /*
    JHANDA PEHLE — wahi pattern jo `confirmPayment` me hai.

    Upar wali ginti (`refundableForReturn`) aur neeche wala `createPayment`
    do alag pal hain. Beech me koi rok na ho to double-tap ya slow net par
    dono request paas ho jati hain aur ASLI CASH DO BAAR bahar chala jata hai.

    `refundLockedAt: null` filter ke andar hai, isliye MongoDB do me se ek hi
    request ko doc deta hai. Doosri ko `null` milta hai aur wo saaf mana kar
    deti hai.
  */
  const locked = await ReturnNote.findOneAndUpdate(
    { _id: note._id, businessId, refundLockedAt: null },
    { $set: { refundLockedAt: new Date() } },
    { new: true },
  );
  if (!locked) {
    throw ApiError.badRequest('Is wapasi ka paisa abhi abhi wapas kiya ja raha hai — ek baar page refresh karke dekh lijiye');
  }

  try {
    return await createPayment(businessId, {
      partyId: note.partyId,
      amount,
      // Retailer ko paisa DENA hai -> OUT. Supplier se paisa LENA hai -> IN.
      direction: party.type === PARTY_TYPES.SUPPLIER ? 'IN' : 'OUT',
      mode: payload.mode || 'CASH',
      reference: payload.reference || '',
      returnNoteId: note._id,
      note: payload.note || `${note.returnNo} ka paisa wapas`,
      date: payload.date,
    }, userId);
  } catch (err) {
    // Paisa gaya hi nahi to jhanda bhi hata do, warna wapasi hamesha ke liye
    // atak jati hai aur usko kholne ka koi rasta nahi bachta
    await ReturnNote.updateOne({ _id: note._id, businessId }, { $set: { refundLockedAt: null } });
    throw err;
  }
}

/** Wapasi ke page pe "kitna wapas ho sakta hai" — button dikhane ke liye */
export async function refundInfo(businessId, returnNoteId) {
  const note = await ReturnNote.findOne({ _id: returnNoteId, businessId }).lean();
  if (!note) throw ApiError.notFound('Ye return nahi mila');
  return { returnNo: note.returnNo, ...(await refundableForReturn(businessId, note)) };
}

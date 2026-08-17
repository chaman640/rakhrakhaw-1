import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  PARTY_TYPES, LEDGER_TYPES, PAYMENT_STATUS, COUNTER_KEYS, NOTIFICATION_TYPES,
} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { Payment, Party, Invoice, Counter, Business, LedgerEntry } from '../models/index.js';
import { scopeByParty, isScoped, canSeeDoc, ownPartyIds, toObjectIds } from '../utils/scope.js';
import { postEntry, reverseEntriesFor, recalcBalances } from './ledger.service.js';
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

  const [[today], [month], [pending]] = await Promise.all([
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
  ]);

  return {
    todayCount: today?.n || 0,
    todayAmount: round2(today?.amount || 0),
    monthCount: month?.n || 0,
    monthAmount: round2(month?.amount || 0),
    pendingCount: pending?.n || 0,
    pendingAmount: round2(pending?.amount || 0),
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
 * BILL PE PAISA GHATANE/BADHANE KA EK HI RASTA — aur wo ATOMIC hai.
 *
 * Pehle ye JS me hota tha: bill padho, `paidAmount + delta` gino, `inv.save()`.
 * Do payment ek saath aane par dono ne wahi purana `paidAmount` padha aur dono ne
 * wahi naya number likh diya — ek payment ka paisa bill se gayab. Khata dono ka
 * credit ginta rehta tha, isliye khata aur bill alag ho jate the.
 *
 * Ab teeno field MongoDB khud ginta hai, ek hi update me, us waqt ki asli value se.
 * Do request ek saath aayen to dono seedhe DB pe lagti hain — koi bhi purana
 * number leke nahi chalta.
 *
 * `needDue` de do to bill pe utna baaki hona ZAROORI hai. Na ho (kisi aur ne pehle
 * le liya) to update chalta hi nahi aur `null` milta hai — caller dobara dekh leta hai.
 */
function paidPipeline(delta) {
  return [
    { $set: { paidAmount: { $round: [{ $min: ['$grandTotal', { $max: [0, { $add: ['$paidAmount', delta] }] }] }, 2] } } },
    { $set: { dueAmount: { $round: [{ $subtract: ['$grandTotal', '$paidAmount'] }, 2] } } },
    {
      $set: {
        paymentStatus: {
          $cond: [{ $lte: ['$paidAmount', 0] }, 'unpaid',
            { $cond: [{ $lte: ['$dueAmount', 0] }, 'paid', 'partial'] }],
        },
      },
    },
  ];
}

async function applyPaidAtomic(businessId, invoiceId, delta, { needDue = 0 } = {}) {
  const filter = { _id: invoiceId, businessId };
  if (needDue > 0) filter.dueAmount = { $gte: needDue };
  return Invoice.findOneAndUpdate(filter, paidPipeline(delta), { new: true });
}

/**
 * Paisa purane bill se pehle lagta hai (FIFO) — jaise dukaan me hota hai.
 * Bache hue paise ko "advance" maan liya jata hai; khate me wo credit rehta hai.
 *
 * Har baar sabse purana khula bill DOBARA padhte hain, kyunki beech me koi doosri
 * payment us bill pe lag chuki ho sakti hai.
 */
export async function allocateToInvoices(businessId, partyId, amount) {
  let left = round2(amount);
  const allocations = [];

  // Bina aage badhe ghumte rehne se bachne ke liye — bill se zyada chakkar nahi
  const openCount = await Invoice.countDocuments({
    businessId, partyId, isCancelled: false, dueAmount: { $gt: 0 },
  });
  let tries = openCount * 2 + 5;

  while (left > 0 && tries-- > 0) {
    const next = await Invoice.find({
      businessId, partyId, isCancelled: false, dueAmount: { $gt: 0 },
    }).sort({ invoiceDate: 1, createdAt: 1 }).limit(1).lean();

    const inv = next[0];
    if (!inv) break;

    const apply = round2(Math.min(left, inv.dueAmount));
    if (apply <= 0) break;

    // Utna baaki abhi bhi hai tabhi lagega — warna null milega aur dobara dekhenge
    const updated = await applyPaidAtomic(businessId, inv._id, apply, { needDue: apply });
    if (!updated) continue;

    allocations.push({ invoiceId: inv._id, amount: apply });
    left = round2(left - apply);
  }

  return { allocations, allocatedTo: allocations.map((a) => a.invoiceId), advance: left };
}

/**
 * Payment delete/reject hone par allocation wapas kholo.
 *
 * Nayi payments me `allocations` hai — kis bill pe kitna laga tha, likha hua.
 * Purani payments me sirf `againstInvoiceIds` hai, unke liye purana (andaze wala)
 * tarika chalta hai.
 */
async function deallocate(businessId, payment) {
  const rows = (payment.allocations || []).filter((a) => a.invoiceId && a.amount > 0);

  if (rows.length) {
    for (const a of rows) {
      await applyPaidAtomic(businessId, a.invoiceId, -a.amount);
    }
    return;
  }

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
    allocation = await allocateToInvoices(businessId, party._id, amount);
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
    note: payload.note || '',
    recordedBy: userId,
  });

  // Khata: dono taraf paisa dene se hisaab GHATTA hai
  await postEntry({
    businessId, partyId: party._id,
    type: direction === 'IN' ? LEDGER_TYPES.PAYMENT_IN : LEDGER_TYPES.PAYMENT_OUT,
    credit: amount,
    date: payment.date,
    refType: 'Payment', refId: payment._id, refNo: paymentNo,
    note: payload.note || (payload.mode === 'CASH' ? 'Cash' : payload.mode),
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

  return {
    deleted: true,
    message: `${payment.paymentNo} hata diya — bill aur khata dono wapas theek kar diye`,
  };
}

/* --------------------------------------------------------- retailer side */

export async function listMyPayments(businessId, partyId, q) {
  return listPayments(businessId, { ...q, partyId: String(partyId) });
}

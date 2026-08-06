import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  PARTY_TYPES, LEDGER_TYPES, PAYMENT_STATUS, COUNTER_KEYS, NOTIFICATION_TYPES,
} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { Payment, Party, Invoice, Counter, Business } from '../models/index.js';
import { postEntry, reverseEntriesFor } from './ledger.service.js';
import { notifyWholesaler, notifyRetailer } from './notification.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ list */

export async function listPayments(businessId, q) {
  const filter = { businessId };
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

export async function getStats(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [[today], [month], [pending]] = await Promise.all([
    Payment.aggregate([
      { $match: { businessId: bid, status: 'confirmed', direction: 'IN', date: { $gte: todayStart } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { businessId: bid, status: 'confirmed', direction: 'IN', date: { $gte: monthStart } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { businessId: bid, status: 'pending' } },
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

export async function getPayment(businessId, id, { partyId = null } = {}) {
  const filter = { _id: id, businessId };
  if (partyId) filter.partyId = partyId;
  const payment = await Payment.findOne(filter).populate('partyId', 'name shopName phone type').lean();
  if (!payment) throw ApiError.notFound('Payment nahi mili');
  return { ...payment, party: payment.partyId, partyId: payment.partyId?._id || payment.partyId };
}

/* ------------------------------------------------------ invoice allocation */

/**
 * Paisa purane bill se pehle lagta hai (FIFO) — jaise dukaan me hota hai.
 * Bache hue paise ko "advance" maan liya jata hai; khate me wo credit rehta hai.
 */
async function allocateToInvoices(businessId, partyId, amount) {
  const invoices = await Invoice.find({
    businessId, partyId, isCancelled: false, dueAmount: { $gt: 0 },
  }).sort({ invoiceDate: 1, createdAt: 1 });

  let left = round2(amount);
  const touched = [];

  for (const inv of invoices) {
    if (left <= 0) break;
    const apply = round2(Math.min(left, inv.dueAmount));
    inv.paidAmount = round2(inv.paidAmount + apply);
    inv.dueAmount = round2(inv.grandTotal - inv.paidAmount);
    inv.paymentStatus = inv.dueAmount <= 0 ? 'paid' : 'partial';
    await inv.save();
    touched.push(inv._id);
    left = round2(left - apply);
  }

  return { allocatedTo: touched, advance: left };
}

/** Payment delete/reject hone par allocation wapas kholo */
async function deallocate(businessId, payment) {
  if (!payment.againstInvoiceIds?.length) return;

  let left = round2(payment.amount);
  const invoices = await Invoice.find({ _id: { $in: payment.againstInvoiceIds }, businessId })
    .sort({ invoiceDate: -1 });

  for (const inv of invoices) {
    if (left <= 0) break;
    const take = round2(Math.min(left, inv.paidAmount));
    inv.paidAmount = round2(inv.paidAmount - take);
    inv.dueAmount = round2(inv.grandTotal - inv.paidAmount);
    inv.paymentStatus = inv.paidAmount <= 0 ? 'unpaid' : inv.dueAmount <= 0 ? 'paid' : 'partial';
    await inv.save();
    left = round2(left - take);
  }
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
  let allocation = { allocatedTo: [], advance: amount };

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

export async function confirmPayment(businessId, id, userId) {
  const payment = await Payment.findOne({ _id: id, businessId });
  if (!payment) throw ApiError.notFound('Payment nahi mili');
  if (payment.status === PAYMENT_STATUS.CONFIRMED) throw ApiError.badRequest('Ye payment pehle se confirm hai');

  // Sirf retailer se aaya paisa hi bill pe lagta hai
  const party = await Party.findOne({ _id: payment.partyId, businessId }).select('type').lean();
  const allocation = payment.direction === 'IN' && party?.type === PARTY_TYPES.RETAILER
    ? await allocateToInvoices(businessId, payment.partyId, payment.amount)
    : { allocatedTo: [], advance: payment.amount };

  payment.status = PAYMENT_STATUS.CONFIRMED;
  payment.confirmedAt = new Date();
  payment.confirmedBy = userId;
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

  await notifyRetailer(businessId, payment.partyId, {
    type: NOTIFICATION_TYPES.PAYMENT_RECEIVED,
    title: `Payment confirm ho gaya — ${payment.paymentNo}`,
    body: `${payment.amount} khate me lag gaya`,
    link: '/my-khata',
    data: { paymentId: payment._id },
  });

  return getPayment(businessId, id);
}

export async function rejectPayment(businessId, id, { reason }, userId) {
  const payment = await Payment.findOne({ _id: id, businessId });
  if (!payment) throw ApiError.notFound('Payment nahi mili');
  if (payment.status !== PAYMENT_STATUS.PENDING) {
    throw ApiError.badRequest('Sirf pending payment reject ho sakti hai');
  }

  payment.status = PAYMENT_STATUS.FAILED;
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

export async function deletePayment(businessId, id, userId) {
  const payment = await Payment.findOne({ _id: id, businessId });
  if (!payment) throw ApiError.notFound('Payment nahi mili');

  if (payment.status === PAYMENT_STATUS.CONFIRMED) {
    await deallocate(businessId, payment);
    await reverseEntriesFor({ businessId, refType: 'Payment', refId: payment._id, userId });
  }

  const no = payment.paymentNo;
  await payment.deleteOne();

  return { deleted: true, message: `${no} hata diya — khata wapas theek kar diya` };
}

/* --------------------------------------------------------- retailer side */

export async function listMyPayments(businessId, partyId, q) {
  return listPayments(businessId, { ...q, partyId: String(partyId) });
}

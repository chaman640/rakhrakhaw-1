import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  PARTY_TYPES, STOCK_MOVEMENT_TYPES, LEDGER_TYPES, COUNTER_KEYS,
  ORDER_STATUS, NOTIFICATION_TYPES, PAYMENT_STATUS,
} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { getFinancialYear } from '../utils/financialYear.js';
import { amountInWords } from '../utils/amountInWords.js';
import {
  Invoice, Order, Party, Item, Business, Counter, StockMovement, Payment,
} from '../models/index.js';
import { computeInvoice, decideTaxType, hsnSummary } from './gst.service.js';
import { applyStockChange } from './stock.service.js';
import { postEntry, reverseEntriesFor } from './ledger.service.js';
import { resolveRates } from './rate.service.js';
import { notifyRetailer } from './notification.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ list */

export async function listInvoices(businessId, q) {
  const filter = { businessId };
  if (q.status === 'active') filter.isCancelled = false;
  else if (q.status === 'cancelled') filter.isCancelled = true;
  if (q.partyId) filter.partyId = q.partyId;
  if (q.paymentStatus !== 'all') filter.paymentStatus = q.paymentStatus;

  if (q.from || q.to) {
    filter.invoiceDate = {};
    if (q.from) filter.invoiceDate.$gte = q.from;
    if (q.to) { const to = new Date(q.to); to.setHours(23, 59, 59, 999); filter.invoiceDate.$lte = to; }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const parties = await Party.find({ businessId, $or: [{ name: rx }, { shopName: rx }, { phone: rx }] })
      .select('_id').lean();
    filter.$or = [{ invoiceNo: rx }, { partyId: { $in: parties.map((p) => p._id) } }];
  }

  const skip = (q.page - 1) * q.limit;
  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort(q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 })
      .skip(skip).limit(q.limit)
      .populate('partyId', 'name shopName phone')
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    invoices: invoices.map((i) => ({
      ...i,
      party: i.partyId ? { _id: i.partyId._id, name: i.partyId.shopName || i.partyId.name, phone: i.partyId.phone } : null,
      partyId: i.partyId?._id || i.partyId,
      itemCount: i.items?.length || 0,
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function getStats(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [[all], [month], [today]] = await Promise.all([
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' }, due: { $sum: '$dueAmount' } } },
    ]),
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, invoiceDate: { $gte: monthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
    ]),
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, invoiceDate: { $gte: todayStart } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
    ]),
  ]);

  return {
    totalInvoices: all?.count || 0,
    totalAmount: round2(all?.total || 0),
    totalDue: round2(all?.due || 0),
    monthCount: month?.count || 0,
    monthAmount: round2(month?.total || 0),
    todayCount: today?.count || 0,
    todayAmount: round2(today?.total || 0),
  };
}

export async function nextNumber(businessId) {
  const business = await Business.findById(businessId).select('invoicePrefix').lean();
  const fy = getFinancialYear();
  const counter = await Counter.findOne({ businessId, key: COUNTER_KEYS.INVOICE, fy }).lean();
  const seq = (counter?.seq || 0) + 1;
  return { preview: `${business?.invoicePrefix || 'INV'}/${fy}/${String(seq).padStart(4, '0')}` };
}

/* --------------------------------------------------------------- get one */

export async function getInvoice(businessId, id, { partyId = null } = {}) {
  const filter = { _id: id, businessId };
  if (partyId) filter.partyId = partyId;

  const invoice = await Invoice.findOne(filter).populate('partyId', 'name shopName phone gstin address').lean();
  if (!invoice) throw ApiError.notFound('Bill nahi mila');

  return {
    ...invoice,
    party: invoice.partyId,
    partyId: invoice.partyId?._id || invoice.partyId,
    hsnSummary: invoice.gstEnabled ? hsnSummary(invoice.items, invoice.taxType) : [],
    amountInWords: amountInWords(invoice.grandTotal),
  };
}

/* ------------------------------------------------- order se prefill data */

/** "Bill banayein" dabane par form me kya bharna hai */
export async function prefillFromOrder(businessId, orderId) {
  const order = await Order.findOne({ _id: orderId, businessId })
    .populate('partyId', 'name shopName phone gstin address').lean();
  if (!order) throw ApiError.notFound('Order nahi mila');
  if (order.invoiceId) throw ApiError.badRequest('Is order ka bill pehle se ban chuka hai');
  if (order.status === ORDER_STATUS.CANCELLED) throw ApiError.badRequest('Cancel order ka bill nahi banta');

  const items = await Item.find({ _id: { $in: order.items.map((i) => i.itemId) }, businessId })
    .select('name hsn gstRate unit stockQty warrantyMonths warrantyNote').lean();
  const map = new Map(items.map((i) => [String(i._id), i]));

  return {
    orderId: order._id,
    orderNo: order.orderNo,
    party: order.partyId,
    partyId: order.partyId?._id,
    items: order.items.map((l) => {
      const item = map.get(String(l.itemId));
      return {
        itemId: l.itemId,
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        rate: l.rate,                     // order ka rate hi chalega
        discount: 0,
        hsn: item?.hsn || '',
        warrantyMonths: item?.warrantyMonths || 0,
        gstRate: item?.gstRate ?? 0,
        stockQty: item?.stockQty ?? 0,
      };
    }),
  };
}

/* ---------------------------------------------------------------- create */

export async function createInvoice(businessId, payload, userId) {
  const business = await Business.findById(businessId).lean();
  if (!business) throw ApiError.notFound('Business nahi mila');

  const party = await Party.findOne({
    _id: payload.partyId, businessId, type: PARTY_TYPES.RETAILER,
  }).lean();
  if (!party) throw ApiError.badRequest('Retailer nahi mila');

  let order = null;
  if (payload.orderId) {
    order = await Order.findOne({ _id: payload.orderId, businessId });
    if (!order) throw ApiError.badRequest('Order nahi mila');
    if (order.invoiceId) throw ApiError.badRequest('Is order ka bill pehle se ban chuka hai');
    if (String(order.partyId) !== String(party._id)) {
      throw ApiError.badRequest('Order kisi aur retailer ka hai');
    }
  }

  // Items ki detail
  const itemIds = payload.items.map((i) => i.itemId);
  const dbItems = await Item.find({ _id: { $in: itemIds }, businessId })
    .select('name hsn gstRate unit stockQty warrantyMonths warrantyNote').lean();
  const itemMap = new Map(dbItems.map((i) => [String(i._id), i]));

  const lines = payload.items.map((l, idx) => {
    const item = itemMap.get(String(l.itemId));
    if (!item) throw ApiError.badRequest(`Row ${idx + 1}: item nahi mila`);
    return {
      itemId: item._id,
      name: item.name,
      hsn: item.hsn || '',
      unit: item.unit,
      warrantyMonths: item.warrantyMonths || 0,
      warrantyNote: item.warrantyNote || '',
      qty: l.qty,
      rate: l.rate,
      discount: l.discount || 0,
      gstRate: l.gstRate ?? item.gstRate ?? 0,
    };
  });

  // Stock pehle se check kar lo — aadha bill banakar fail hona theek nahi
  for (const line of lines) {
    const item = itemMap.get(String(line.itemId));
    if (item.stockQty < line.qty) {
      throw ApiError.badRequest(
        `${item.name} ka stock sirf ${item.stockQty} ${item.unit} hai, bill me ${line.qty} lagaya hai`
      );
    }
  }

  const { documentType, taxType } = decideTaxType({
    gstEnabled: business.gstEnabled,
    businessStateCode: business.address?.stateCode,
    partyStateCode: party.address?.stateCode,
  });

  let totals;
  try {
    totals = computeInvoice(lines, {
      gstEnabled: business.gstEnabled,
      taxType,
      extraDiscount: payload.extraDiscount || 0,
    });
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }

  const paidAmount = round2(Math.min(payload.paidAmount || 0, totals.grandTotal));
  const dueAmount = round2(totals.grandTotal - paidAmount);

  const { number: invoiceNo } = await Counter.nextNumber({
    businessId, key: COUNTER_KEYS.INVOICE,
    prefix: business.invoicePrefix || 'INV',
    date: payload.invoiceDate || new Date(),
  });

  const invoice = await Invoice.create({
    businessId,
    partyId: party._id,
    orderId: order?._id || null,
    invoiceNo,
    invoiceDate: payload.invoiceDate || new Date(),

    gstEnabled: Boolean(business.gstEnabled),   // SNAPSHOT — baad me GST le liya to purana bill na badle
    documentType,
    taxType,
    placeOfSupplyStateCode: party.address?.stateCode || business.address?.stateCode || '',

    items: totals.items,
    subTotal: totals.subTotal,
    discountTotal: totals.discountTotal,
    taxableTotal: totals.taxableTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,

    paidAmount,
    dueAmount,
    paymentStatus: paidAmount <= 0 ? 'unpaid' : paidAmount >= totals.grandTotal ? 'paid' : 'partial',

    businessSnapshot: {
      name: business.name, phone: business.phone, gstin: business.gstin,
      logoUrl: business.logoUrl, address: business.address,
    },
    partySnapshot: {
      name: party.name, shopName: party.shopName, phone: party.phone,
      gstin: party.gstin, address: party.address,
    },

    notes: payload.notes,
    termsAndConditions: payload.termsAndConditions ?? business.termsAndConditions ?? '',
    createdBy: userId,
  });

  // ---- YAHIN STOCK GHATTA HAI (order pe nahi) ----
  for (const line of totals.items) {
    await applyStockChange({
      businessId,
      itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.SALE,
      qty: -line.qty,
      refType: 'Invoice',
      refId: invoice._id,
      note: `${invoiceNo} · ${party.shopName || party.name}`,
      userId,
    });
  }

  // ---- Khata: retailer ka udhaar badha ----
  await postEntry({
    businessId, partyId: party._id, type: LEDGER_TYPES.INVOICE,
    debit: totals.grandTotal,
    date: invoice.invoiceDate,
    refType: 'Invoice', refId: invoice._id, refNo: invoiceNo,
    note: order ? `Order ${order.orderNo}` : 'Bill',
    userId,
  });

  // ---- Turant paisa mila to payment bhi ----
  if (paidAmount > 0) {
    const { number: paymentNo } = await Counter.nextNumber({
      businessId, key: COUNTER_KEYS.PAYMENT, prefix: 'PAY',
    });

    await Payment.create({
      businessId, partyId: party._id, paymentNo,
      date: invoice.invoiceDate,
      direction: 'IN',
      amount: paidAmount,
      mode: payload.paymentMode || 'CASH',
      status: PAYMENT_STATUS.CONFIRMED,
      confirmedAt: new Date(),
      confirmedBy: userId,
      againstInvoiceIds: [invoice._id],
      note: `${invoiceNo} ke saath`,
      recordedBy: userId,
    });

    await postEntry({
      businessId, partyId: party._id, type: LEDGER_TYPES.PAYMENT_IN,
      credit: paidAmount,
      date: invoice.invoiceDate,
      refType: 'Invoice', refId: invoice._id, refNo: invoiceNo,
      note: 'Bill ke saath mila',
      userId,
    });
  }

  // ---- Order ko bill se jodo aur delivered kar do ----
  if (order) {
    order.invoiceId = invoice._id;
    if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status)) {
      order.status = ORDER_STATUS.DELIVERED;
      order.statusHistory.push({
        status: ORDER_STATUS.DELIVERED, at: new Date(), byUserId: userId,
        note: `Bill ${invoiceNo} ban gaya`,
      });
    }
    await order.save();
  }

  await notifyRetailer(businessId, party._id, {
    type: NOTIFICATION_TYPES.ORDER_STATUS,
    title: `Bill ban gaya — ${invoiceNo}`,
    body: dueAmount > 0 ? `Kul ${totals.grandTotal}, baaki ${dueAmount}` : `Kul ${totals.grandTotal} — poora ho gaya`,
    link: `/my-bills/${invoice._id}`,
    data: { invoiceId: invoice._id },
  });

  return getInvoice(businessId, invoice._id);
}

/* ---------------------------------------------------------------- cancel */

/**
 * Bill delete nahi hota — cancel hota hai. Number wahin rehta hai (legal record),
 * par stock wapas aa jata hai aur khata ulta ho jata hai.
 */
export async function cancelInvoice(businessId, id, { reason }, userId) {
  const invoice = await Invoice.findOne({ _id: id, businessId });
  if (!invoice) throw ApiError.notFound('Bill nahi mila');
  if (invoice.isCancelled) throw ApiError.badRequest('Ye bill pehle se cancel hai');

  // Stock wapas
  for (const line of invoice.items) {
    await applyStockChange({
      businessId, itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.SALE_RETURN,
      qty: line.qty,
      refType: 'Invoice', refId: invoice._id,
      note: `${invoice.invoiceNo} cancel hua`,
      userId,
    });
  }

  // Khata ulta
  await reverseEntriesFor({ businessId, refType: 'Invoice', refId: invoice._id, userId });

  // Us bill ke saath jo payment thi wo bhi hatao
  await Payment.deleteMany({ businessId, againstInvoiceIds: invoice._id });

  invoice.isCancelled = true;
  invoice.notes = [invoice.notes, `CANCELLED: ${reason || 'wajah nahi batayi'}`].filter(Boolean).join(' | ');
  invoice.paymentStatus = 'unpaid';
  invoice.paidAmount = 0;
  invoice.dueAmount = 0;
  await invoice.save();

  // Order se link hata do taaki naya bill ban sake
  if (invoice.orderId) {
    await Order.updateOne({ _id: invoice.orderId, businessId }, { invoiceId: null });
  }

  await notifyRetailer(businessId, invoice.partyId, {
    type: NOTIFICATION_TYPES.ORDER_STATUS,
    title: `Bill cancel — ${invoice.invoiceNo}`,
    body: reason || 'Wholesaler ne bill cancel kar diya',
    link: `/my-bills/${invoice._id}`,
    data: { invoiceId: invoice._id },
  });

  return {
    cancelled: true,
    message: `${invoice.invoiceNo} cancel ho gaya — stock aur khata dono wapas theek kar diye`,
  };
}

/* --------------------------------------------------------- retailer side */

export async function listMyInvoices(businessId, partyId, q) {
  return listInvoices(businessId, { ...q, partyId: String(partyId) });
}

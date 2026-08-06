import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  PARTY_TYPES, STOCK_MOVEMENT_TYPES, LEDGER_TYPES, COUNTER_KEYS,
} from '../config/constants.js';
import { round2, splitRoundOff } from '../utils/money.js';
import { getFinancialYear } from '../utils/financialYear.js';
import { Purchase, Party, Item, Business, Counter, StockMovement } from '../models/index.js';
import { applyStockChange } from './stock.service.js';
import { postEntry, reverseEntriesFor } from './ledger.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PREFIX = 'PUR';

/* ---------------------------------------------------------------- totals */

/**
 * Ek jagah hisaab. Line total = (qty × rate) − discount, uspe GST.
 * GST off hai to gstRate 0 chala jata hai — koi alag code path nahi.
 */
export function computeTotals(lines, { gstEnabled }) {
  let subTotal = 0, discountTotal = 0, taxableTotal = 0, taxTotal = 0;

  const items = lines.map((l) => {
    const gross = round2(l.qty * l.rate);
    const discount = round2(l.discount || 0);
    const taxableValue = round2(gross - discount);
    if (taxableValue < 0) throw ApiError.badRequest('Discount rate se zyada nahi ho sakta');

    const gstRate = gstEnabled ? Number(l.gstRate || 0) : 0;
    const taxAmount = round2((taxableValue * gstRate) / 100);

    subTotal = round2(subTotal + gross);
    discountTotal = round2(discountTotal + discount);
    taxableTotal = round2(taxableTotal + taxableValue);
    taxTotal = round2(taxTotal + taxAmount);

    return {
      ...l,
      discount,
      gstRate,
      taxableValue,
      taxAmount,
      total: round2(taxableValue + taxAmount),
    };
  });

  const before = round2(taxableTotal + taxTotal);
  const { grandTotal, roundOff } = splitRoundOff(before);

  return { items, subTotal, discountTotal, taxableTotal, taxTotal, roundOff, grandTotal };
}

function paymentStatusOf(paid, total) {
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

/* ------------------------------------------------------------------ list */

export async function listPurchases(businessId, q) {
  const filter = { businessId };
  if (q.supplierId) filter.supplierId = q.supplierId;
  if (q.paymentStatus !== 'all') filter.paymentStatus = q.paymentStatus;

  if (q.from || q.to) {
    filter.purchaseDate = {};
    if (q.from) filter.purchaseDate.$gte = q.from;
    if (q.to) {
      const to = new Date(q.to);
      to.setHours(23, 59, 59, 999);
      filter.purchaseDate.$lte = to;
    }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ purchaseNo: rx }, { supplierBillNo: rx }, { 'items.name': rx }];
  }

  const skip = (q.page - 1) * q.limit;
  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .sort(q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 })
      .skip(skip).limit(q.limit)
      .populate('supplierId', 'name shopName phone')
      .lean(),
    Purchase.countDocuments(filter),
  ]);

  return {
    purchases: purchases.map((p) => ({
      ...p,
      supplier: p.supplierId ? { _id: p.supplierId._id, name: p.supplierId.shopName || p.supplierId.name } : null,
      supplierId: p.supplierId?._id || p.supplierId,
      itemCount: p.items?.length || 0,
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function getStats(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [all] = await Purchase.aggregate([
    { $match: { businessId: bid } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' }, due: { $sum: '$dueAmount' } } },
  ]);

  const [month] = await Purchase.aggregate([
    { $match: { businessId: bid, purchaseDate: { $gte: monthStart } } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
  ]);

  return {
    totalPurchases: all?.count || 0,
    totalAmount: round2(all?.total || 0),
    totalDue: round2(all?.due || 0),
    thisMonthCount: month?.count || 0,
    thisMonthAmount: round2(month?.total || 0),
  };
}

export async function getPurchase(businessId, id) {
  const purchase = await Purchase.findOne({ _id: id, businessId })
    .populate('supplierId', 'name shopName phone gstin address balance')
    .lean();
  if (!purchase) throw ApiError.notFound('Purchase nahi mili');

  const movements = await StockMovement.find({ businessId, refType: 'Purchase', refId: id }).lean();

  return {
    ...purchase,
    supplier: purchase.supplierId,
    supplierId: purchase.supplierId?._id || purchase.supplierId,
    movements,
  };
}

export async function nextNumber(businessId) {
  const fy = getFinancialYear();
  const counter = await Counter.findOne({ businessId, key: COUNTER_KEYS.PURCHASE, fy }).lean();
  const seq = (counter?.seq || 0) + 1;
  return { preview: `${PREFIX}/${fy}/${String(seq).padStart(4, '0')}` };
}

/* ---------------------------------------------------------------- create */

export async function createPurchase(businessId, payload, userId) {
  const business = await Business.findById(businessId).select('gstEnabled').lean();

  const supplier = await Party.findOne({
    _id: payload.supplierId, businessId, type: PARTY_TYPES.SUPPLIER,
  }).lean();
  if (!supplier) throw ApiError.badRequest('Supplier nahi mila — pehle Suppliers page se add karein');

  // Saare item ek saath nikal lo (har row pe alag query nahi)
  const itemIds = payload.items.map((i) => i.itemId);
  const items = await Item.find({ _id: { $in: itemIds }, businessId })
    .select('name unit gstRate purchasePrice').lean();
  const itemMap = new Map(items.map((i) => [String(i._id), i]));

  const lines = payload.items.map((line, idx) => {
    const item = itemMap.get(String(line.itemId));
    if (!item) throw ApiError.badRequest(`Row ${idx + 1}: item nahi mila`);
    return {
      itemId: item._id,
      name: item.name,          // snapshot — item ka naam baad me badle to bill na badle
      unit: item.unit,
      qty: line.qty,
      rate: line.rate,
      discount: line.discount || 0,
      gstRate: line.gstRate ?? item.gstRate ?? 0,
    };
  });

  const totals = computeTotals(lines, { gstEnabled: business?.gstEnabled });

  const paidAmount = round2(Math.min(payload.paidAmount || 0, totals.grandTotal));
  const dueAmount = round2(totals.grandTotal - paidAmount);

  const { number: purchaseNo } = await Counter.nextNumber({
    businessId, key: COUNTER_KEYS.PURCHASE, prefix: PREFIX,
    date: payload.purchaseDate || new Date(),
  });

  const purchase = await Purchase.create({
    businessId,
    supplierId: supplier._id,
    purchaseNo,
    supplierBillNo: payload.supplierBillNo,
    purchaseDate: payload.purchaseDate || new Date(),
    items: totals.items,
    subTotal: totals.subTotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    paidAmount,
    dueAmount,
    paymentStatus: paymentStatusOf(paidAmount, totals.grandTotal),
    notes: payload.notes,
    createdBy: userId,
  });

  // ---- Stock badhao (har item ka apna movement record) ----
  for (const line of totals.items) {
    await applyStockChange({
      businessId,
      itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.PURCHASE,
      qty: line.qty,
      refType: 'Purchase',
      refId: purchase._id,
      note: `${purchaseNo} · ${supplier.shopName || supplier.name}`,
      userId,
    });
  }

  // ---- Item ka purchase price update (naya rate mila to) ----
  if (payload.updatePurchasePrice !== false) {
    for (const line of totals.items) {
      const unitCost = round2(line.taxableValue / line.qty);
      const old = itemMap.get(String(line.itemId))?.purchasePrice;
      if (unitCost > 0 && unitCost !== old) {
        await Item.updateOne({ _id: line.itemId, businessId }, { purchasePrice: unitCost });
      }
    }
  }

  // ---- Khata: supplier ka hisaab badha ----
  await postEntry({
    businessId, partyId: supplier._id, type: LEDGER_TYPES.PURCHASE,
    debit: totals.grandTotal,
    date: purchase.purchaseDate,
    refType: 'Purchase', refId: purchase._id, refNo: purchaseNo,
    note: payload.supplierBillNo ? `Bill ${payload.supplierBillNo}` : 'Maal aaya',
    userId,
  });

  // ---- Turant kuch paisa diya to wo bhi khate me ----
  if (paidAmount > 0) {
    await postEntry({
      businessId, partyId: supplier._id, type: LEDGER_TYPES.PAYMENT_OUT,
      credit: paidAmount,
      date: purchase.purchaseDate,
      refType: 'Purchase', refId: purchase._id, refNo: purchaseNo,
      note: 'Purchase ke saath diya',
      userId,
    });
  }

  return getPurchase(businessId, purchase._id);
}

/* ---------------------------------------------------------------- delete */

/**
 * Purchase delete = poora ulta. Stock wapas ghatega aur khata bhi ulta hoga.
 * Agar wo maal bik chuka hai (stock kam pad raha hai) to delete block ho jayega.
 */
export async function deletePurchase(businessId, id, userId) {
  const purchase = await Purchase.findOne({ _id: id, businessId });
  if (!purchase) throw ApiError.notFound('Purchase nahi mili');

  // Pehle check: kya sabka stock wapas nikala ja sakta hai?
  const itemIds = purchase.items.map((i) => i.itemId);
  const items = await Item.find({ _id: { $in: itemIds }, businessId }).select('name stockQty unit').lean();
  const stockMap = new Map(items.map((i) => [String(i._id), i]));

  for (const line of purchase.items) {
    const item = stockMap.get(String(line.itemId));
    if (item && item.stockQty < line.qty) {
      throw ApiError.badRequest(
        `${item.name} ka stock ab sirf ${item.stockQty} ${item.unit} hai, ` +
        `is purchase me ${line.qty} aaya tha — pehle wala maal bik chuka hai, isliye delete nahi ho sakta`
      );
    }
  }

  // Stock wapas nikalo
  for (const line of purchase.items) {
    await applyStockChange({
      businessId, itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
      qty: -line.qty,
      refType: 'Purchase', refId: purchase._id,
      note: `${purchase.purchaseNo} delete hui`,
      userId,
    });
  }

  // Khata ulta karo
  await reverseEntriesFor({ businessId, refType: 'Purchase', refId: purchase._id, userId });

  // Purane movement records hata do (ab wo purchase hai hi nahi)
  await StockMovement.deleteMany({ businessId, refType: 'Purchase', refId: purchase._id });

  const no = purchase.purchaseNo;
  await purchase.deleteOne();

  return { deleted: true, message: `${no} delete ho gayi — stock aur khata dono wapas theek kar diye` };
}

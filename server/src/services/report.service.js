import mongoose from 'mongoose';
import { round2 } from '../utils/money.js';
import { PARTY_TYPES } from '../config/constants.js';
import { Invoice, Purchase, Item, Party, StockMovement, Payment, ReturnNote } from '../models/index.js';
import { expenseTotals } from './expense.service.js';
import { scopeMatch, scopeByParty, scopeParties } from '../utils/scope.js';

/**
 * Saari reports ek jagah.
 *
 * Har report ek hi shakal me jawab deti hai:
 *   { columns, rows, totals, meta }
 *
 * `columns` isliye taaki CSV banana aur table dikhana — dono ek hi cheez se ho jaye,
 * aur naya column jodne par CSV apne aap update ho jaye.
 */

const oid = (v) => new mongoose.Types.ObjectId(v);

/** Date range ko din ke shuru aur din ke aakhir tak faila deta hai */
function range({ from, to } = {}) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

/* ══════════════════════════════════════════════════════════════ 1. SALE */

const SALE_COLUMNS = {
  day: [
    { key: 'label', header: 'Date' },
    { key: 'bills', header: 'Bill' },
    { key: 'qty', header: 'Quantity' },
    { key: 'taxable', header: 'Taxable', money: true },
    { key: 'tax', header: 'GST', money: true },
    { key: 'total', header: 'Kul sale', money: true },
    { key: 'received', header: 'Paisa mila', money: true },
    { key: 'due', header: 'Udhaar', money: true },
  ],
  item: [
    { key: 'label', header: 'Item' },
    { key: 'bills', header: 'Bill' },
    { key: 'qty', header: 'Quantity' },
    { key: 'taxable', header: 'Taxable', money: true },
    { key: 'total', header: 'Kul sale', money: true },
    { key: 'cost', header: 'Maal ki lagat', money: true },
    { key: 'profit', header: 'Munafa', money: true },
  ],
  party: [
    { key: 'label', header: 'Retailer' },
    { key: 'bills', header: 'Bill' },
    { key: 'qty', header: 'Quantity' },
    { key: 'total', header: 'Kul sale', money: true },
    { key: 'received', header: 'Paisa mila', money: true },
    { key: 'due', header: 'Udhaar', money: true },
  ],
};

export async function saleReport(businessId, q = {}, viewer = null) {
  const { start, end } = range(q);
  const groupBy = ['day', 'item', 'party'].includes(q.groupBy) ? q.groupBy : 'day';

  let match = {
    businessId: oid(businessId),
    isCancelled: false,
    invoiceDate: { $gte: start, $lte: end },
  };
  if (q.partyId) match.partyId = oid(q.partyId);

  /*
    Report bhi utni hi dikhni chahiye jitni list.

    Ye sabse chupa hua chhed tha: bill ki list to hadd me aa gayi, par report
    poori dukaan ka jod dikhati rehti — aur "Retailer ke hisaab se" wali
    report to seedha SAARE retailer ke naam aur unka udhaar ek table me rakh
    deti thi. Jo list me chhupaya tha wo report ek click me khol deti.
  */
  match = await scopeMatch(match, businessId, viewer, { alsoMine: true });

  let rows = [];

  if (groupBy === 'item') {
    // Item wise — invoice ki lines kholni padti hain
    const agg = await Invoice.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          label: { $first: '$items.name' },
          unit: { $first: '$items.unit' },
          bills: { $addToSet: '$_id' },
          qty: { $sum: '$items.qty' },
          taxable: { $sum: '$items.taxableValue' },
          total: { $sum: '$items.total' },
          // Bill ke saath jami hui lagat — jitni line me hai utni hi
          snapCost: { $sum: { $multiply: ['$items.qty', { $ifNull: ['$items.costPrice', 0] }] } },
          // Kitni quantity aisi hai jiski lagat bill me hai hi nahi (purane bill)
          snapQty: {
            $sum: { $cond: [{ $gt: [{ $ifNull: ['$items.costPrice', 0] }, 0] }, '$items.qty', 0] },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 500 },
    ]);

    /*
      MUNAFA — lagat kahan se aati hai.

      Pehle yahan sirf item ka AAJ ka purchase price lagta tha. Uska matlab ye
      tha ki supplier ne rate badhaya aur aapne app me naya rate daala — to
      pichhle mahine ka munafa bhi apne aap badal gaya. Jo hisaab ho chuka hai
      wo badalna nahi chahiye.

      Ab bill ke saath uski apni lagat jam jati hai. Purane bill me wo hai
      nahi, isliye unke liye aaj ka rate hi maanna padta hai — isliye neeche
      dono ka jod hai: jitni quantity ki lagat bill me hai utni bill se, baaki
      aaj ke rate se.
    */
    const items = await Item.find({ businessId, _id: { $in: agg.map((a) => a._id) } })
      .select('purchasePrice').lean();
    const costMap = Object.fromEntries(items.map((i) => [String(i._id), i.purchasePrice || 0]));

    rows = agg.map((a) => {
      const oldQty = round2(a.qty - a.snapQty);           // jinki lagat bill me nahi thi
      const cost = round2(a.snapCost + oldQty * (costMap[String(a._id)] || 0));
      return {
        _id: a._id,
        label: a.label,
        unit: a.unit,
        bills: a.bills.length,
        qty: round2(a.qty),
        taxable: round2(a.taxable),
        total: round2(a.total),
        cost,
        profit: round2(a.taxable - cost),
      };
    });
  } else if (groupBy === 'party') {
    const agg = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$partyId',
          label: { $first: '$partySnapshot.shopName' },
          fallback: { $first: '$partySnapshot.name' },
          bills: { $sum: 1 },
          qty: { $sum: { $sum: '$items.qty' } },
          total: { $sum: '$grandTotal' },
          received: { $sum: '$paidAmount' },
          due: { $sum: '$dueAmount' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 500 },
    ]);
    rows = agg.map((a) => ({
      _id: a._id,
      label: a.label || a.fallback || '—',
      bills: a.bills,
      qty: round2(a.qty),
      total: round2(a.total),
      received: round2(a.received),
      due: round2(a.due),
    }));
  } else {
    const agg = await Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } },
          bills: { $sum: 1 },
          qty: { $sum: { $sum: '$items.qty' } },
          taxable: { $sum: '$taxableTotal' },
          // Invoice pe CGST/SGST/IGST alag alag hain — teeno jod kar hi "GST" banta hai
          tax: { $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal'] } },
          total: { $sum: '$grandTotal' },
          received: { $sum: '$paidAmount' },
          due: { $sum: '$dueAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    rows = agg.map((a) => ({
      _id: a._id,
      label: a._id,
      bills: a.bills,
      qty: round2(a.qty),
      taxable: round2(a.taxable),
      tax: round2(a.tax),
      total: round2(a.total),
      received: round2(a.received),
      due: round2(a.due),
    }));
  }

  const totals = sumRows(rows, SALE_COLUMNS[groupBy]);

  return {
    columns: SALE_COLUMNS[groupBy],
    rows,
    totals,
    meta: { from: start, to: end, groupBy, title: 'Sale report' },
  };
}

/* ══════════════════════════════════════════════════════════ 2. PURCHASE */

const PURCHASE_COLUMNS = {
  day: [
    { key: 'label', header: 'Date' },
    { key: 'bills', header: 'Purchase' },
    { key: 'qty', header: 'Quantity' },
    { key: 'total', header: 'Kul kharch', money: true },
    { key: 'paid', header: 'Diya', money: true },
    { key: 'due', header: 'Baaki', money: true },
  ],
  supplier: [
    { key: 'label', header: 'Supplier' },
    { key: 'bills', header: 'Purchase' },
    { key: 'qty', header: 'Quantity' },
    { key: 'total', header: 'Kul kharch', money: true },
    { key: 'paid', header: 'Diya', money: true },
    { key: 'due', header: 'Baaki', money: true },
  ],
  item: [
    { key: 'label', header: 'Item' },
    { key: 'bills', header: 'Purchase' },
    { key: 'qty', header: 'Quantity' },
    { key: 'total', header: 'Kul kharch', money: true },
    { key: 'avgRate', header: 'Average rate', money: true, noTotal: true },
  ],
};

export async function purchaseReport(businessId, q = {}) {
  const { start, end } = range(q);
  const groupBy = ['day', 'supplier', 'item'].includes(q.groupBy) ? q.groupBy : 'day';
  const match = { businessId: oid(businessId), purchaseDate: { $gte: start, $lte: end } };

  let rows = [];

  if (groupBy === 'item') {
    const agg = await Purchase.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId',
          label: { $first: '$items.name' },
          bills: { $addToSet: '$_id' },
          qty: { $sum: '$items.qty' },
          total: { $sum: '$items.total' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 500 },
    ]);
    rows = agg.map((a) => ({
      _id: a._id, label: a.label, bills: a.bills.length,
      qty: round2(a.qty), total: round2(a.total),
      avgRate: a.qty > 0 ? round2(a.total / a.qty) : 0,
    }));
  } else if (groupBy === 'supplier') {
    const agg = await Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$supplierId', bills: { $sum: 1 },
          qty: { $sum: { $sum: '$items.qty' } },
          total: { $sum: '$grandTotal' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' },
        },
      },
      { $sort: { total: -1 } },
    ]);
    const suppliers = await Party.find({ businessId, _id: { $in: agg.map((a) => a._id) } })
      .select('name shopName').lean();
    const nameMap = Object.fromEntries(suppliers.map((s) => [String(s._id), s.shopName || s.name]));
    rows = agg.map((a) => ({
      _id: a._id, label: nameMap[String(a._id)] || '—', bills: a.bills,
      qty: round2(a.qty), total: round2(a.total), paid: round2(a.paid), due: round2(a.due),
    }));
  } else {
    const agg = await Purchase.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } },
          bills: { $sum: 1 },
          qty: { $sum: { $sum: '$items.qty' } },
          total: { $sum: '$grandTotal' }, paid: { $sum: '$paidAmount' }, due: { $sum: '$dueAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    rows = agg.map((a) => ({
      _id: a._id, label: a._id, bills: a.bills, qty: round2(a.qty),
      total: round2(a.total), paid: round2(a.paid), due: round2(a.due),
    }));
  }

  return {
    columns: PURCHASE_COLUMNS[groupBy],
    rows,
    totals: sumRows(rows, PURCHASE_COLUMNS[groupBy]),
    meta: { from: start, to: end, groupBy, title: 'Purchase report' },
  };
}

/* ═════════════════════════════════════════════════════════════ 3. STOCK */

const STOCK_COLUMNS = [
  { key: 'label', header: 'Item' },
  { key: 'sku', header: 'SKU', text: true },
  { key: 'stockQty', header: 'Stock' },
  { key: 'unit', header: 'Unit', text: true },
  { key: 'purchasePrice', header: 'Kharid rate', money: true, noTotal: true },
  { key: 'stockValue', header: 'Stock ki keemat', money: true },
  { key: 'saleValue', header: 'Bechne pe milega', money: true },
  { key: 'soldQty', header: 'Bik gaya' },
  { key: 'lastSoldAt', header: 'Aakhri sale', text: true },
  { key: 'status', header: 'Haal', text: true },
];

const DEAD_DAYS = 60;

export async function stockReport(businessId, q = {}) {
  const filter = { businessId, isActive: true };
  if (q.categoryId) filter.categoryId = q.categoryId;

  const items = await Item.find(filter).sort({ name: 1 }).limit(2000)
    .select('name sku unit stockQty lowStockAt purchasePrice salePrice wholesalePrice').lean();

  const ids = items.map((i) => i._id);

  // Har item ka aakhri sale kab hua aur kitna bika
  const sold = await StockMovement.aggregate([
    { $match: { businessId: oid(businessId), itemId: { $in: ids }, type: 'SALE' } },
    { $group: { _id: '$itemId', qty: { $sum: '$qty' }, lastAt: { $max: '$createdAt' } } },
  ]);
  const soldMap = Object.fromEntries(sold.map((s) => [String(s._id), s]));

  const deadLine = new Date();
  deadLine.setDate(deadLine.getDate() - DEAD_DAYS);

  let rows = items.map((i) => {
    const s = soldMap[String(i._id)];
    const lastSoldAt = s?.lastAt || null;
    const isDead = i.stockQty > 0 && (!lastSoldAt || new Date(lastSoldAt) < deadLine);

    const status = i.stockQty <= 0 ? 'Khatam'
      : i.stockQty <= i.lowStockAt ? 'Kam bacha'
        : isDead ? 'Pada hua'
          : 'Theek hai';

    return {
      _id: i._id,
      label: i.name,
      sku: i.sku || '—',
      unit: i.unit,
      stockQty: round2(i.stockQty),
      lowStockAt: i.lowStockAt,
      purchasePrice: round2(i.purchasePrice),
      stockValue: round2(i.stockQty * i.purchasePrice),
      saleValue: round2(i.stockQty * (i.wholesalePrice || i.salePrice)),
      soldQty: round2(Math.abs(s?.qty || 0)),
      lastSoldAt: lastSoldAt ? dayKey(lastSoldAt) : '—',
      status,
    };
  });

  if (q.filter === 'low') rows = rows.filter((r) => r.status === 'Kam bacha');
  else if (q.filter === 'out') rows = rows.filter((r) => r.status === 'Khatam');
  else if (q.filter === 'dead') rows = rows.filter((r) => r.status === 'Pada hua');

  const totals = sumRows(rows, STOCK_COLUMNS);
  totals.label = `${rows.length} item`;

  return {
    columns: STOCK_COLUMNS,
    rows,
    totals,
    meta: {
      title: 'Stock report',
      filter: q.filter || 'all',
      deadAfterDays: DEAD_DAYS,
      counts: {
        all: items.length,
        low: rows.filter((r) => r.status === 'Kam bacha').length,
        out: rows.filter((r) => r.status === 'Khatam').length,
        dead: rows.filter((r) => r.status === 'Pada hua').length,
      },
    },
  };
}

/* ══════════════════════════════════════════════════ 4. OUTSTANDING (aging) */

const OUTSTANDING_COLUMNS = [
  { key: 'label', header: 'Party' },
  { key: 'phone', header: 'Phone', text: true },
  { key: 'balance', header: 'Kul baaki', money: true },
  { key: 'b0', header: '0-30 din', money: true },
  { key: 'b30', header: '31-60 din', money: true },
  { key: 'b60', header: '61-90 din', money: true },
  { key: 'b90', header: '90+ din', money: true },
  { key: 'oldestDays', header: 'Sabse purana (din)' },
];

/**
 * Udhaar kitna purana hai — yahi asli kaam ki cheez hai.
 * Bucket bill ki date se bante hain, party ke balance se nahi.
 */
export async function outstandingReport(businessId, q = {}, viewer = null) {
  const type = q.type === 'supplier' ? PARTY_TYPES.SUPPLIER : PARTY_TYPES.RETAILER;

  // Udhaar report seedhi party pe bani hai, isliye party wali hadd hi kaafi hai
  const parties = await Party.find(scopeParties({ businessId, type, balance: { $gt: 0 } }, viewer))
    .sort({ balance: -1 }).limit(500)
    .select('name shopName phone balance creditLimit').lean();
  if (!parties.length) {
    return { columns: OUTSTANDING_COLUMNS, rows: [], totals: {}, meta: { title: 'Udhaar report', type } };
  }

  const ids = parties.map((p) => p._id);
  const today = new Date();

  const docs = type === PARTY_TYPES.RETAILER
    ? await Invoice.find({ businessId, partyId: { $in: ids }, isCancelled: false, dueAmount: { $gt: 0 } })
      .select('partyId invoiceDate dueAmount').lean()
    : await Purchase.find({ businessId, supplierId: { $in: ids }, dueAmount: { $gt: 0 } })
      .select('supplierId purchaseDate dueAmount').lean();

  const bucketMap = {};
  for (const d of docs) {
    const pid = String(d.partyId || d.supplierId);
    const days = Math.floor((today - new Date(d.invoiceDate || d.purchaseDate)) / 86400000);
    const b = bucketMap[pid] || (bucketMap[pid] = { b0: 0, b30: 0, b60: 0, b90: 0, oldestDays: 0 });
    if (days <= 30) b.b0 += d.dueAmount;
    else if (days <= 60) b.b30 += d.dueAmount;
    else if (days <= 90) b.b60 += d.dueAmount;
    else b.b90 += d.dueAmount;
    b.oldestDays = Math.max(b.oldestDays, days);
  }

  const rows = parties.map((p) => {
    const b = bucketMap[String(p._id)] || { b0: 0, b30: 0, b60: 0, b90: 0, oldestDays: 0 };
    return {
      _id: p._id,
      label: p.shopName || p.name,
      phone: p.phone,
      balance: round2(p.balance),
      creditLimit: p.creditLimit,
      overLimit: p.creditLimit > 0 && p.balance > p.creditLimit,
      b0: round2(b.b0), b30: round2(b.b30), b60: round2(b.b60), b90: round2(b.b90),
      oldestDays: b.oldestDays,
    };
  });

  const totals = sumRows(rows, OUTSTANDING_COLUMNS);
  totals.oldestDays = Math.max(0, ...rows.map((r) => r.oldestDays));

  return {
    columns: OUTSTANDING_COLUMNS,
    rows,
    totals,
    meta: { title: 'Udhaar report', type },
  };
}

/* ═══════════════════════════════════════════════════════════════ 5. GST */

const GST_COLUMNS = [
  { key: 'label', header: 'HSN' },
  { key: 'description', header: 'Item', text: true },
  { key: 'gstRate', header: 'GST %', noTotal: true },
  { key: 'qty', header: 'Quantity' },
  { key: 'taxable', header: 'Taxable', money: true },
  { key: 'cgst', header: 'CGST', money: true },
  { key: 'sgst', header: 'SGST', money: true },
  { key: 'igst', header: 'IGST', money: true },
  { key: 'total', header: 'Kul', money: true },
];

/**
 * GSTR-1 jaisa summary — CA ko dene layak.
 * B2B = jis retailer ka GSTIN hai, B2C = baaki.
 */
export async function gstReport(businessId, q = {}, viewer = null) {
  const { start, end } = range(q);

  let filter = {
    businessId, isCancelled: false, gstEnabled: true,
    invoiceDate: { $gte: start, $lte: end },
  };
  filter = await scopeByParty(filter, businessId, viewer, { alsoMine: true });

  const invoices = await Invoice.find(filter)
    .select('items partySnapshot taxableTotal cgstTotal sgstTotal igstTotal grandTotal taxType').lean();

  // HSN wise
  const hsnMap = {};
  for (const inv of invoices) {
    for (const line of inv.items) {
      const key = `${line.hsn || '—'}|${line.gstRate}`;
      const h = hsnMap[key] || (hsnMap[key] = {
        label: line.hsn || '—', description: line.name, gstRate: line.gstRate,
        qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
      });
      h.qty += line.qty;
      h.taxable += line.taxableValue;
      h.cgst += line.cgst; h.sgst += line.sgst; h.igst += line.igst;
      h.total += line.total;
    }
  }
  const rows = Object.values(hsnMap)
    .map((h) => ({
      ...h,
      qty: round2(h.qty), taxable: round2(h.taxable),
      cgst: round2(h.cgst), sgst: round2(h.sgst), igst: round2(h.igst), total: round2(h.total),
    }))
    .sort((a, b) => b.taxable - a.taxable);

  // B2B / B2C batwara
  const split = { b2b: { bills: 0, taxable: 0, tax: 0, total: 0 }, b2c: { bills: 0, taxable: 0, tax: 0, total: 0 } };
  for (const inv of invoices) {
    const bucket = inv.partySnapshot?.gstin ? split.b2b : split.b2c;
    bucket.bills += 1;
    bucket.taxable += inv.taxableTotal;
    bucket.tax += (inv.cgstTotal + inv.sgstTotal + inv.igstTotal);
    bucket.total += inv.grandTotal;
  }
  for (const k of ['b2b', 'b2c']) {
    split[k].taxable = round2(split[k].taxable);
    split[k].tax = round2(split[k].tax);
    split[k].total = round2(split[k].total);
  }

  // Kharide hue maal ka GST (input credit) — kitna wapas mil sakta hai
  const purchases = await Purchase.aggregate([
    { $match: { businessId: oid(businessId), purchaseDate: { $gte: start, $lte: end } } },
    { $group: { _id: null, taxable: { $sum: '$taxableTotal' }, tax: { $sum: '$taxTotal' }, bills: { $sum: 1 } } },
  ]);

  const totals = sumRows(rows, GST_COLUMNS);
  const outputTax = round2(totals.cgst + totals.sgst + totals.igst);
  const inputTax = round2(purchases[0]?.tax || 0);

  return {
    columns: GST_COLUMNS,
    rows,
    totals,
    meta: {
      title: 'GST report',
      from: start, to: end,
      invoiceCount: invoices.length,
      split,
      outputTax,
      inputTax,
      netPayable: round2(outputTax - inputTax),
      purchaseTaxable: round2(purchases[0]?.taxable || 0),
      purchaseBills: purchases[0]?.bills || 0,
    },
  };
}

/* ══════════════════════════════════════════════════════════ 6. PAYMENTS */

const PAYMENT_COLUMNS = [
  { key: 'label', header: 'Date' },
  { key: 'cash', header: 'Cash', money: true },
  { key: 'upi', header: 'UPI', money: true },
  { key: 'bank', header: 'Bank', money: true },
  { key: 'cheque', header: 'Cheque', money: true },
  { key: 'inTotal', header: 'Kul aaya', money: true },
  { key: 'outTotal', header: 'Kul diya', money: true },
];

export async function paymentReport(businessId, q = {}, viewer = null) {
  const { start, end } = range(q);

  const match = await scopeMatch(
    { businessId: oid(businessId), status: 'confirmed', date: { $gte: start, $lte: end } },
    businessId, viewer, { alsoMine: true },
  );

  const agg = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, mode: '$mode', dir: '$direction' },
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);

  const dayMap = {};
  for (const a of agg) {
    const d = dayMap[a._id.day] || (dayMap[a._id.day] = {
      label: a._id.day, cash: 0, upi: 0, bank: 0, cheque: 0, inTotal: 0, outTotal: 0,
    });
    if (a._id.dir === 'IN') {
      d[a._id.mode.toLowerCase()] += a.amount;
      d.inTotal += a.amount;
    } else {
      d.outTotal += a.amount;
    }
  }

  const rows = Object.values(dayMap).map((d) => ({
    ...d,
    cash: round2(d.cash), upi: round2(d.upi), bank: round2(d.bank), cheque: round2(d.cheque),
    inTotal: round2(d.inTotal), outTotal: round2(d.outTotal),
  }));

  return {
    columns: PAYMENT_COLUMNS,
    rows,
    totals: sumRows(rows, PAYMENT_COLUMNS),
    meta: { title: 'Payment report', from: start, to: end },
  };
}

/* ════════════════════════════════════════════════════════════ helpers */

/** Number wale saare column jod deta hai — naya column jodo to yahan kuch nahi badalna padta */
function sumRows(rows, columns) {
  const totals = {};
  for (const col of columns) {
    // label text hai; rate/%/average jodne ka koi matlab nahi banta
    if (col.key === 'label' || col.noTotal || col.text) continue;
    const first = rows.find((r) => r[col.key] !== undefined)?.[col.key];
    if (typeof first !== 'number') continue;
    totals[col.key] = round2(rows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0));
  }
  return totals;
}


/* ═══════════════════════════════════════════════ 7. FAYDA-NUKSAN (P&L) */

const PL_COLUMNS = [
  { key: 'label', header: 'Cheez' },
  { key: 'amount', header: 'Rakam', money: true },
];

/**
 * FAYDA-NUKSAN — "mahine ke aakhir me bacha kitna?"
 *
 * Poora hisaab paanch line ka hai, aur har line ka matlab saaf hona chahiye:
 *
 *     Sale (bina GST)          jitna maal becha
 *   − Maal wapas aaya          jo laut kar aa gaya
 *   ─────────────────────
 *   = Asli sale
 *   − Maal ki lagat            us maal ne aapko kitne ka pada
 *   ─────────────────────
 *   = Maal ka fayda            (gross profit)
 *   − Dukaan ka kharch         chai, petrol, tankhwah, kiraya...
 *   ─────────────────────
 *   = Asli fayda               (net profit)
 *
 * TEEN FAISLE jo samajhne layak hain:
 *
 * 1. GST sale me nahi ginte. Wo paisa aapka hai hi nahi — sarkar ka hai, aap
 *    sirf ikattha karke aage bhejte hain. Use kamaai maan lena sabse aam aur
 *    sabse mehanga dhokha hai.
 *
 * 2. PURCHASE seedha kharch nahi hai. Aaj ₹1 lakh ka maal khareeda aur kuch
 *    nahi becha — nuksaan nahi hua, paisa maal me badal gaya. Maal ki lagat
 *    tabhi ginti hai jab wo maal BIK jata hai. Isliye yahan purchase ki koi
 *    line nahi hai, aur "maal ki lagat" bike hue maal ki hai.
 *
 * 3. Ye NAKAD ka hisaab nahi hai. Udhaar becha hua maal bhi sale me hai, chahe
 *    paisa abhi tak na aaya ho. "Kitna paisa aaya" wo alag sawal hai — uske
 *    liye Khata aur Payment page hai.
 */
export async function profitLossReport(businessId, q = {}, viewer = null) {
  const { start, end } = range(q);

  let saleMatch = {
    businessId: oid(businessId), isCancelled: false, invoiceDate: { $gte: start, $lte: end },
  };
  saleMatch = await scopeMatch(saleMatch, businessId, viewer, { alsoMine: true });

  let returnMatch = {
    businessId: oid(businessId), type: 'SALE_RETURN', returnDate: { $gte: start, $lte: end },
  };
  returnMatch = await scopeMatch(returnMatch, businessId, viewer, { alsoMine: true });

  /*
    Lagat do hisso me nikalti hai: jitni line me lagat likhi hai wo seedha, aur
    jitni line me nahi hai (purane bill) uski quantity alag — uske liye aaj ka
    rate lagana padta hai. Isi wajah se neeche `snapQty` bhi ginte hain.
  */
  const costPipeline = (dateField) => [
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.itemId',
        qty: { $sum: '$items.qty' },
        taxable: { $sum: '$items.taxableValue' },
        snapCost: { $sum: { $multiply: ['$items.qty', { $ifNull: ['$items.costPrice', 0] }] } },
        snapQty: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$items.costPrice', 0] }, 0] }, '$items.qty', 0] } },
      },
    },
  ];

  const [saleAgg, saleLines, returnAgg, returnLines, expenses] = await Promise.all([
    Invoice.aggregate([
      { $match: saleMatch },
      { $group: { _id: null, bills: { $sum: 1 }, taxable: { $sum: '$taxableTotal' }, grand: { $sum: '$grandTotal' }, tax: { $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal'] } } } },
    ]),
    Invoice.aggregate([{ $match: saleMatch }, ...costPipeline()]),
    ReturnNote.aggregate([
      { $match: returnMatch },
      { $group: { _id: null, notes: { $sum: 1 }, taxable: { $sum: '$taxableTotal' } } },
    ]),
    ReturnNote.aggregate([{ $match: returnMatch }, ...costPipeline()]),
    expenseTotals(businessId, { start, end }, viewer),
  ]);

  // Purane bill ke liye aaj ka rate — dono taraf (sale aur wapasi) ke liye
  const itemIds = [...new Set([...saleLines, ...returnLines].map((l) => String(l._id)))];
  const items = await Item.find({ businessId, _id: { $in: itemIds } }).select('purchasePrice').lean();
  const costMap = Object.fromEntries(items.map((i) => [String(i._id), i.purchasePrice || 0]));

  const costOf = (lines) => round2(lines.reduce((sum, l) => {
    const missingQty = Math.max(0, l.qty - l.snapQty);
    return sum + l.snapCost + missingQty * (costMap[String(l._id)] || 0);
  }, 0));

  const saleTaxable = round2(saleAgg[0]?.taxable || 0);
  const returnTaxable = round2(returnAgg[0]?.taxable || 0);
  const netSale = round2(saleTaxable - returnTaxable);

  const saleCost = costOf(saleLines);
  const returnCost = costOf(returnLines);
  const netCost = round2(saleCost - returnCost);

  const grossProfit = round2(netSale - netCost);
  const netProfit = round2(grossProfit - expenses.total);

  const rows = [
    { key: 'sale', label: 'Sale (bina GST)', amount: saleTaxable },
    ...(returnTaxable > 0 ? [{ key: 'saleReturn', label: 'Maal wapas aaya', amount: -returnTaxable }] : []),
    { key: 'netSale', label: 'Asli sale', amount: netSale, strong: true },
    { key: 'cogs', label: 'Maal ki lagat', amount: -netCost },
    { key: 'gross', label: 'Maal ka fayda', amount: grossProfit, strong: true },
    ...expenses.byCategory.map((c) => ({
      key: `exp:${c.category}`, label: `   ${c.label}`, amount: -c.amount, muted: true,
    })),
    { key: 'expense', label: 'Dukaan ka kharch', amount: -expenses.total, strong: true },
    { key: 'net', label: 'Asli fayda', amount: netProfit, strong: true, big: true },
  ];

  return {
    columns: PL_COLUMNS,
    rows,
    totals: {},
    meta: {
      title: 'Fayda-Nuksan',
      from: start, to: end,
      bills: saleAgg[0]?.bills || 0,
      returns: returnAgg[0]?.notes || 0,
      gstCollected: round2(saleAgg[0]?.tax || 0),
      saleWithGst: round2(saleAgg[0]?.grand || 0),
      sale: saleTaxable,
      saleReturn: returnTaxable,
      netSale,
      cost: netCost,
      grossProfit,
      expenses: expenses.total,
      expenseCount: expenses.count,
      expenseByCategory: expenses.byCategory,
      netProfit,
      // Munafe ka pratishat — "100 ke maal pe kitna bacha"
      grossMarginPct: netSale > 0 ? round2((grossProfit / netSale) * 100) : 0,
      netMarginPct: netSale > 0 ? round2((netProfit / netSale) * 100) : 0,
    },
  };
}

export const REPORTS = {
  // Fayda-Nuksan sabse pehle — yahi wo sawal hai jo har dukaandaar poochta hai
  pl: profitLossReport,
  sale: saleReport,
  purchase: purchaseReport,
  stock: stockReport,
  outstanding: outstandingReport,
  gst: gstReport,
  payment: paymentReport,
};

export async function runReport(name, businessId, q, viewer = null) {
  const fn = REPORTS[name];
  if (!fn) return null;
  return fn(businessId, q, viewer);
}

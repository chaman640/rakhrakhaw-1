import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { istDay, istStart } from '../utils/istDay.js';
import { PARTY_TYPES } from '../config/constants.js';
import { validateGstin } from '../utils/gstin.js';
import {
  Invoice, Purchase, Payment, ReturnNote, Expense, JournalVoucher, LedgerEntry, StockMovement, AuditLog,
  Party, Item, User, Business, Order, Quotation, AccountHead, BankAccount,
} from '../models/index.js';
import { journalLines, periodOf, SYSTEM_ACCOUNTS } from './accounts.service.js';
import { categoryLabel } from '../config/expenseCategories.js';

const DAY = 86400000;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BACKDATE_DAYS = 3;

const DOCS = {
  Invoice: { model: Invoice, no: 'invoiceNo', date: 'invoiceDate', party: 'partyId', label: 'Sale', link: (d) => `/invoices/${d._id}` },
  Purchase: { model: Purchase, no: 'purchaseNo', date: 'purchaseDate', party: 'supplierId', label: 'Purchase', link: (d) => `/purchases/${d._id}` },
  Payment: { model: Payment, no: 'paymentNo', date: 'date', party: 'partyId', label: 'Payment', link: () => '/payments' },
  ReturnNote: { model: ReturnNote, no: 'returnNo', date: 'returnDate', party: 'partyId', label: 'Return', link: (d) => `/returns/${d._id}` },
  Expense: { model: Expense, no: 'expenseNo', date: 'date', party: null, label: 'Expense', link: () => '/expenses' },
  JournalVoucher: { model: JournalVoucher, no: 'voucherNo', date: 'date', party: null, label: 'Journal', link: () => '/accounts' },
};
export const DOC_TYPES = Object.keys(DOCS);

async function postingsOf(businessId, date, id) {
  const led = await LedgerEntry.find({ businessId, refId: id }).select('date').lean();
  const days = [date, ...led.map((e) => e.date)].map((d) => istStart(istDay(d)).getTime());
  const from = new Date(Math.min(...days));
  const to = new Date(Math.max(...days) + DAY - 1);
  const { lines } = await journalLines(businessId, { from, to });
  const mine = lines.filter((l) => l.v.id === String(id));
  const [heads, banks, parties] = await Promise.all([
    AccountHead.find({ businessId }).select('name').lean(),
    BankAccount.find({ businessId }).select('name').lean(),
    Party.find({ _id: { $in: mine.filter((l) => l.acct.startsWith('party:')).map((l) => l.acct.slice(6)) } }).select('name').lean(),
  ]);
  const nm = new Map([...heads, ...banks, ...parties].map((x) => [String(x._id), x.name]));
  const nameOf = (k) => {
    if (SYSTEM_ACCOUNTS[k]) return SYSTEM_ACCOUNTS[k].name;
    const [kind, rest] = k.split(':');
    if (kind === 'exp') return categoryLabel(rest);
    return nm.get(rest) || k;
  };
  return mine.map((l) => ({ account: l.acct, name: nameOf(l.acct), dr: l.dr, cr: l.cr }));
}

/** Everything a CA needs about one transaction: who, when, what, postings, stock, profit, edits */
export async function verifyTransaction(businessId, type, id) {
  const cfg = DOCS[type];
  if (!cfg) throw ApiError.badRequest('Unknown transaction type');
  const doc = await cfg.model.findOne({ _id: id, businessId }).lean();
  if (!doc) throw ApiError.notFound('Transaction not found');
  const date = doc[cfg.date];
  const creatorId = doc.createdBy || doc.recordedBy || null;
  const [creator, party, postings, stock, history, payments] = await Promise.all([
    creatorId ? User.findById(creatorId).select('name staffRole').lean() : null,
    cfg.party && doc[cfg.party] ? Party.findById(doc[cfg.party]).select('name shopName type gstin phone').lean() : null,
    postingsOf(businessId, date, doc._id),
    StockMovement.find({ businessId, refType: type, refId: doc._id }).select('itemId type qty balanceAfter createdAt').lean(),
    AuditLog.find({ businessId, entityType: type, entityId: doc._id }).sort({ createdAt: 1 }).lean(),
    type === 'Invoice' || type === 'Purchase'
      ? Payment.find({ businessId, $or: [{ 'allocations.invoiceId': doc._id }, { sourceInvoiceId: doc._id }, { sourcePurchaseId: doc._id }] }).select('paymentNo date amount mode allocations status').lean()
      : [],
  ]);
  const items = stock.length ? await Item.find({ _id: { $in: stock.map((s) => s.itemId) } }).select('name unit').lean() : [];
  const im = new Map(items.map((i) => [String(i._id), i]));

  const warnings = [];
  const lag = Math.floor((new Date(doc.createdAt) - new Date(date)) / DAY);
  if (lag > BACKDATE_DAYS) warnings.push({ key: 'backdated', text: `Entered ${lag} days after its date` });
  if (history.some((h) => /update|items|edit/.test(h.action))) warnings.push({ key: 'edited', text: 'Changed after it was created — see edit history' });
  if (doc.isCancelled || doc.cancelled) warnings.push({ key: 'cancelled', text: 'Cancelled' });
  const dr = round2(postings.reduce((a, l) => a + l.dr, 0));
  const cr = round2(postings.reduce((a, l) => a + l.cr, 0));
  if (postings.length && dr !== cr) warnings.push({ key: 'imbalance', text: `Postings do not balance (Dr ${dr} / Cr ${cr})` });

  let profit = null;
  if (type === 'Invoice') {
    const cost = round2((doc.items || []).reduce((a, l) => a + (l.costTotal || 0), 0));
    profit = { sale: round2(doc.taxableTotal || 0), cost, gross: round2((doc.taxableTotal || 0) - cost) };
  }

  return {
    type, label: cfg.label, no: doc[cfg.no], date, link: cfg.link(doc),
    createdAt: doc.createdAt, updatedAt: doc.updatedAt,
    createdBy: creator ? { name: creator.name, role: creator.staffRole || 'owner' } : null,
    party: party ? { _id: party._id, name: party.shopName || party.name, type: party.type, gstin: party.gstin, phone: party.phone } : null,
    amount: round2(doc.grandTotal ?? doc.amount ?? postings.reduce((a, l) => a + l.dr, 0)),
    tax: type === 'Purchase' ? round2(doc.taxTotal || 0) : round2((doc.cgstTotal || 0) + (doc.sgstTotal || 0) + (doc.igstTotal || 0)),
    taxSplit: { cgst: round2(doc.cgstTotal || 0), sgst: round2(doc.sgstTotal || 0), igst: round2(doc.igstTotal || 0) },
    lines: (doc.items || []).map((l) => ({ name: l.name, hsn: l.hsn || '', qty: l.qty, unit: l.unit, rate: l.rate, gstRate: l.gstRate || 0, total: l.total ?? l.amount, cost: l.costTotal ?? null })),
    payments: payments.map((p) => ({ _id: p._id, no: p.paymentNo, date: p.date, mode: p.mode, status: p.status, amount: round2(p.allocations?.find((a) => String(a.invoiceId) === String(doc._id))?.amount ?? p.amount) })),
    postings, balanced: dr === cr,
    stock: stock.map((s) => ({ item: im.get(String(s.itemId))?.name || '', unit: im.get(String(s.itemId))?.unit || '', qty: s.qty, balanceAfter: s.balanceAfter, at: s.createdAt })),
    profit,
    history: history.map((h) => ({ at: h.createdAt, by: h.userName, role: h.userRole, action: h.action, summary: h.summary, changes: h.changes || [] })),
    warnings,
  };
}

/* ─────────────────────────────── universal search ─────────────────────────────── */

/** "Sharma Traders" → party summary; "INV-1025" → the transaction */
export async function searchBooks(businessId, q) {
  const text = String(q || '').trim();
  if (text.length < 2) return { parties: [], documents: [] };
  const bid = oid(businessId);
  const rx = new RegExp(esc(text).replace(/[-/\s]+/g, '[-/\\s]*'), 'i');
  const docQueries = Object.entries(DOCS).map(([type, c]) => c.model.find({ businessId: bid, [c.no]: rx })
    .sort({ [c.date]: -1 }).limit(8).select(`${c.no} ${c.date} grandTotal amount ${c.party || ''} isCancelled cancelled`).lean()
    .then((rows) => rows.map((d) => ({ type, label: c.label, _id: d._id, no: d[c.no], date: d[c.date], amount: round2(d.grandTotal ?? d.amount ?? 0), partyId: c.party ? d[c.party] : null, cancelled: Boolean(d.isCancelled || d.cancelled), link: c.link(d) }))));
  const [parties, supplierBills, orders, quotes, ...docs] = await Promise.all([
    Party.find({ businessId: bid, $or: [{ name: rx }, { shopName: rx }, { phone: rx }, { gstin: rx }] }).limit(10).select('name shopName phone type gstin balance').lean(),
    Purchase.find({ businessId: bid, supplierBillNo: rx }).limit(5).select('purchaseNo supplierBillNo purchaseDate grandTotal supplierId').lean(),
    Order.find({ businessId: bid, orderNo: rx }).limit(5).select('orderNo createdAt itemsTotal partyId').lean(),
    Quotation.find({ businessId: bid, quoteNo: rx }).limit(5).select('quoteNo quoteDate total partyId').lean(),
    ...docQueries,
  ]);
  const pids = parties.map((p) => p._id);
  const [sales, buys, paid, rets] = await Promise.all([
    Invoice.aggregate([{ $match: { businessId: bid, partyId: { $in: pids }, isCancelled: { $ne: true } } }, { $group: { _id: '$partyId', total: { $sum: '$grandTotal' }, tax: { $sum: { $add: ['$cgstTotal', '$sgstTotal', '$igstTotal'] } }, profit: { $sum: { $subtract: ['$taxableTotal', { $sum: '$items.costTotal' }] } }, n: { $sum: 1 } } }]),
    Purchase.aggregate([{ $match: { businessId: bid, supplierId: { $in: pids } } }, { $group: { _id: '$supplierId', total: { $sum: '$grandTotal' }, tax: { $sum: '$taxTotal' }, n: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { businessId: bid, partyId: { $in: pids }, status: 'confirmed' } }, { $group: { _id: '$partyId', total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    ReturnNote.aggregate([{ $match: { businessId: bid, partyId: { $in: pids } } }, { $group: { _id: '$partyId', total: { $sum: '$grandTotal' }, n: { $sum: 1 } } }]),
  ]);
  const m = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const S = m(sales); const B = m(buys); const P = m(paid); const R = m(rets);
  const extra = [
    ...supplierBills.map((d) => ({ type: 'Purchase', label: 'Purchase', _id: d._id, no: `${d.purchaseNo} (${d.supplierBillNo})`, date: d.purchaseDate, amount: round2(d.grandTotal), link: `/purchases/${d._id}` })),
    ...orders.map((d) => ({ type: 'Order', label: 'Order', _id: d._id, no: d.orderNo, date: d.createdAt, amount: round2(d.itemsTotal), link: `/orders/${d._id}` })),
    ...quotes.map((d) => ({ type: 'Quotation', label: 'Quotation', _id: d._id, no: d.quoteNo, date: d.quoteDate, amount: round2(d.total), link: `/quotations/${d._id}` })),
  ];
  return {
    parties: parties.map((p) => {
      const k = String(p._id);
      const s = S.get(k) || {}; const b = B.get(k) || {};
      return {
        _id: p._id, name: p.shopName || p.name, type: p.type, phone: p.phone, gstin: p.gstin, outstanding: round2(p.balance || 0),
        sales: round2(s.total || 0), bills: s.n || 0, gst: round2((s.tax || 0) + (b.tax || 0)), profit: s.n ? round2(s.profit || 0) : null,
        purchases: round2(b.total || 0), paymentsTotal: round2(P.get(k)?.total || 0), payments: P.get(k)?.n || 0, returns: round2(R.get(k)?.total || 0),
        link: p.type === PARTY_TYPES.SUPPLIER ? `/suppliers/${p._id}` : `/retailers/${p._id}`,
      };
    }),
    documents: [...docs.flat(), ...extra].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30),
  };
}

/* ─────────────────────────────── error checks ─────────────────────────────── */

/** Warnings a CA looks for: backdated entries, duplicates, GST/state mismatch, missing HSN, stock issues */
export async function auditChecks(businessId, q = {}) {
  const { from, to } = periodOf(q);
  const bid = oid(businessId);
  const biz = await Business.findById(businessId).select('gstEnabled gstin address stateCode').lean();
  const lagExpr = (dateField) => ({ $gt: [{ $subtract: ['$createdAt', `$${dateField}`] }, BACKDATE_DAYS * DAY] });
  const [bdInv, bdPur, bdPay, bdExp, dupSupplier, parties, noHsn, edits, negStock, cancelled] = await Promise.all([
    Invoice.find({ businessId: bid, invoiceDate: { $gte: from, $lte: to }, $expr: lagExpr('invoiceDate') }).select('invoiceNo invoiceDate createdAt').limit(50).lean(),
    Purchase.find({ businessId: bid, purchaseDate: { $gte: from, $lte: to }, $expr: lagExpr('purchaseDate') }).select('purchaseNo purchaseDate createdAt').limit(50).lean(),
    Payment.find({ businessId: bid, date: { $gte: from, $lte: to }, $expr: lagExpr('date') }).select('paymentNo date createdAt').limit(50).lean(),
    Expense.find({ businessId: bid, date: { $gte: from, $lte: to }, $expr: lagExpr('date') }).select('expenseNo date createdAt').limit(50).lean(),
    Purchase.find({ businessId: bid, supplierBillNo: { $gt: '' } }).select('supplierId supplierBillNo purchaseNo').lean().then((rows) => {
      const g = new Map();
      for (const p of rows) {
        const k = `${p.supplierId}|${norm(p.supplierBillNo)}`;
        if (!g.has(k)) g.set(k, { _id: { b: p.supplierBillNo }, n: 0, nos: [] });
        const x = g.get(k); x.n += 1; x.nos.push(p.purchaseNo);
      }
      return [...g.values()].filter((x) => x.n > 1).slice(0, 30);
    }),
    Party.find({ businessId: bid, gstin: { $gt: '' } }).select('name shopName gstin address type').lean(),
    biz?.gstEnabled ? Item.find({ businessId: bid, isActive: { $ne: false }, $or: [{ hsn: { $in: ['', null] } }] }).select('name gstRate').limit(50).lean() : [],
    AuditLog.find({ businessId: bid, createdAt: { $gte: from, $lte: to }, action: { $in: ['expense.update', 'order.items', 'party.update', 'item.update'] }, 'changes.0': { $exists: true } }).sort({ createdAt: -1 }).limit(30).lean(),
    Item.find({ businessId: bid, stockQty: { $lt: 0 } }).select('name stockQty').limit(30).lean(),
    Invoice.find({ businessId: bid, isCancelled: true, updatedAt: { $gte: from, $lte: to } }).select('invoiceNo grandTotal').limit(30).lean(),
  ]);
  const backdated = [
    ...bdInv.map((d) => ({ type: 'Invoice', id: d._id, no: d.invoiceNo, date: d.invoiceDate, enteredAt: d.createdAt })),
    ...bdPur.map((d) => ({ type: 'Purchase', id: d._id, no: d.purchaseNo, date: d.purchaseDate, enteredAt: d.createdAt })),
    ...bdPay.map((d) => ({ type: 'Payment', id: d._id, no: d.paymentNo, date: d.date, enteredAt: d.createdAt })),
    ...bdExp.map((d) => ({ type: 'Expense', id: d._id, no: d.expenseNo, date: d.date, enteredAt: d.createdAt })),
  ].map((x) => ({ ...x, days: Math.floor((new Date(x.enteredAt) - new Date(x.date)) / DAY) }));

  const stateMismatch = [];
  const badGstin = [];
  for (const p of parties) {
    const v = validateGstin(p.gstin);
    if (!v.valid) { badGstin.push({ id: p._id, name: p.shopName || p.name, gstin: p.gstin }); continue; }
    const sc = p.address?.stateCode;
    if (sc && sc !== p.gstin.slice(0, 2)) stateMismatch.push({ id: p._id, name: p.shopName || p.name, gstin: p.gstin, stateCode: sc });
  }
  const bizState = biz?.stateCode || (biz?.gstin || '').slice(0, 2);
  const wrongTax = biz?.gstEnabled && bizState ? await Invoice.find({
    businessId: bid, gstEnabled: true, isCancelled: { $ne: true }, invoiceDate: { $gte: from, $lte: to }, placeOfSupplyStateCode: { $gt: '' },
    $or: [
      { placeOfSupplyStateCode: bizState, igstTotal: { $gt: 0 } },
      { placeOfSupplyStateCode: { $ne: bizState }, $or: [{ cgstTotal: { $gt: 0 } }, { sgstTotal: { $gt: 0 } }] },
    ],
  }).select('invoiceNo placeOfSupplyStateCode').limit(30).lean() : [];

  const row = (key, level, title, items, hint = '') => ({ key, level, ok: !items.length, title, count: items.length, items: items.slice(0, 30), hint });
  return [
    row('backdated', 'warning', `Entries made more than ${BACKDATE_DAYS} days after their date`, backdated, 'Backdated entries change past reports. Check they were intended.'),
    row('dup_supplier_bill', 'warning', 'Same supplier bill number entered twice', dupSupplier.map((d) => ({ no: d._id.b, count: d.n, entries: d.nos.join(', ') })), 'The same supplier bill may have been recorded twice.'),
    row('gst_state', 'warning', 'GSTIN state does not match party state', stateMismatch, 'The first two digits of a GSTIN are the state code.'),
    row('gstin_invalid', 'error', 'Invalid GSTIN on party', badGstin),
    row('supply_type', 'error', 'Wrong tax type for place of supply (IGST vs CGST+SGST)', wrongTax.map((d) => ({ id: d._id, no: d.invoiceNo, state: d.placeOfSupplyStateCode }))),
    row('missing_hsn', 'warning', 'Items without HSN code', noHsn.map((i) => ({ id: i._id, name: i.name, gstRate: i.gstRate }))),
    row('negative_stock', 'warning', 'Items with negative stock (sold more than available)', negStock.map((i) => ({ id: i._id, name: i.name, qty: i.stockQty }))),
    row('edited', 'info', 'Records edited after creation', edits.map((e) => ({ at: e.createdAt, by: e.userName, what: e.entityLabel || e.entityType, changes: e.changes.map((c) => `${c.label || c.field}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('; ') })), 'Old → new values are kept in the audit log.'),
    row('cancelled', 'info', 'Bills cancelled in this period', cancelled.map((d) => ({ id: d._id, no: d.invoiceNo, amount: d.grandTotal }))),
  ];
}

/* ─────────────────────────────── GSTR-2B reconciliation ─────────────────────────────── */

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');

/** Parse the portal's GSTR-2B JSON (b2b section) into flat supplier invoices */
export function parse2b(json) {
  const root = json?.data?.docdata || json?.docdata || json;
  const b2b = root?.b2b || [];
  if (!Array.isArray(b2b)) throw ApiError.badRequest('This does not look like a GSTR-2B JSON file');
  const out = [];
  for (const s of b2b) {
    for (const inv of s.inv || []) {
      const items = inv.items || inv.itms || [];
      const sum = (k) => round2(items.reduce((a, it) => a + Number(it[k] ?? it.itm_det?.[k] ?? 0), 0));
      out.push({
        gstin: String(s.ctin || '').toUpperCase(), supplier: s.trdnm || '', no: String(inv.inum || ''), date: inv.dt || '',
        value: round2(Number(inv.val || 0)), taxable: sum('txval'), tax: round2(sum('igst') + sum('cgst') + sum('sgst') + sum('cess')),
        itcAvailable: String(inv.itcavl || 'Y').toUpperCase() !== 'N',
      });
    }
  }
  return out;
}

export async function reconcile2b(businessId, { period, json }) {
  const rows2b = parse2b(json);
  const [y, mo] = period.split('-').map(Number);
  const from = istStart(`${period}-01`);
  const to = new Date(istStart(`${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}-01`).getTime() - 1);
  const purchases = await Purchase.find({ businessId, purchaseDate: { $gte: from, $lte: to }, taxTotal: { $gt: 0 } })
    .select('purchaseNo supplierBillNo purchaseDate taxableTotal taxTotal grandTotal supplierId').lean();
  const sup = await Party.find({ _id: { $in: purchases.map((p) => p.supplierId).filter(Boolean) } }).select('name gstin').lean();
  const sm = new Map(sup.map((s) => [String(s._id), s]));
  const books = purchases.map((p) => ({ ...p, gstin: (sm.get(String(p.supplierId))?.gstin || '').toUpperCase(), supplier: sm.get(String(p.supplierId))?.name || '' }));

  const used = new Set();
  const matched = []; const mismatch = []; const notInBooks = [];
  for (const r of rows2b) {
    const hit = books.find((b) => !used.has(String(b._id)) && b.gstin === r.gstin && norm(b.supplierBillNo) && norm(b.supplierBillNo) === norm(r.no));
    if (!hit) { notInBooks.push(r); continue; }
    used.add(String(hit._id));
    const diff = round2(hit.taxTotal - r.tax);
    const entry = { ...r, purchaseId: hit._id, purchaseNo: hit.purchaseNo, booksTax: round2(hit.taxTotal), booksTaxable: round2(hit.taxableTotal), diff };
    if (Math.abs(diff) <= 1 && Math.abs(round2(hit.taxableTotal - r.taxable)) <= 1) matched.push(entry); else mismatch.push(entry);
  }
  const notIn2b = books.filter((b) => !used.has(String(b._id))).map((b) => ({
    purchaseId: b._id, purchaseNo: b.purchaseNo, supplierBillNo: b.supplierBillNo, supplier: b.supplier, gstin: b.gstin, date: b.purchaseDate, tax: round2(b.taxTotal),
    reason: !b.gstin ? 'Supplier has no GSTIN' : !b.supplierBillNo ? 'Supplier bill number not entered' : 'Supplier has not filed this bill yet',
  }));
  const sum = (arr, k) => round2(arr.reduce((a, x) => a + (x[k] || 0), 0));
  return {
    period,
    summary: {
      in2b: rows2b.length, itcIn2b: sum(rows2b.filter((r) => r.itcAvailable), 'tax'), itcInBooks: sum(books, 'taxTotal'),
      matched: matched.length, mismatch: mismatch.length, notInBooks: notInBooks.length, notIn2b: notIn2b.length,
      safeItc: round2(sum(matched, 'tax') + mismatch.reduce((a, x) => a + Math.min(x.tax, x.booksTax), 0)),
      atRisk: sum(notIn2b, 'tax'),
    },
    matched, mismatch, notInBooks, notIn2b,
  };
}

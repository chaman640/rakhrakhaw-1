import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { PARTY_TYPES } from '../config/constants.js';
import { categoryLabel, WASTE_STOCK_CATEGORY } from '../config/expenseCategories.js';
import { istDay, istStart } from '../utils/istDay.js';
import {
  LedgerEntry, Party, Invoice, Purchase, ReturnNote, Payment, Expense, Payroll, SalaryAdvance,
  JournalVoucher, AccountHead, StockLot, StockMovement, Item, Counter, User,
} from '../models/index.js';

/**
 * ACCOUNTING ENGINE.
 *
 * Alag se "posting" nahi hoti — har bill, purchase, payment, return, kharch,
 * salary aur journal se yahin double-entry lines banti hain. Isliye books aur
 * app kabhi alag nahi hote, aur Trial Balance hamesha barabar aata hai.
 *
 * Party ka hissa party ke khate (LedgerEntry) se aata hai, saamne wala hissa
 * us document se (bill ka taxable → Sales, GST → Output GST). Stock periodic
 * tarike se: opening + purchase − closing = lagat.
 */

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const DAY = 86400000;

export const SYSTEM_ACCOUNTS = {
  cash: { name: 'Cash in hand', group: 'asset' },
  bank: { name: 'Bank (UPI / cheque / transfer)', group: 'asset' },
  input_gst: { name: 'GST input (ITC)', group: 'asset' },
  employee_advance: { name: 'Salary advances', group: 'asset' },
  fixed_assets: { name: 'Fixed assets', group: 'asset' },
  output_gst: { name: 'GST output', group: 'liability' },
  loans: { name: 'Loans', group: 'liability' },
  suspense: { name: 'Suspense', group: 'liability' },
  opening_equity: { name: 'Opening balance (capital)', group: 'equity' },
  capital: { name: 'Capital', group: 'equity' },
  drawings: { name: 'Drawings', group: 'equity' },
  sales: { name: 'Sales', group: 'income', trading: true },
  sales_return: { name: 'Sales returns', group: 'income', trading: true },
  round_off: { name: 'Round off & other charges', group: 'income' },
  other_income: { name: 'Other income', group: 'income' },
  opening_stock: { name: 'Goods brought in (opening stock)', group: 'expense', trading: true },
  purchases: { name: 'Purchases', group: 'expense', trading: true },
  purchase_return: { name: 'Purchase returns', group: 'expense', trading: true },
  stock_written_off: { name: 'Stock written off', group: 'expense', trading: true },
  party_adjust: { name: 'Party adjustments', group: 'expense' },
  other_expense: { name: 'Other expenses', group: 'expense' },
};

// Haath ki entry me sirf ye — party, sale, purchase apne page se hi (khata aur GST sahi rahe)
const JOURNAL_ALLOWED = ['cash', 'bank', 'capital', 'drawings', 'loans', 'fixed_assets', 'other_income', 'other_expense',
  'employee_advance', 'opening_equity', 'output_gst', 'input_gst'];

const moneyAcct = (mode) => (String(mode || 'CASH').toUpperCase() === 'CASH' ? 'cash' : 'bank');
const dateRange = (field, { from, to }) => {
  if (!from && !to) return {};
  return { [field]: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } };
};

/** Din IST ke hisaab se — '2026-09-30' matlab 30 Sep ki raat 11:59 tak */
export function periodOf({ from, to } = {}) {
  const today = istDay();
  const y = Number(today.slice(0, 4));
  const fyFrom = `${today.slice(5, 7) >= '04' ? y : y - 1}-04-01`;
  const start = istStart(from ? istDay(from) : fyFrom);
  const end = new Date(istStart(to ? istDay(to) : today).getTime() + DAY - 1);
  return { from: start, to: end };
}

/* ─────────────────────────────── lines ─────────────────────────────── */

function split(total, parts, docTotal) {
  const abs = Math.abs(total);
  const f = docTotal ? abs / docTotal : 0;
  const out = parts.filter(([, v]) => v).map(([acct, v]) => [acct, round2(v * f)]);
  const residual = round2(abs - out.reduce((s, [, v]) => s + v, 0));
  if (residual) out.push(['round_off', residual]);
  return out;
}

const push = (lines, date, acct, amount, v) => {
  const a = round2(amount);
  if (!a) return;
  lines.push({ date, acct, dr: a > 0 ? a : 0, cr: a < 0 ? -a : 0, v });
};

async function byIds(Model, ids, select) {
  if (!ids.length) return new Map();
  const rows = await Model.find({ _id: { $in: ids } }).select(select).lean();
  return new Map(rows.map((r) => [String(r._id), r]));
}

/** Saari double-entry lines — `from`/`to` diya ho to sirf us beech ki */
export async function journalLines(businessId, { from = null, to = null } = {}) {
  const bid = oid(businessId);
  const [entries, parties, expenses, advances, journals, lots] = await Promise.all([
    LedgerEntry.find({ businessId: bid, ...dateRange('date', { from, to }) }).select('partyId date type debit credit refType refId refNo note').lean(),
    Party.find({ businessId: bid }).select('name type').lean(),
    Expense.find({ businessId: bid, ...dateRange('date', { from, to }) }).select('date expenseNo category amount mode paidTo note payrollId').lean(),
    SalaryAdvance.find({ businessId: bid, ...dateRange('date', { from, to }) }).select('userId date amount mode note').lean(),
    JournalVoucher.find({ businessId: bid, cancelled: false, ...dateRange('date', { from, to }) }).lean(),
    StockLot.find({ businessId: bid, source: 'OPENING', ...dateRange('date', { from, to }) }).select('date qty unitCost').lean(),
  ]);

  const pm = new Map(parties.map((p) => [String(p._id), p]));
  const ids = (rt) => entries.filter((e) => e.refType === rt && e.refId).map((e) => e.refId);
  const moneyEntries = entries.filter((e) => e.type === 'PAYMENT_IN' || e.type === 'PAYMENT_OUT');
  const [invs, purs, rets, pays, payrolls, staff, purPays] = await Promise.all([
    byIds(Invoice, ids('Invoice'), 'taxableTotal cgstTotal sgstTotal igstTotal grandTotal'),
    byIds(Purchase, ids('Purchase'), 'taxableTotal taxTotal grandTotal'),
    byIds(ReturnNote, ids('ReturnNote'), 'type taxableTotal cgstTotal sgstTotal igstTotal grandTotal'),
    byIds(Payment, ids('Payment'), 'mode'),
    byIds(Payroll, expenses.filter((e) => e.payrollId).map((e) => e.payrollId), 'net advanceAdjusted paymentMode payrollNo period'),
    byIds(User, advances.map((a) => a.userId), 'name'),
    Payment.find({ businessId: bid, sourcePurchaseId: { $in: moneyEntries.filter((e) => e.refType === 'Purchase').map((e) => e.refId) } }).select('sourcePurchaseId mode').lean(),
  ]);
  const purPayMode = new Map(purPays.map((p) => [String(p.sourcePurchaseId), p.mode]));

  const lines = [];
  for (const e of entries) {
    const party = pm.get(String(e.partyId));
    const sign = party?.type === PARTY_TYPES.SUPPLIER ? -1 : 1;
    const pdr = round2(sign * ((e.debit || 0) - (e.credit || 0)));
    if (!pdr) continue;
    const key = String(e.refId || e._id);
    const x = -pdr;
    let parts;
    let type = 'Adjustment';
    const tax = (d) => (d.cgstTotal || 0) + (d.sgstTotal || 0) + (d.igstTotal || 0);
    if (e.type === 'PAYMENT_IN' || e.type === 'PAYMENT_OUT') {
      parts = [[moneyAcct(e.refType === 'Purchase' ? purPayMode.get(key) : pays.get(key)?.mode), Math.abs(x)]];
      type = x > 0 ? 'Receipt' : 'Payment';
    } else if (e.refType === 'Invoice' && invs.get(key)) {
      const d = invs.get(key);
      parts = split(x, [['sales', d.taxableTotal], ['output_gst', tax(d)]], d.grandTotal);
      type = 'Sale';
    } else if (e.refType === 'Purchase' && purs.get(key)) {
      const d = purs.get(key);
      parts = split(x, [['purchases', d.taxableTotal], ['input_gst', d.taxTotal]], d.grandTotal);
      type = 'Purchase';
    } else if (e.refType === 'ReturnNote' && rets.get(key)) {
      const d = rets.get(key);
      const sale = d.type === 'SALE_RETURN';
      parts = split(x, [[sale ? 'sales_return' : 'purchase_return', d.taxableTotal], [sale ? 'output_gst' : 'input_gst', tax(d)]], d.grandTotal);
      type = sale ? 'Sales return' : 'Purchase return';
    } else if (e.type === 'OPENING') {
      parts = [['opening_equity', Math.abs(x)]];
      type = 'Opening balance';
    } else {
      parts = [[e.refType ? 'suspense' : 'party_adjust', Math.abs(x)]];
    }
    const v = { type, no: e.refNo || '', id: key, party: party?.name || '', narration: e.note || '' };
    push(lines, e.date, `party:${e.partyId}`, pdr, v);
    for (const [acct, amt] of parts) push(lines, e.date, acct, x > 0 ? amt : -amt, v);
  }

  for (const ex of expenses) {
    const pr = ex.payrollId && payrolls.get(String(ex.payrollId));
    const v = { type: pr ? 'Salary' : 'Expense', no: ex.expenseNo, id: String(ex._id), party: ex.paidTo || '', narration: ex.note || categoryLabel(ex.category) };
    push(lines, ex.date, `exp:${ex.category}`, ex.amount, v);
    if (ex.category === WASTE_STOCK_CATEGORY) {
      push(lines, ex.date, 'stock_written_off', -ex.amount, v);
    } else if (pr) {
      push(lines, ex.date, moneyAcct(pr.paymentMode), -pr.net, v);
      push(lines, ex.date, 'employee_advance', -pr.advanceAdjusted, v);
      push(lines, ex.date, 'round_off', -round2(ex.amount - pr.net - pr.advanceAdjusted), v);
    } else {
      push(lines, ex.date, moneyAcct(ex.mode), -ex.amount, v);
    }
  }

  for (const a of advances) {
    const v = { type: 'Salary advance', no: '', id: String(a._id), party: staff.get(String(a.userId))?.name || '', narration: a.note || '' };
    push(lines, a.date, 'employee_advance', a.amount, v);
    push(lines, a.date, moneyAcct(a.mode), -a.amount, v);
  }

  for (const j of journals) {
    const v = { type: j.kind === 'contra' ? 'Contra' : 'Journal', no: j.voucherNo, id: String(j._id), party: '', narration: j.narration };
    for (const l of j.lines) push(lines, j.date, l.account, (l.debit || 0) - (l.credit || 0), v);
  }

  const byDay = new Map();
  for (const l of lots) {
    const d = new Date(l.date).toISOString().slice(0, 10);
    byDay.set(d, round2((byDay.get(d) || 0) + (l.qty || 0) * (l.unitCost || 0)));
  }
  for (const [d, amt] of byDay) {
    const date = new Date(`${d}T12:00:00Z`);
    const v = { type: 'Opening stock', no: '', id: `os-${d}`, party: '', narration: 'Stock added as opening stock' };
    push(lines, date, 'opening_stock', amt, v);
    push(lines, date, 'opening_equity', -amt, v);
  }

  lines.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { lines, parties: pm };
}

/* ─────────────────────────────── names & balances ─────────────────────────────── */

async function namer(businessId, parties) {
  const heads = await AccountHead.find({ businessId }).select('name group').lean();
  const hm = new Map(heads.map((h) => [String(h._id), h]));
  return (key) => {
    if (SYSTEM_ACCOUNTS[key]) return { key, ...SYSTEM_ACCOUNTS[key] };
    const [kind, id] = key.split(':');
    if (kind === 'exp') return { key, name: categoryLabel(id), group: 'expense' };
    if (kind === 'head') { const h = hm.get(id); return { key, name: h?.name || 'Deleted account', group: h?.group || 'expense' }; }
    if (kind === 'party') { const p = parties.get(id); return { key, name: p?.name || 'Deleted party', group: 'party', partyType: p?.type }; }
    return { key, name: key, group: 'liability' };
  };
}

function sumBy(lines) {
  const m = new Map();
  for (const l of lines) {
    const r = m.get(l.acct) || { dr: 0, cr: 0 };
    r.dr += l.dr; r.cr += l.cr;
    m.set(l.acct, r);
  }
  for (const r of m.values()) { r.dr = round2(r.dr); r.cr = round2(r.cr); r.net = round2(r.dr - r.cr); }
  return m;
}

/** Stock ki keemat kisi din — aaj ki lot-lagat, us din ki quantity */
export async function stockValueAt(businessId, at = null) {
  const bid = oid(businessId);
  const [items, lots, after] = await Promise.all([
    Item.find({ businessId: bid }).select('stockQty purchasePrice').lean(),
    StockLot.aggregate([
      { $match: { businessId: bid, remaining: { $gt: 0 } } },
      { $group: { _id: '$itemId', qty: { $sum: '$remaining' }, value: { $sum: { $multiply: ['$remaining', '$unitCost'] } } } },
    ]),
    at && at < new Date() ? StockMovement.aggregate([
      { $match: { businessId: bid, createdAt: { $gt: at } } },
      { $group: { _id: '$itemId', qty: { $sum: '$qty' } } },
    ]) : [],
  ]);
  const lm = new Map(lots.map((l) => [String(l._id), l]));
  const am = new Map(after.map((a) => [String(a._id), a.qty]));
  let value = 0;
  for (const it of items) {
    const l = lm.get(String(it._id));
    const unit = l?.qty > 0 ? l.value / l.qty : (it.purchasePrice || 0);
    const qty = Math.max(0, (it.stockQty || 0) - (am.get(String(it._id)) || 0));
    value += qty * unit;
  }
  return round2(value);
}

/* ─────────────────────────────── reports ─────────────────────────────── */

export async function trialBalance(businessId, q = {}) {
  const { to } = periodOf(q);
  const { lines, parties } = await journalLines(businessId, { to });
  const name = await namer(businessId, parties);
  const bal = sumBy(lines);
  const debtors = []; const creditors = [];
  const rows = [];
  for (const [key, b] of bal) {
    if (!b.net) continue;
    const meta = name(key);
    if (meta.group === 'party') {
      (b.net > 0 ? debtors : creditors).push({ key, name: meta.name, partyType: meta.partyType, dr: Math.max(0, b.net), cr: Math.max(0, -b.net) });
    } else {
      rows.push({ key, name: meta.name, group: meta.group, dr: Math.max(0, b.net), cr: Math.max(0, -b.net) });
    }
  }
  const sum = (arr, k) => round2(arr.reduce((s, r) => s + r[k], 0));
  if (debtors.length) rows.push({ key: 'debtors', name: 'Sundry debtors', group: 'asset', dr: sum(debtors, 'dr'), cr: 0, children: debtors.sort((a, b) => b.dr - a.dr) });
  if (creditors.length) rows.push({ key: 'creditors', name: 'Sundry creditors', group: 'liability', dr: 0, cr: sum(creditors, 'cr'), children: creditors.sort((a, b) => b.cr - a.cr) });
  const order = ['asset', 'liability', 'equity', 'income', 'expense'];
  rows.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.name.localeCompare(b.name));
  const totalDr = sum(rows, 'dr');
  const totalCr = sum(rows, 'cr');
  return { asOn: to, rows, totals: { dr: totalDr, cr: totalCr, difference: round2(totalDr - totalCr) }, closingStock: await stockValueAt(businessId, to) };
}

export async function profitLoss(businessId, q = {}) {
  const { from, to } = periodOf(q);
  const [{ lines, parties }, openingStock, closingStock] = await Promise.all([
    journalLines(businessId, { from, to }),
    stockValueAt(businessId, new Date(from.getTime() - 1)),
    stockValueAt(businessId, to),
  ]);
  const name = await namer(businessId, parties);
  const bal = sumBy(lines);
  const n = (k) => bal.get(k)?.net || 0;
  const sales = -n('sales');
  const salesReturn = n('sales_return');
  const netSales = round2(sales - salesReturn);
  const purchases = n('purchases');
  const purchaseReturn = -n('purchase_return');
  const broughtIn = n('opening_stock');
  const writtenOff = -n('stock_written_off');
  const cogs = round2(openingStock + broughtIn + purchases - purchaseReturn - writtenOff - closingStock);
  const grossProfit = round2(netSales - cogs);

  const expenses = []; const incomes = [];
  for (const [key, b] of bal) {
    const meta = name(key);
    if (SYSTEM_ACCOUNTS[key]?.trading || !b.net) continue;
    if (meta.group === 'expense') expenses.push({ key, name: meta.name, amount: b.net });
    if (meta.group === 'income') incomes.push({ key, name: meta.name, amount: -b.net });
  }
  expenses.sort((a, b) => b.amount - a.amount);
  const totalExpenses = round2(expenses.reduce((s, r) => s + r.amount, 0));
  const totalOtherIncome = round2(incomes.reduce((s, r) => s + r.amount, 0));
  return {
    from, to,
    trading: { sales, salesReturn, netSales, openingStock, broughtIn, purchases, purchaseReturn, writtenOff, closingStock, cogs, grossProfit },
    expenses, incomes, totalExpenses, totalOtherIncome,
    netProfit: round2(grossProfit + totalOtherIncome - totalExpenses),
    grossMarginPct: netSales ? round2((grossProfit / netSales) * 100) : 0,
  };
}

export async function balanceSheet(businessId, q = {}) {
  const { to } = periodOf(q);
  const [{ lines, parties }, closingStock] = await Promise.all([journalLines(businessId, { to }), stockValueAt(businessId, to)]);
  const name = await namer(businessId, parties);
  const bal = sumBy(lines);
  const assets = []; const liabilities = []; const equity = [];
  let debtors = 0; let creditors = 0; let profit = closingStock;
  let gst = 0;
  for (const [key, b] of bal) {
    if (!b.net) continue;
    const meta = name(key);
    if (meta.group === 'party') { if (b.net > 0) debtors += b.net; else creditors -= b.net; continue; }
    if (key === 'input_gst' || key === 'output_gst') { gst += b.net; continue; }
    if (meta.group === 'income' || meta.group === 'expense') { profit -= b.net; continue; }
    if (meta.group === 'asset') assets.push({ key, name: meta.name, amount: b.net });
    else if (meta.group === 'liability') liabilities.push({ key, name: meta.name, amount: -b.net });
    else equity.push({ key, name: meta.name, amount: -b.net });
  }
  if (debtors) assets.push({ key: 'debtors', name: 'Sundry debtors', amount: round2(debtors) });
  if (gst > 0) assets.push({ key: 'gst', name: 'GST credit (ITC)', amount: round2(gst) });
  if (closingStock) assets.push({ key: 'stock', name: 'Closing stock', amount: closingStock });
  if (creditors) liabilities.push({ key: 'creditors', name: 'Sundry creditors', amount: round2(creditors) });
  if (gst < 0) liabilities.push({ key: 'gst', name: 'GST payable', amount: round2(-gst) });
  equity.push({ key: 'profit', name: 'Profit & loss (retained)', amount: round2(profit) });
  const sum = (arr) => round2(arr.reduce((s, r) => s + r.amount, 0));
  const totalAssets = sum(assets);
  const totalLiabilities = round2(sum(liabilities) + sum(equity));
  return {
    asOn: to, assets, liabilities, equity,
    totals: { assets: totalAssets, liabilities: sum(liabilities), equity: sum(equity), liabilitiesAndEquity: totalLiabilities, difference: round2(totalAssets - totalLiabilities) },
  };
}

export async function dayBook(businessId, q = {}) {
  const { from, to } = periodOf({ from: q.from || new Date(), to: q.to });
  const { lines, parties } = await journalLines(businessId, { from, to });
  const name = await namer(businessId, parties);
  const vouchers = new Map();
  for (const l of lines) {
    const k = `${l.v.type}|${l.v.id}`;
    const vo = vouchers.get(k) || { ...l.v, date: l.date, amount: 0, lines: [] };
    vo.amount = round2(vo.amount + l.dr);
    const nm = name(l.acct).name;
    const ex = vo.lines.find((x) => x.acct === l.acct);
    if (ex) { ex.dr = round2(ex.dr + l.dr); ex.cr = round2(ex.cr + l.cr); } else vo.lines.push({ acct: l.acct, name: nm, dr: l.dr, cr: l.cr });
    vouchers.set(k, vo);
  }
  let rows = [...vouchers.values()];
  if (q.type) rows = rows.filter((r) => r.type === q.type);
  const types = [...new Set([...vouchers.values()].map((r) => r.type))].sort();
  return { from, to, types, total: round2(rows.reduce((s, r) => s + r.amount, 0)), count: rows.length, rows: rows.slice(-1000).reverse() };
}

export async function accountLedger(businessId, key, q = {}) {
  const { from, to } = periodOf(q);
  const [{ lines: before, parties }, { lines }] = await Promise.all([
    journalLines(businessId, { to: new Date(from.getTime() - 1) }),
    journalLines(businessId, { from, to }),
  ]);
  const name = await namer(businessId, parties);
  const meta = name(key);
  const opening = round2(before.filter((l) => l.acct === key).reduce((s, l) => s + l.dr - l.cr, 0));
  const byVoucher = new Map();
  for (const l of lines) {
    const k = `${l.v.type}|${l.v.id}`;
    if (!byVoucher.has(k)) byVoucher.set(k, []);
    byVoucher.get(k).push(l);
  }
  let running = opening;
  const rows = [];
  for (const l of lines) {
    if (l.acct !== key) continue;
    running = round2(running + l.dr - l.cr);
    const against = [...new Set(byVoucher.get(`${l.v.type}|${l.v.id}`).filter((x) => x.acct !== key).map((x) => name(x.acct).name))];
    rows.push({ date: l.date, type: l.v.type, no: l.v.no, party: l.v.party, narration: l.v.narration, against: against.join(', '), dr: l.dr, cr: l.cr, balance: running });
  }
  const dr = round2(rows.reduce((s, r) => s + r.dr, 0));
  const cr = round2(rows.reduce((s, r) => s + r.cr, 0));
  return { account: meta, from, to, opening, rows, totals: { dr, cr }, closing: round2(opening + dr - cr) };
}

const CASH_SECTIONS = {
  operating: 'Operating activities', investing: 'Investing activities', financing: 'Financing activities',
};

export async function cashFlow(businessId, q = {}) {
  const { from, to } = periodOf(q);
  const [{ lines: before }, { lines, parties }] = await Promise.all([
    journalLines(businessId, { to: new Date(from.getTime() - 1) }),
    journalLines(businessId, { from, to }),
  ]);
  const isMoney = (a) => a === 'cash' || a === 'bank';
  const openBal = round2(before.filter((l) => isMoney(l.acct)).reduce((s, l) => s + l.dr - l.cr, 0));
  const vo = new Map();
  for (const l of lines) {
    const k = `${l.v.type}|${l.v.id}`;
    if (!vo.has(k)) vo.set(k, []);
    vo.get(k).push(l);
  }
  const buckets = new Map();
  const add = (section, label, amt) => {
    const k = `${section}|${label}`;
    buckets.set(k, round2((buckets.get(k) || 0) + amt));
  };
  for (const group of vo.values()) {
    const money = round2(group.filter((l) => isMoney(l.acct)).reduce((s, l) => s + l.dr - l.cr, 0));
    if (!money) continue;
    const other = group.find((l) => !isMoney(l.acct));
    const a = other?.acct || '';
    const party = a.startsWith('party:') ? parties.get(a.slice(6)) : null;
    if (party) add('operating', party.type === PARTY_TYPES.SUPPLIER ? 'Paid to suppliers (net)' : 'Received from customers (net)', money);
    else if (a === 'exp:salary' || a === 'employee_advance') add('operating', 'Salaries & advances', money);
    else if (a.startsWith('exp:')) add('operating', 'Business expenses', money);
    else if (a === 'output_gst' || a === 'input_gst') add('operating', 'GST paid', money);
    else if (a === 'fixed_assets') add('investing', 'Fixed assets', money);
    else if (['capital', 'opening_equity'].includes(a)) add('financing', 'Capital introduced', money);
    else if (a === 'drawings') add('financing', 'Drawings', money);
    else if (a === 'loans') add('financing', 'Loans', money);
    else if (a.startsWith('head:')) add('operating', 'Other accounts', money);
    else add('operating', 'Other receipts & payments', money);
  }
  const sections = Object.entries(CASH_SECTIONS).map(([k, label]) => {
    const rows = [...buckets].filter(([key]) => key.startsWith(`${k}|`)).map(([key, amount]) => ({ label: key.split('|')[1], amount }));
    return { key: k, label, rows, total: round2(rows.reduce((s, r) => s + r.amount, 0)) };
  });
  const net = round2(sections.reduce((s, x) => s + x.total, 0));
  return { from, to, opening: openBal, sections, net, closing: round2(openBal + net) };
}

const AGE = [[0, 30, '0–30 days'], [31, 60, '31–60 days'], [61, 90, '61–90 days'], [91, 1e9, '90+ days']];

export async function ageing(businessId, { side = 'receivable' } = {}) {
  const bid = oid(businessId);
  const retail = side === 'receivable';
  const Model = retail ? Invoice : Purchase;
  const partyField = retail ? 'partyId' : 'supplierId';
  const dateField = retail ? 'invoiceDate' : 'purchaseDate';
  const [docs, parties] = await Promise.all([
    Model.find({ businessId: bid, dueAmount: { $gt: 0 }, ...(retail ? { isCancelled: { $ne: true } } : {}) }).select(`${partyField} ${dateField} dueAmount`).lean(),
    Party.find({ businessId: bid, type: retail ? PARTY_TYPES.RETAILER : PARTY_TYPES.SUPPLIER, balance: { $ne: 0 } }).select('name phone balance').lean(),
  ]);
  const now = Date.now();
  const rows = new Map(parties.map((p) => [String(p._id), { partyId: p._id, name: p.name, phone: p.phone, balance: round2(p.balance), buckets: [0, 0, 0, 0], bills: 0 }]));
  for (const d of docs) {
    const r = rows.get(String(d[partyField]));
    if (!r) continue;
    const age = Math.floor((now - new Date(d[dateField])) / DAY);
    const i = AGE.findIndex(([a, b]) => age >= a && age <= b);
    r.buckets[i] = round2(r.buckets[i] + d.dueAmount);
    r.bills = round2(r.bills + d.dueAmount);
  }
  const list = [...rows.values()].map((r) => ({ ...r, other: round2(Math.max(0, r.balance) - r.bills), advance: round2(Math.max(0, -r.balance)) }))
    .filter((r) => r.balance !== 0).sort((a, b) => b.balance - a.balance);
  const totals = { buckets: [0, 1, 2, 3].map((i) => round2(list.reduce((s, r) => s + r.buckets[i], 0))), other: round2(list.reduce((s, r) => s + r.other, 0)), advance: round2(list.reduce((s, r) => s + r.advance, 0)), balance: round2(list.reduce((s, r) => s + Math.max(0, r.balance), 0)) };
  return { side, labels: AGE.map((a) => a[2]), rows: list, totals };
}

export async function overview(businessId) {
  const today = new Date();
  const [tb, pl] = await Promise.all([trialBalance(businessId, { to: today }), profitLoss(businessId, {})]);
  const get = (k) => tb.rows.find((r) => r.key === k);
  const net = (k) => { const r = get(k); return r ? round2(r.dr - r.cr) : 0; };
  return {
    cash: net('cash'),
    bank: net('bank'),
    receivable: get('debtors')?.dr || 0,
    payable: get('creditors')?.cr || 0,
    gstPayable: round2(-(net('output_gst') + net('input_gst'))),
    stock: tb.closingStock,
    fy: { from: pl.from, to: pl.to, netSales: pl.trading.netSales, grossProfit: pl.trading.grossProfit, expenses: pl.totalExpenses, netProfit: pl.netProfit },
    balanced: tb.totals.difference === 0,
    suspense: net('suspense'),
  };
}

/* ─────────────────────────────── journal & accounts ─────────────────────────────── */

export async function accountOptions(businessId) {
  const [heads, cats] = await Promise.all([
    AccountHead.find({ businessId, active: true }).select('name group').sort({ name: 1 }).lean(),
    Expense.distinct('category', { businessId }),
  ]);
  return [
    ...JOURNAL_ALLOWED.map((k) => ({ key: k, name: SYSTEM_ACCOUNTS[k].name, group: SYSTEM_ACCOUNTS[k].group })),
    ...heads.map((h) => ({ key: `head:${h._id}`, name: h.name, group: h.group, custom: true })),
    ...[...new Set(['rent', 'bijli', 'salary', 'other', ...cats])].filter((c) => c !== WASTE_STOCK_CATEGORY).map((c) => ({ key: `exp:${c}`, name: categoryLabel(c), group: 'expense' })),
  ];
}

async function assertAccounts(businessId, keys) {
  const headIds = keys.filter((k) => k.startsWith('head:')).map((k) => k.slice(5));
  const found = headIds.length ? await AccountHead.countDocuments({ businessId, _id: { $in: headIds } }) : 0;
  if (found !== new Set(headIds).size) throw ApiError.badRequest('One of the selected accounts does not exist');
  for (const k of keys) {
    if (!JOURNAL_ALLOWED.includes(k) && !k.startsWith('head:') && !k.startsWith('exp:')) {
      throw ApiError.badRequest('Customer, supplier, sales and purchase accounts are updated from their own pages, not by journal');
    }
  }
}

export async function listJournals(businessId, q = {}) {
  const { from, to } = periodOf(q);
  const rows = await JournalVoucher.find({ businessId, date: { $gte: from, $lte: to } }).sort({ date: -1, createdAt: -1 }).limit(500).lean();
  const name = await namer(businessId, new Map());
  return rows.map((j) => ({
    ...j,
    amount: round2(j.lines.reduce((s, l) => s + (l.debit || 0), 0)),
    lines: j.lines.map((l) => ({ ...l, name: name(l.account).name })),
  }));
}

export async function createJournal(businessId, actor, body) {
  const lines = body.lines.map((l) => ({ account: l.account, debit: round2(l.debit || 0), credit: round2(l.credit || 0) }))
    .filter((l) => l.debit || l.credit);
  if (lines.length < 2) throw ApiError.badRequest('A voucher needs at least one debit and one credit line');
  if (lines.some((l) => l.debit && l.credit)) throw ApiError.badRequest('A line can have either debit or credit, not both');
  const dr = round2(lines.reduce((s, l) => s + l.debit, 0));
  const cr = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (dr !== cr) throw ApiError.badRequest(`Debit (₹${dr}) and credit (₹${cr}) must be equal`);
  await assertAccounts(businessId, lines.map((l) => l.account));
  if (body.kind === 'contra' && lines.some((l) => !['cash', 'bank'].includes(l.account))) {
    throw ApiError.badRequest('Contra is only for moving money between cash and bank');
  }
  const date = new Date(body.date);
  const { number } = await Counter.nextNumber({ businessId, key: body.kind === 'contra' ? 'contra' : 'journal', prefix: body.kind === 'contra' ? 'CV' : 'JV', date });
  return JournalVoucher.create({ businessId, voucherNo: number, kind: body.kind, date, lines, narration: body.narration, createdBy: actor._id });
}

export async function cancelJournal(businessId, id, reason) {
  const j = await JournalVoucher.findOne({ _id: id, businessId });
  if (!j) throw ApiError.notFound('Voucher not found');
  if (j.cancelled) throw ApiError.badRequest('Already cancelled');
  j.cancelled = true;
  j.cancelReason = reason;
  await j.save();
  return j;
}

export async function listHeads(businessId) {
  return AccountHead.find({ businessId }).sort({ group: 1, name: 1 }).lean();
}

export async function saveHead(businessId, id, body) {
  const clash = await AccountHead.findOne({ businessId, name: new RegExp(`^${body.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), ...(id ? { _id: { $ne: id } } : {}) }).lean();
  if (clash || Object.values(SYSTEM_ACCOUNTS).some((a) => a.name.toLowerCase() === body.name.toLowerCase())) {
    throw ApiError.conflict(`An account named "${body.name}" already exists`);
  }
  if (!id) return AccountHead.create({ businessId, ...body });
  if (body.group) {
    const used = await JournalVoucher.exists({ businessId, cancelled: false, 'lines.account': `head:${id}` });
    const cur = await AccountHead.findOne({ _id: id, businessId }).lean();
    if (used && cur && cur.group !== body.group) throw ApiError.badRequest('The group cannot be changed after the account is used in a voucher');
  }
  const h = await AccountHead.findOneAndUpdate({ _id: id, businessId }, { $set: body }, { new: true });
  if (!h) throw ApiError.notFound('Account not found');
  return h;
}

/* ─────────────────────────────── checks ─────────────────────────────── */

export async function bookChecks(businessId) {
  const bid = oid(businessId);
  const [tb, parties, sums, negStock] = await Promise.all([
    trialBalance(businessId, {}),
    Party.find({ businessId: bid }).select('name balance').lean(),
    LedgerEntry.aggregate([{ $match: { businessId: bid } }, { $group: { _id: '$partyId', net: { $sum: { $subtract: ['$debit', '$credit'] } } } }]),
    Item.find({ businessId: bid, stockQty: { $lt: 0 } }).select('name stockQty').limit(20).lean(),
  ]);
  const sm = new Map(sums.map((s) => [String(s._id), round2(s.net)]));
  const mismatch = parties.filter((p) => round2(p.balance || 0) !== (sm.get(String(p._id)) || 0))
    .map((p) => ({ name: p.name, balance: round2(p.balance || 0), ledger: sm.get(String(p._id)) || 0 }));
  const suspense = tb.rows.find((r) => r.key === 'suspense');
  const checks = [
    { key: 'tb', ok: tb.totals.difference === 0, title: 'Trial balance tallies', detail: tb.totals.difference ? `Difference ₹${tb.totals.difference}` : '' },
    { key: 'party', ok: !mismatch.length, title: 'Party balances match their ledgers', detail: mismatch.slice(0, 5).map((m) => `${m.name}: ₹${m.balance} vs ₹${m.ledger}`).join('; '), count: mismatch.length },
    { key: 'suspense', ok: !suspense, title: 'No entries in suspense', detail: suspense ? `₹${round2(suspense.dr - suspense.cr)}` : '' },
    { key: 'stock', ok: !negStock.length, title: 'No item has negative stock', detail: negStock.map((i) => `${i.name} (${i.stockQty})`).join(', '), count: negStock.length },
  ];
  return checks;
}

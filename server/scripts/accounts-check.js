/**
 * Accounting ki jaanch — ek chhoti dukaan ka poora hisaab, har number haath se gina hua.
 *
 *   MONGO_URI=... npm run accounts:check --prefix server
 */
process.env.BILLING_MODE = 'free';
process.env.RATE_LIMIT_PER_MIN = '100000';

const mongoose = (await import('mongoose')).default;
const jwt = (await import('jsonwebtoken')).default;
const { env } = await import('../src/config/env.js');
if (env.isProd) { console.error('Not for production'); process.exit(1); }

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { hasValidChecksum } = await import('../src/utils/gstin.js');
const M = await import('../src/models/index.js');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`${G}  ✔${N} ${name}`); } else { failed++; console.log(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
};
const step = (s) => console.log(`\n${Y}${s}${N}`);
const eq = (a, b) => Math.abs((a || 0) - b) < 0.01;

const PORT = 5990;
const BASE = `http://localhost:${PORT}/api`;
const PH = { owner: '9500000001', cashier: '9500000002' };
const otp = (phone) => jwt.sign({ phone, purpose: 'SIGNUP', otp: true }, env.jwtSecret, { expiresIn: '15m' });
async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, ...json };
}
function gstin(pan) {
  for (const c of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const g = `09${pan}1Z${c}`;
    if (hasValidChecksum(g)) return g;
  }
  return '';
}

async function cleanup() {
  const users = await M.User.find({ phone: { $in: Object.values(PH) } }).select('businessId').lean();
  const b = { businessId: { $in: users.map((u) => u.businessId).filter(Boolean) } };
  await Promise.all([
    M.User.deleteMany({ $or: [{ phone: { $in: Object.values(PH) } }, b] }),
    M.Business.deleteMany({ _id: b.businessId }),
    ...['Subscription', 'Counter', 'Party', 'Item', 'StockMovement', 'StockLot', 'Invoice', 'Purchase', 'Payment', 'ReturnNote',
      'LedgerEntry', 'Expense', 'JournalVoucher', 'AccountHead', 'BankAccount', 'Notification', 'AuditLog', 'Membership'].map((m) => M[m].deleteMany(b)),
  ]);
}

async function run() {
  await connectDB();
  await cleanup();
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));
  const period = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);

  try {
    step('1. Setup: GST dukaan, maal, party');
    let r = await call('POST', '/auth/wholesaler/signup', { body: { name: 'Acc Owner', phone: PH.owner, password: 'acc12345', businessName: 'Acc Traders', otpToken: otp(PH.owner) } });
    const tok = r.data?.token;
    const bizGstin = gstin('AAACA1234A');
    r = await call('PUT', '/business/me', { token: tok, body: { gstEnabled: true, gstin: bizGstin, address: { state: 'Uttar Pradesh' } } });
    check('business GST on', r.status === 200, r.message);
    await M.Business.updateOne({ _id: r.data?._id || (await M.User.findOne({ phone: PH.owner })).businessId }, { $set: { stateCode: '09' } });

    r = await call('POST', '/items', { token: tok, body: { name: 'Acc Charger', purchasePrice: 100, salePrice: 150, gstRate: 18, hsn: '8504', openingStock: 10 } });
    const item = r.data?._id;
    check('item with 10 opening stock', r.status === 201, r.message);
    r = await call('POST', '/parties', { token: tok, body: { type: 'supplier', name: 'Acc Supplier', phone: '9500000011', gstin: gstin('AAACS1111B'), address: { state: 'Uttar Pradesh' } } });
    const sup = r.data?._id;
    r = await call('POST', '/parties', { token: tok, body: { type: 'retailer', name: 'Acc Retail B2B', phone: '9500000012', gstin: gstin('AAACR2222C'), address: { state: 'Uttar Pradesh' }, openingBalance: 500 } });
    const ret = r.data?._id;
    r = await call('POST', '/parties', { token: tok, body: { type: 'retailer', name: 'Acc Walk-in', phone: '9500000013', address: { state: 'Uttar Pradesh' } } });
    const walk = r.data?._id;
    check('parties created', Boolean(sup && ret && walk), r.message);

    step('2. Transactions');
    r = await call('POST', '/purchases', { token: tok, body: { supplierId: sup, items: [{ itemId: item, qty: 20, rate: 100, gstRate: 18 }], paidAmount: 1000 } });
    check('purchase 2360 (paid 1000 cash)', r.status === 201 && eq(r.data?.grandTotal, 2360), `${r.status} ${r.message} ${r.data?.grandTotal}`);
    r = await call('POST', '/invoices', { token: tok, body: { partyId: ret, items: [{ itemId: item, qty: 5, rate: 150 }], paidAmount: 500, paymentMode: 'CASH' } });
    const inv1 = r.data?._id;
    check('B2B bill 885 (500 cash)', r.status === 201 && eq(r.data?.grandTotal, 885), `${r.status} ${r.message} ${r.data?.grandTotal}`);
    r = await call('POST', '/invoices', { token: tok, body: { partyId: walk, items: [{ itemId: item, qty: 2, rate: 150 }], paidAmount: 354, paymentMode: 'UPI' } });
    check('B2C bill 354 (UPI)', r.status === 201 && eq(r.data?.grandTotal, 354), `${r.status} ${r.message}`);
    r = await call('POST', '/payments', { token: tok, body: { partyId: ret, amount: 200, mode: 'UPI' } });
    check('receipt 200 UPI', r.status === 201, r.message);
    r = await call('POST', '/expenses', { token: tok, body: { category: 'rent', amount: 300, mode: 'CASH' } });
    check('rent 300 cash', r.status === 201, r.message);
    r = await call('POST', '/returns', { token: tok, body: { type: 'SALE_RETURN', partyId: ret, invoiceId: inv1, items: [{ itemId: item, qty: 1, rate: 150, gstRate: 18 }] } });
    check('sale return 177', r.status === 201 && eq(r.data?.grandTotal ?? r.data?.note?.grandTotal, 177), `${r.status} ${r.message}`);
    r = await call('POST', '/payments', { token: tok, body: { partyId: sup, direction: 'OUT', amount: 500, mode: 'BANK' } });
    check('paid supplier 500 by bank', r.status === 201, r.message);

    step('3. Journal & contra');
    r = await call('POST', '/accounts/journals', { token: tok, body: { date: new Date(), narration: 'Capital brought in', lines: [{ account: 'bank', debit: 10000 }, { account: 'capital', credit: 10000 }] } });
    check('capital journal', r.status === 201 && /^JV\//.test(r.data?.voucherNo || ''), r.message);
    r = await call('POST', '/accounts/journals', { token: tok, body: { kind: 'contra', date: new Date(), narration: 'Cash withdrawn', lines: [{ account: 'cash', debit: 2000 }, { account: 'bank', credit: 2000 }] } });
    check('contra bank → cash', r.status === 201 && /^CV\//.test(r.data?.voucherNo || ''), r.message);
    r = await call('POST', '/accounts/journals', { token: tok, body: { date: new Date(), narration: 'Unbalanced', lines: [{ account: 'bank', debit: 100 }, { account: 'capital', credit: 90 }] } });
    check('unbalanced voucher rejected', r.status === 400, `${r.status}`);
    r = await call('POST', '/accounts/journals', { token: tok, body: { date: new Date(), narration: 'Party via journal', lines: [{ account: `party:${ret}`, debit: 100 }, { account: 'capital', credit: 100 }] } });
    check('party account blocked in journal', r.status === 400, `${r.status}`);
    r = await call('POST', '/accounts/journals', { token: tok, body: { kind: 'contra', date: new Date(), narration: 'Bad contra', lines: [{ account: 'cash', debit: 100 }, { account: 'capital', credit: 100 }] } });
    check('contra only between cash and bank', r.status === 400, `${r.status}`);
    r = await call('POST', '/accounts/heads', { token: tok, body: { name: 'Shop Furniture', group: 'asset' } });
    const furn = r.data?._id;
    r = await call('POST', '/accounts/journals', { token: tok, body: { date: new Date(), narration: 'Bought shelf', lines: [{ account: `head:${furn}`, debit: 700 }, { account: 'bank', credit: 700 }] } });
    const shelf = r.data?._id;
    check('custom account + voucher', r.status === 201, r.message);
    r = await call('POST', `/accounts/journals/${shelf}/cancel`, { token: tok, body: { reason: 'Entered by mistake' } });
    check('voucher cancelled', r.status === 200 && r.data?.cancelled, r.message);

    step('4. Books');
    r = await call('GET', '/accounts/trial-balance', { token: tok });
    const tb = r.data;
    const acc = (k) => tb?.rows?.find((x) => x.key === k);
    const net = (k) => (acc(k) ? acc(k).dr - acc(k).cr : 0);
    check('trial balance tallies', tb?.totals?.difference === 0 && tb.totals.dr > 0, JSON.stringify(tb?.totals));
    check('cash = 500 − 1000 − 300 + 2000 = 1200', eq(net('cash'), 1200), `${net('cash')}`);
    check('bank = 354 + 200 + 10000 − 2000 − 500 = 8054', eq(net('bank'), 8054), `${net('bank')}`);
    check('sales 1050, returns 150', eq(-net('sales'), 1050) && eq(net('sales_return'), 150), `${net('sales')} ${net('sales_return')}`);
    check('output GST 162, input GST 360', eq(-net('output_gst'), 162) && eq(net('input_gst'), 360), `${net('output_gst')} ${net('input_gst')}`);
    check('debtors 508 (500 + 885 − 500 − 200 − 177)', eq(acc('debtors')?.dr, 508), JSON.stringify(acc('debtors')?.children));
    check('creditors 860 (2360 − 1000 − 500)', eq(acc('creditors')?.cr, 860), `${acc('creditors')?.cr}`);
    check('closing stock 24 × 100', eq(tb?.closingStock, 2400), `${tb?.closingStock}`);

    r = await call('GET', '/accounts/profit-loss', { token: tok });
    const pl = r.data;
    check('P&L: cost of goods 600 (6 units × 100)', eq(pl?.trading?.cogs, 600), JSON.stringify(pl?.trading));
    check('P&L: gross 300, net 0 after rent', eq(pl?.trading?.grossProfit, 300) && eq(pl?.netProfit, 0), `${pl?.trading?.grossProfit} ${pl?.netProfit}`);

    r = await call('GET', '/accounts/balance-sheet', { token: tok });
    const bs = r.data;
    check('balance sheet balances (12360)', bs?.totals?.difference === 0 && eq(bs?.totals?.assets, 12360), JSON.stringify(bs?.totals));
    check('capital 10000 + opening 1500', eq(bs?.equity?.find((e) => e.key === 'capital')?.amount, 10000) && eq(bs?.equity?.find((e) => e.key === 'opening_equity')?.amount, 1500), JSON.stringify(bs?.equity));
    check('GST credit 198 as asset', eq(bs?.assets?.find((a) => a.key === 'gst')?.amount, 198), JSON.stringify(bs?.assets));

    r = await call('GET', '/accounts/ledger?account=cash', { token: tok });
    check('cash ledger closing 1200 with running balance', eq(r.data?.closing, 1200) && eq(r.data?.rows?.at(-1)?.balance, 1200), `${r.data?.closing}`);
    r = await call('GET', `/accounts/ledger?account=party:${ret}`, { token: tok });
    check('party ledger matches khata (508)', eq(r.data?.closing, 508), `${r.data?.closing}`);

    r = await call('GET', '/accounts/day-book', { token: tok });
    const types = new Set((r.data?.rows || []).map((v) => v.type));
    check('day book has every voucher type', ['Sale', 'Purchase', 'Receipt', 'Payment', 'Expense', 'Sales return', 'Journal', 'Contra', 'Opening stock', 'Opening balance'].every((x) => types.has(x)), [...types].join(','));
    check('every voucher balances', (r.data?.rows || []).every((v) => eq(v.lines.reduce((s, l) => s + l.dr - l.cr, 0), 0)));

    r = await call('GET', '/accounts/cash-flow', { token: tok });
    const cf = r.data;
    check('cash flow: opening + net = closing (9254)', eq(cf?.closing, 9254) && eq(cf.opening + cf.net, cf.closing), JSON.stringify({ o: cf?.opening, n: cf?.net, c: cf?.closing }));
    check('capital shows under financing', eq(cf?.sections?.find((s) => s.key === 'financing')?.total, 10000), JSON.stringify(cf?.sections));

    r = await call('GET', '/accounts/ageing?side=receivable', { token: tok });
    check('receivable ageing total 508', eq(r.data?.totals?.balance, 508), JSON.stringify(r.data?.totals));
    r = await call('GET', '/accounts/overview', { token: tok });
    check('overview: cash, bank, receivable, payable, GST', eq(r.data?.cash, 1200) && eq(r.data?.bank, 8054) && eq(r.data?.receivable, 508) && eq(r.data?.payable, 860) && eq(r.data?.gstPayable, -198) && r.data?.balanced, JSON.stringify(r.data));
    r = await call('GET', '/accounts/checks', { token: tok });
    check('book checks all pass', (r.data || []).every((c) => c.ok), JSON.stringify((r.data || []).filter((c) => !c.ok)));

    step('5. GST returns');
    r = await call('GET', `/accounts/gst/gstr1?period=${period}`, { token: tok });
    const g1 = r.data;
    check('GSTR-1 B2B: 1 bill, taxable 750', g1?.b2b?.length === 1 && eq(g1.summary.b2b.taxable, 750) && eq(g1.summary.b2b.cgst, 67.5), JSON.stringify(g1?.summary?.b2b));
    check('GSTR-1 B2CS: taxable 300', eq(g1?.summary?.b2cs?.taxable, 300), JSON.stringify(g1?.summary?.b2cs));
    check('GSTR-1 credit note to registered party (150)', g1?.cdnr?.length === 1 && eq(g1.summary.cdnr.taxable, 150), JSON.stringify(g1?.summary?.cdnr));
    check('GSTR-1 HSN 8504: net qty 6, taxable 900', g1?.hsn?.length === 1 && eq(g1.hsn[0].qty, 6) && eq(g1.hsn[0].taxable, 900), JSON.stringify(g1?.hsn));
    r = await call('GET', `/accounts/gst/gstr3b?period=${period}`, { token: tok });
    const g3 = r.data;
    check('GSTR-3B 3.1(a): taxable 900, tax 81 + 81', eq(g3?.table31?.a?.taxable, 900) && eq(g3.table31.a.cgst, 81) && eq(g3.table31.a.sgst, 81), JSON.stringify(g3?.table31));
    check('GSTR-3B ITC 180 + 180, nothing payable, 99 + 99 carried forward', eq(g3?.table4?.net?.cgst, 180) && g3.totalPayable === 0 && eq(g3.carryForward.cgst, 99) && eq(g3.carryForward.sgst, 99), JSON.stringify({ t4: g3?.table4?.net, p: g3?.totalPayable, cf: g3?.carryForward }));
    r = await call('GET', `/accounts/gst/checks?period=${period}`, { token: tok });
    check('GST checks: GSTIN set, HSN present, supplier registered', ['gstin', 'hsn', 'itc'].every((k) => r.data?.find((c) => c.key === k)?.ok), JSON.stringify(r.data));

    step('5b. Bank accounts');
    r = await call('POST', '/accounts/banks', { token: tok, body: { name: 'HDFC Current', bankName: 'HDFC', accountNo: '50100123456', ifsc: 'HDFC0001234', openingBalance: 5000 } });
    const hdfc = r.data?._id;
    check('first bank account becomes default', r.status === 201 && r.data?.isDefault, r.message);
    r = await call('POST', '/accounts/banks', { token: tok, body: { name: 'hdfc current' } });
    check('duplicate account name blocked', r.status === 409, `${r.status}`);
    r = await call('POST', '/accounts/banks', { token: tok, body: { name: 'SBI Savings' } });
    const sbi = r.data?._id;
    r = await call('POST', '/payments', { token: tok, body: { partyId: ret, amount: 100, mode: 'UPI', bankAccountId: sbi } });
    check('receipt into SBI', r.status === 201, r.message);
    r = await call('POST', '/accounts/journals', { token: tok, body: { kind: 'contra', date: new Date(), narration: 'HDFC to SBI', lines: [{ account: `bank:${sbi}`, debit: 1000 }, { account: `bank:${hdfc}`, credit: 1000 }] } });
    check('contra between two bank accounts', r.status === 201, r.message);
    r = await call('GET', '/accounts/banks', { token: tok });
    const bal = (id) => r.data?.rows?.find((b) => String(b._id) === String(id))?.balance;
    check('HDFC = 5000 opening + 354 + 200 − 500 − 1000 = 4054', eq(bal(hdfc), 4054), `${bal(hdfc)}`);
    check('SBI = 100 + 1000', eq(bal(sbi), 1100), `${bal(sbi)}`);
    r = await call('GET', '/accounts/trial-balance', { token: tok });
    check('trial balance still tallies', r.data?.totals?.difference === 0, JSON.stringify(r.data?.totals));
    r = await call('GET', '/accounts/overview', { token: tok });
    check('overview: bank total 13154 + today figures', eq(r.data?.bank, 13154) && r.data?.bankAccounts?.length >= 2 && eq(r.data?.today?.sales, 1239) && eq(r.data?.today?.purchases, 2360), JSON.stringify({ b: r.data?.bank, t: r.data?.today }));
    r = await call('DELETE', `/accounts/banks/${hdfc}`, { token: tok });
    check('used bank account cannot be deleted', r.status === 400, `${r.status}`);

    step('5c. CA tools');
    r = await call('GET', `/accounts/verify/Invoice/${inv1}`, { token: tok });
    check('verify bill: creator, postings balanced, stock, profit', r.status === 200 && r.data?.createdBy?.name === 'Acc Owner' && r.data.balanced && r.data.postings.length >= 3 && r.data.stock.length === 1 && eq(r.data.profit?.gross, 250), JSON.stringify({ s: r.status, p: r.data?.profit, st: r.data?.stock?.length }));
    check('verify bill: payment and history shown', r.data?.payments?.length >= 1 && r.data?.history?.some((h) => h.action === 'invoice.create'), JSON.stringify(r.data?.history?.map((h) => h.action)));
    const invNo = r.data?.no;
    r = await call('GET', `/accounts/search?q=${encodeURIComponent(invNo)}`, { token: tok });
    check('search by bill number', r.data?.documents?.some((d) => String(d._id) === String(inv1)), JSON.stringify(r.data?.documents?.map((d) => d.no)));
    r = await call('GET', '/accounts/search?q=Retail B2B', { token: tok });
    const hit = r.data?.parties?.[0];
    check('search by party: sales, payments, outstanding', hit && eq(hit.sales, 885) && eq(hit.outstanding, 408) && hit.payments >= 2, JSON.stringify(hit));
    await M.Invoice.updateOne({ _id: inv1 }, { $set: { invoiceDate: new Date(Date.now() - 10 * 86400000) } });
    r = await call('POST', '/purchases', { token: tok, body: { supplierId: sup, supplierBillNo: 'SB/77', items: [{ itemId: item, qty: 1, rate: 100, gstRate: 18 }] } });
    r = await call('POST', '/purchases', { token: tok, body: { supplierId: sup, supplierBillNo: 'sb-77', items: [{ itemId: item, qty: 1, rate: 100, gstRate: 18 }] } });
    r = await call('GET', '/accounts/audit-checks', { token: tok });
    const ck = (k) => r.data?.find((c) => c.key === k);
    check('backdated bill flagged', ck('backdated')?.count === 1 && ck('backdated').items[0].no === invNo, JSON.stringify(ck('backdated')));
    check('duplicate supplier bill flagged', ck('dup_supplier_bill')?.count === 1 && ck('dup_supplier_bill').items[0].count === 2, JSON.stringify(ck('dup_supplier_bill')));

    step('5d. GSTR-2B reconciliation');
    const supGstin = gstin('AAACS1111B');
    const twoB = { data: { docdata: { b2b: [{ ctin: supGstin, trdnm: 'Acc Supplier', inv: [
      { inum: 'SB77', dt: '01-09-2026', val: 118, itcavl: 'Y', items: [{ txval: 100, cgst: 9, sgst: 9 }] },
      { inum: 'X-999', dt: '02-09-2026', val: 590, items: [{ txval: 500, cgst: 45, sgst: 45 }] },
    ] }] } } };
    r = await call('POST', '/accounts/gst/2b', { token: tok, body: { period, json: twoB } });
    const s2 = r.data?.summary;
    check('2B: one matched, one not in books, rest not in 2B', r.status === 200 && s2?.matched === 1 && s2?.notInBooks === 1 && s2?.notIn2b === 2, JSON.stringify(s2));
    check('2B: safe ITC 18, at risk 378', eq(s2?.safeItc, 18) && eq(s2?.atRisk, 378), JSON.stringify(s2));
    r = await call('POST', '/accounts/gst/2b', { token: tok, body: { period, json: { foo: 1 } } });
    check('bad 2B file handled', r.status === 200 ? r.data?.summary?.in2b === 0 : r.status === 400, `${r.status}`);

    step('6. Permission');
    await call('POST', '/staff', { token: tok, body: { name: 'Acc Cashier', phone: PH.cashier, password: 'acc12345', staffRole: 'cashier' } });
    await M.User.updateOne({ phone: PH.cashier }, { $set: { mustChangePassword: false } });
    const cTok = (await call('POST', '/auth/login', { body: { phone: PH.cashier, password: 'acc12345' } })).data?.token;
    r = await call('GET', '/accounts/balance-sheet', { token: cTok });
    check('cashier cannot open books', r.status === 403, `${r.status}`);
  } finally {
    await cleanup().catch(() => {});
    server.close();
    await mongoose.disconnect();
  }
  console.log(`\n${failed === 0 ? G : R}${passed} pass, ${failed} fail${N}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => { console.error(`${R}Accounts check crash:${N}`, err); process.exit(1); });

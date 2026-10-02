/**
 * HISAAB KI JAANCH — har number haath ke hisaab se milao.
 *
 *   MONGO_URI=mongodb://127.0.0.1:27017/rakhrakhav_test node scripts/calc-check.js
 *
 * Ek GST wali dukaan pe kharid, bill (discount + extra discount + delivery,
 * same state aur doosra state), payment (jama ke saath), wapasi, cancel,
 * kharch aur kharid-wapasi chala kar dekhta hai ki bill, khata, stock, khep,
 * Fayda-Nuksan aur dashboard ke number wahi hain jo kagaz pe bante hain.
 */
import './test-env.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { round2 } from '../src/utils/money.js';
import { attendanceDays } from '../src/services/payroll.service.js';
import { monthOf } from '../src/utils/istDay.js';
import {
  User, Business, Party, Item, Invoice, LedgerEntry, StockMovement, StockLot, Payment, ReturnNote, Purchase, Expense,
} from '../src/models/index.js';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`${G}  ✔${N} ${name}`); } else { failed++; console.log(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
};
const eq = (name, got, want) => check(name, Math.abs(Number(got) - Number(want)) < 0.005, `got ${got}, want ${want}`);

const PORT = 5991;
const BASE = `http://localhost:${PORT}/api`;
const PHONE = '9333000001';
const otp = (phone) => jwt.sign({ phone, purpose: 'SIGNUP', otp: true }, env.jwtSecret, { expiresIn: '15m' });
let token = '';
async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, ...j };
}

async function cleanup() {
  const u = await User.findOne({ phone: PHONE }).lean();
  if (!u?.businessId) { await User.deleteMany({ phone: PHONE }); return; }
  const businessId = u.businessId;
  const models = Object.values(mongoose.models).filter((M) => M.schema.path('businessId'));
  await Promise.all(models.map((M) => M.deleteMany({ businessId })));
  await Business.deleteMany({ _id: businessId });
  await User.deleteMany({ $or: [{ phone: PHONE }, { businessId }] });
}

/** Har party: balance = khate ki entries ka jod */
async function ledgerMatches(businessId) {
  const parties = await Party.find({ businessId }).lean();
  for (const p of parties) {
    const agg = await LedgerEntry.aggregate([{ $match: { partyId: p._id } }, { $group: { _id: null, d: { $sum: '$debit' }, c: { $sum: '$credit' } } }]);
    const sum = round2((agg[0]?.d || 0) - (agg[0]?.c || 0));
    eq(`khata = entries ka jod (${p.name})`, p.balance, sum);
  }
}

/** Har item: stock = movements ka jod = bachi khep */
async function stockMatches(businessId) {
  const items = await Item.find({ businessId }).lean();
  for (const it of items) {
    const mv = await StockMovement.aggregate([{ $match: { itemId: it._id } }, { $group: { _id: null, q: { $sum: '$qty' } } }]);
    eq(`stock = movements (${it.name})`, it.stockQty, mv[0]?.q || 0);
    const lots = await StockLot.aggregate([{ $match: { itemId: it._id } }, { $group: { _id: null, q: { $sum: '$remaining' } } }]);
    eq(`stock = bachi khep (${it.name})`, it.stockQty, lots[0]?.q || 0);
  }
}

/** Har bill: due = total - paid, status sahi; retailer ka balance = khule bill ka baaki − jama */
async function billsMatch(businessId) {
  const invs = await Invoice.find({ businessId, isCancelled: false }).lean();
  for (const i of invs) {
    eq(`bill ${i.invoiceNo}: due = total − paid`, i.dueAmount, round2(i.grandTotal - i.paidAmount));
    const st = i.paidAmount <= 0 ? 'unpaid' : i.dueAmount <= 0 ? 'paid' : 'partial';
    check(`bill ${i.invoiceNo}: status ${st}`, i.paymentStatus === st, i.paymentStatus);
  }
  const retailers = await Party.find({ businessId, type: 'retailer' }).lean();
  for (const p of retailers) {
    const due = round2(invs.filter((i) => String(i.partyId) === String(p._id)).reduce((s, i) => s + i.dueAmount, 0));
    if (p.balance >= 0) eq(`${p.name}: khata = khule bill ka baaki`, p.balance, due);
    else eq(`${p.name}: jama ho to koi bill baaki nahi`, due, 0);
  }
}

async function run() {
  await connectDB();
  await cleanup();
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));
  try {
    let r = await call('POST', '/auth/wholesaler/signup', { name: 'Hisaab Malik', phone: PHONE, password: 'test1234', businessName: 'Hisaab Traders', otpToken: otp(PHONE) });
    token = r.data?.token;
    check('signup', Boolean(token), r.message);
    const businessId = (await User.findOne({ phone: PHONE }).lean()).businessId;
    await call('PUT', '/business/me', { onboardingSkipped: true });
    r = await call('PUT', '/business/me', { address: { line1: 'Market', city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' } });
    r = await call('PUT', '/business/me', { gstEnabled: true, gstin: '09AAACH7409R1ZZ' });
    check('GST chalu', r.status === 200, r.message);

    const party = async (body) => (await call('POST', '/parties', body)).data?._id;
    const A = await party({ type: 'retailer', name: 'Asha Stores', address: { city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' } });
    const B = await party({ type: 'retailer', name: 'Bombay Mart', address: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' } });
    const S = await party({ type: 'supplier', name: 'Sunil Supplier', address: { city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' } });
    const X = (await call('POST', '/items', { name: 'Bearing X', purchasePrice: 100, salePrice: 150, gstRate: 18, hsn: '8482' })).data?._id;
    const Yi = (await call('POST', '/items', { name: 'Chain Y', purchasePrice: 50, salePrice: 80, gstRate: 12, hsn: '7315' })).data?._id;
    check('party aur item bane', A && B && S && X && Yi);

    console.log(`\n${Y}1. Kharid: X 10×100 (18%), Y 20×50 (12%), ₹1000 diye${N}`);
    r = await call('POST', '/purchases', { supplierId: S, items: [{ itemId: X, qty: 10, rate: 100 }, { itemId: Yi, qty: 20, rate: 50 }], paidAmount: 1000, paymentMode: 'CASH' });
    eq('kharid kul 2300 (1000+180 + 1000+120)', r.data?.grandTotal, 2300);
    eq('kharid baaki 1300', r.data?.dueAmount, 1300);
    const pur1 = r.data?._id;

    console.log(`\n${Y}2. Bill A: X 4×150 −20, Y 5×80, extra −98, delivery +50, ₹500 mile${N}`);
    r = await call('POST', '/invoices', { partyId: A, items: [{ itemId: X, qty: 4, rate: 150, discount: 20 }, { itemId: Yi, qty: 5, rate: 80 }], extraDiscount: 98, deliveryCharge: 50, paidAmount: 500 });
    check('bill bana', r.status === 201, r.message);
    const inv1 = r.data;
    // 580 + 400 = 980; extra 98 → X 58, Y 40 → 522 + 360 = 882
    eq('taxable 882', inv1?.taxableTotal, 882);
    // X 522×18% = 93.96, Y 360×12% = 43.2 → 137.16
    eq('GST 137.16 (CGST+SGST)', round2(inv1?.cgstTotal + inv1?.sgstTotal), 137.16);
    eq('CGST + SGST barabar baante', Math.abs(inv1?.cgstTotal - inv1?.sgstTotal) <= 0.01 ? 1 : 0, 1);
    eq('discount kul 118', inv1?.discountTotal, 118);
    // 882 + 137.16 = 1019.16 → 1019 (−0.16) + 50 delivery = 1069
    eq('round off −0.16', inv1?.roundOff, -0.16);
    eq('kul 1069 (delivery ke saath)', inv1?.grandTotal, 1069);
    eq('baaki 569', inv1?.dueAmount, 569);
    eq('line X ka discount 20+58', inv1?.items?.[0]?.discount, 78);

    console.log(`\n${Y}3. Bill B (Maharashtra → IGST): X 2×200${N}`);
    r = await call('POST', '/invoices', { partyId: B, items: [{ itemId: X, qty: 2, rate: 200 }] });
    const inv2 = r.data;
    eq('IGST 72', inv2?.igstTotal, 72);
    eq('kul 472', inv2?.grandTotal, 472);

    console.log(`\n${Y}4. A ne ₹600 diye (baaki 569) → 31 jama${N}`);
    r = await call('POST', '/payments', { partyId: A, amount: 600, mode: 'UPI' });
    check('bina haan ke zyada paisa ruka', r.status === 400, `${r.status}`);
    r = await call('POST', '/payments', { partyId: A, amount: 600, mode: 'UPI', allowAdvance: true });
    check('jama ke saath payment bani', r.status === 201, r.message);
    eq('A ka khata −31 (jama)', (await Party.findById(A).lean()).balance, -31);
    eq('bill 1 chukta', (await Invoice.findById(inv1._id).lean()).dueAmount, 0);

    console.log(`\n${Y}5. Bill A: Y 1×80 → 89.6 → 90, jama 31 apne aap kata${N}`);
    r = await call('POST', '/invoices', { partyId: A, items: [{ itemId: Yi, qty: 1, rate: 80 }] });
    const inv3 = r.data;
    eq('kul 90 (round off +0.40)', inv3?.grandTotal, 90);
    eq('round off +0.4', inv3?.roundOff, 0.4);
    const inv3db = await Invoice.findById(inv3?._id).lean();
    eq('jama 31 bill pe laga → baaki 59', inv3db?.dueAmount, 59);
    eq('A ka khata 59', (await Party.findById(A).lean()).balance, 59);

    r = await call('GET', `/returns/prefill/SALE_RETURN/${inv1._id}`);
    // X: 4×150 − 20 − 58 = 522 → 130.5 per piece (discount ke baad)
    eq('wapasi ka rate asal daam 130.5 (list 150 nahi)', r.data?.items?.find((i) => String(i.itemId) === String(X))?.rate, 130.5);

    console.log(`\n${Y}6. B ne bill 2 ka X 1 wapas kiya${N}`);
    r = await call('POST', '/returns', { type: 'SALE_RETURN', partyId: B, invoiceId: inv2._id, items: [{ itemId: X, qty: 1, rate: 200 }] });
    check('wapasi bani', r.status === 201, r.message);
    eq('credit note 236', r.data?.grandTotal, 236);
    eq('B ka khata 236', (await Party.findById(B).lean()).balance, 236);
    eq('bill 2 baaki 236', (await Invoice.findById(inv2._id).lean()).dueAmount, 236);

    console.log(`\n${Y}7. Kharch ₹300, bill 3 cancel, kharid-wapasi Y 2${N}`);
    r = await call('POST', '/expenses', { category: 'rent', amount: 300, mode: 'CASH' });
    check('kharch bana', r.status === 201, r.message);
    r = await call('POST', `/invoices/${inv3._id}/cancel`, { reason: 'galti' });
    check('bill 3 cancel', r.status === 200, r.message);
    eq('cancel ke baad A ka jama wapas −31', (await Party.findById(A).lean()).balance, -31);
    r = await call('POST', '/returns', { type: 'PURCHASE_RETURN', partyId: S, purchaseId: pur1, items: [{ itemId: Yi, qty: 2, rate: 50 }] });
    check('kharid-wapasi bani', r.status === 201, r.message);
    eq('debit note 112', r.data?.grandTotal, 112);

    console.log(`\n${Y}8. Stock aur khep${N}`);
    eq('X stock 10 − 4 − 2 + 1 = 5', (await Item.findById(X).lean()).stockQty, 5);
    eq('Y stock 20 − 5 − 1 + 1 − 2 = 13', (await Item.findById(Yi).lean()).stockQty, 13);
    await stockMatches(businessId);

    console.log(`\n${Y}9. Khata aur bill${N}`);
    await ledgerMatches(businessId);
    await billsMatch(businessId);
    const sup = await Party.findById(S).lean();
    eq('supplier ka baaki 1300 − 112 = 1188', Math.abs(sup.balance), 1188);

    console.log(`\n${Y}10. Fayda-Nuksan (aaj)${N}`);
    r = await call('GET', '/reports/pl');
    const m = r.data?.meta || {};
    // Sale: 882 + 400 = 1282, wapasi 200 → 1082
    eq('asli sale 1082', m.netSale, 1082);
    // Lagat: bill1 4×100 + 5×50 = 650, bill2 2×100 = 200, wapasi −100 → 750
    eq('lagat 750', m.cost, 750);
    eq('maal ka fayda 332', m.grossProfit, 332);
    eq('delivery charge 50', m.deliveryIncome, 50);
    eq('kharch 300', m.expenses, 300);
    eq('asli fayda 332 + 50 − 300 = 82', m.netProfit, 82);

    console.log(`\n${Y}11. Dashboard${N}`);
    r = await call('GET', '/dashboard');
    const d = r.data || {};
    console.log(D + JSON.stringify({ today: d.today, sales: d.sales, profit: d.profit }).slice(0, 600) + N);
    eq('dashboard ka mahine ka fayda = P&L', d.profit?.month ?? d.profit?.net ?? m.netProfit, m.netProfit);
    // A ka jama 31; supplier ko pehle kuch advance de kar dekho ki wo jama me na jude
    await call('POST', '/payments', { partyId: S, direction: 'OUT', amount: 2000, allowAdvance: true });
    r = await call('GET', '/dashboard');
    eq('dashboard ka jama paisa sirf graahak ka (31)', r.data?.khata?.advance, 31);
    eq('dashboard: aaj ki bikri 1069 + 472', r.data?.sale?.today, 1541);

    console.log(`\n${Y}12. Udhaar report${N}`);
    r = await call('GET', '/reports/outstanding');
    const total = (r.data?.rows || []).reduce((s, x) => s + x.balance, 0);
    eq('udhaar = B ka 236 (A ka jama hai)', total, 236);

    console.log(`\n${Y}13. GSTR-3B (is mahine)${N}`);
    const period = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);
    r = await call('GET', `/accounts/gst/gstr3b?period=${period}`);
    const o = r.data?.table31?.a || {};
    // Bahar: 882 + 400 − 200 = 1082; tax: 137.16 + 72 − 36 = 173.16
    eq('3.1(a) taxable 1082', o.taxable, 1082);
    eq('3.1(a) tax 173.16', round2((o.igst || 0) + (o.cgst || 0) + (o.sgst || 0)), 173.16);
    const itc = r.data?.table4?.net || {};
    // Supplier ka GSTIN nahi → kharid ka 300 ITC nahi milta, aur uski wapasi bhi ITC nahi ghatati
    eq('ITC 0 (supplier bina GSTIN)', round2((itc.igst || 0) + (itc.cgst || 0) + (itc.sgst || 0)), 0);
    eq('na milne wala GST 300', r.data?.table4?.notEligible?.tax, 300);

    console.log(`\n${Y}14. Accounts: khaate barabar${N}`);
    r = await call('GET', '/accounts/trial-balance');
    const tb = r.data || {};
    eq('trial balance: debit = credit', tb.totals?.dr ?? tb.totalDebit ?? tb.totals?.debit, tb.totals?.cr ?? tb.totalCredit ?? tb.totals?.credit);
    r = await call('GET', '/accounts/checks');
    const bad = (r.data?.checks || r.data || []).filter?.((c) => c.ok === false) || [];
    check('book checks sab theek', bad.length === 0, JSON.stringify(bad).slice(0, 300));

    console.log(`\n${Y}15. FIFO: Z opening 5×60, kharid 5×80, bikri 7 → lagat 300 + 160 = 460${N}`);
    const Z = (await call('POST', '/items', { name: 'Gear Z', purchasePrice: 60, salePrice: 100, gstRate: 0, openingStock: 5 })).data?._id;
    r = await call('POST', '/purchases', { items: [{ itemId: Z, qty: 5, rate: 80 }] });
    eq('nakad kharid poori chukta', r.data?.dueAmount, 0);
    r = await call('POST', '/invoices', { partyId: B, items: [{ itemId: Z, qty: 7, rate: 100 }] });
    const zInv = await Invoice.findById(r.data?._id).lean();
    eq('bill line ki lagat 460 (FIFO)', zInv?.items?.[0]?.costTotal, 460);
    eq('Z stock 3', (await Item.findById(Z).lean()).stockQty, 3);

    console.log(`\n${Y}16. Zyada paisa fayde me: Z 1×100, ₹120 mile${N}`);
    r = await call('POST', '/invoices', { partyId: B, items: [{ itemId: Z, qty: 1, rate: 100 }], paidAmount: 120, extraAsProfit: true });
    eq('bill 120 ka bana', r.data?.grandTotal, 120);
    eq('rate 120 hua', r.data?.items?.[0]?.rate, 120);
    eq('baaki 0', r.data?.dueAmount, 0);

    console.log(`\n${Y}17. Payment mitana: B se 100 liye, phir mita diye${N}`);
    const bBefore = (await Party.findById(B).lean()).balance;
    r = await call('POST', '/payments', { partyId: B, amount: 100 });
    const payId = r.data?._id;
    eq('B ka khata 100 ghata', (await Party.findById(B).lean()).balance, round2(bBefore - 100));
    r = await call('DELETE', `/payments/${payId}`);
    check('payment mita', r.status === 200, r.message);
    eq('B ka khata wapas', (await Party.findById(B).lean()).balance, bBefore);

    console.log(`\n${Y}18. Kharab maal: Z 1 → kharch 80 (FIFO), phir mitaya${N}`);
    r = await call('POST', '/expenses', { category: 'waste-stock', amount: 0.01, wasteItemId: Z, wasteQty: 1 });
    check('waste kharch bana', r.status === 201, r.message);
    eq('waste ki lagat 80 (bachi khep 80 wali)', r.data?.amount, 80);
    eq('Z stock 2 − 1 = 1', (await Item.findById(Z).lean()).stockQty, 1);
    r = await call('DELETE', `/expenses/${r.data?._id}`);
    check('waste kharch mitaya', r.status === 200, r.message);
    eq('Z stock wapas 2', (await Item.findById(Z).lean()).stockQty, 2);

    console.log(`\n${Y}19. Nakad kharid mitana${N}`);
    r = await call('POST', '/purchases', { items: [{ itemId: Z, qty: 2, rate: 90 }] });
    eq('Z stock 2 + 2 = 4', (await Item.findById(Z).lean()).stockQty, 4);
    r = await call('DELETE', `/purchases/${r.data?._id}`);
    check('kharid mitayi', r.status === 200, r.message);
    eq('Z stock wapas 2', (await Item.findById(Z).lean()).stockQty, 2);

    console.log(`\n${Y}21. Supplier: wapasi aur ₹2000 advance ke baad${N}`);
    eq('kharid 1 poori chukta', (await Purchase.findById(pur1).lean()).dueAmount, 0);
    eq('supplier ko advance 2000 − 1188 = 812 (minus balance)', (await Party.findById(S).lean()).balance, -812);

    console.log(`\n${Y}22. Opening balance 500 wali party, 500 mile${N}`);
    const C = await party({ type: 'retailer', name: 'Chandra Traders', openingBalance: 500, address: { city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208001' } });
    eq('opening se khata 500', (await Party.findById(C).lean()).balance, 500);
    r = await call('POST', '/payments', { partyId: C, amount: 500 });
    check('payment bani', r.status === 201, r.message);
    eq('khata 0', (await Party.findById(C).lean()).balance, 0);

    console.log(`\n${Y}23. Poora chukta bill wapas → jama → cash wapas${N}`);
    r = await call('POST', '/invoices', { partyId: C, items: [{ itemId: Yi, qty: 1, rate: 80 }], paidAmount: 90 });
    const cInv = r.data;
    eq('bill 90 chukta', cInv?.dueAmount, 0);
    r = await call('POST', '/returns', { type: 'SALE_RETURN', partyId: C, invoiceId: cInv._id, items: [{ itemId: Yi, qty: 1, rate: 80 }] });
    const cRet = r.data;
    eq('credit note 90 (80 + 9.6 → 90)', cRet?.grandTotal, 90);
    eq('C ka jama 90', (await Party.findById(C).lean()).balance, -90);
    r = await call('GET', `/payments/refund/${cRet._id}`);
    eq('wapas ho sakta hai 90', r.data?.refundable, 90);
    r = await call('POST', `/payments/refund/${cRet._id}`, { mode: 'CASH' });
    check('cash wapas diya', r.status === 201 || r.status === 200, r.message);
    eq('C ka khata 0', (await Party.findById(C).lean()).balance, 0);
    r = await call('POST', `/payments/refund/${cRet._id}`, { mode: 'CASH' });
    check('doobara refund nahi', r.status === 400, `${r.status}`);

    console.log(`\n${Y}24. Quotation: Y 3×80, 10% chhoot, 12% GST${N}`);
    r = await call('POST', '/quotations', { partyId: A, items: [{ itemId: Yi, qty: 3, rate: 80, discountPct: 10 }] });
    // 240 → 216 → GST 25.92 → 241.92 → 242
    eq('quotation taxable 216', r.data?.items?.[0]?.taxable, 216);
    eq('quotation kul 242', r.data?.total, 242);

    console.log(`\n${Y}20. Salary ke din (Sep 2026, ravivaar chhutti)${N}`);
    const sep = monthOf('2026-09').days;   // 30 din, 4 ravivaar → 26 kaam ke din
    const emp = { joiningDate: new Date('2026-01-01') };
    let a = attendanceDays(emp, [], sep, [0], '2026-10-02', '2026-08-01');
    eq('pehle se attendance, Sep me ek bhi entry nahi → 0 din ki salary', a.paidDays, 0);
    eq('26 din gair-haazir', a.absentDays, 26);
    a = attendanceDays(emp, [], sep, [0], '2026-10-02', undefined);
    eq('attendance kabhi lagi hi nahi → poore 26 din', a.paidDays, 26);
    a = attendanceDays({ joiningDate: new Date('2026-09-15') }, [{ day: '2026-09-15', status: 'present' }], sep, [0], '2026-10-02', '2026-09-15');
    // 15–30 Sep: 16 din, 2 ravivaar (20, 27) → 14 kaam ke din; 1 haazir
    eq('beech mahine judne wala: 1 haazir', a.paidDays, 1);
    eq('beech mahine judne wala: 13 gair-haazir', a.absentDays, 13);

    console.log(`\n${Y}20. Sab ke baad phir se niyam${N}`);
    await stockMatches(businessId);
    await ledgerMatches(businessId);
    await billsMatch(businessId);
  } finally {
    await cleanup();
    server.close();
    await mongoose.disconnect();
  }
  console.log(`\n${failed ? R : G}${passed} pass, ${failed} fail${N}\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });

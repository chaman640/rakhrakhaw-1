import mongoose from 'mongoose';
import { round2 } from '../utils/money.js';
import { PARTY_TYPES, TAX_TYPES } from '../config/constants.js';
import { getStateName, stateCodeFromGstin } from '../config/states.js';
import { validateGstin } from '../utils/gstin.js';
import { monthOf, dayFrom, dayTo } from '../utils/istDay.js';
import {
  Business, Invoice, Purchase, ReturnNote, Party,
} from '../models/index.js';

/**
 * GST RETURNS — app ke bill/purchase/return se seedha. GSTN pe upload nahi
 * karte; CA ya dukaandaar yahi numbers portal me bharta hai (CSV bhi milta hai).
 */

const oid = (v) => new mongoose.Types.ObjectId(String(v));
// B2C (Large): doosre state ka bina-GSTIN bill ₹1 lakh se upar (Aug 2024 se)
const B2CL_LIMIT = 100000;

export function monthRange(period) {
  const { start, end } = monthOf(period);
  return { from: start, to: new Date(end.getTime() - 1) };
}

const zero = () => ({ taxable: 0, igst: 0, cgst: 0, sgst: 0 });
const addTax = (a, b, sign = 1) => {
  a.taxable = round2(a.taxable + sign * (b.taxable || 0));
  a.igst = round2(a.igst + sign * (b.igst || 0));
  a.cgst = round2(a.cgst + sign * (b.cgst || 0));
  a.sgst = round2(a.sgst + sign * (b.sgst || 0));
  return a;
};

function rateRows(items) {
  const m = new Map();
  for (const l of items || []) {
    const r = m.get(l.gstRate) || { rate: l.gstRate, ...zero() };
    addTax(r, { taxable: l.taxableValue, igst: l.igst, cgst: l.cgst, sgst: l.sgst });
    m.set(l.gstRate, r);
  }
  return [...m.values()].sort((a, b) => a.rate - b.rate);
}

async function context(businessId) {
  const b = await Business.findById(businessId).select('name gstin stateCode gstEnabled').lean();
  return { gstin: b?.gstin || '', stateCode: b?.stateCode || stateCodeFromGstin(b?.gstin), gstEnabled: Boolean(b?.gstEnabled), name: b?.name || '' };
}

/* ─────────────────────────────── GSTR-1 ─────────────────────────────── */

export async function gstr1(businessId, { period }) {
  const { from, to } = monthRange(period);
  const bid = oid(businessId);
  const biz = await context(businessId);
  const [invoices, cancelled, returns] = await Promise.all([
    Invoice.find({ businessId: bid, gstEnabled: true, isCancelled: false, invoiceDate: { $gte: from, $lte: to } })
      .select('invoiceNo invoiceDate grandTotal taxType placeOfSupplyStateCode partySnapshot items').sort({ invoiceDate: 1 }).lean(),
    Invoice.countDocuments({ businessId: bid, gstEnabled: true, isCancelled: true, invoiceDate: { $gte: from, $lte: to } }),
    ReturnNote.find({ businessId: bid, type: 'SALE_RETURN', gstEnabled: true, returnDate: { $gte: from, $lte: to } })
      .select('returnNo returnDate againstNo grandTotal taxType partySnapshot items').lean(),
  ]);

  const b2b = []; const b2cl = []; const b2cs = new Map(); const cdnr = []; const hsn = new Map();
  const pos = (doc) => doc.placeOfSupplyStateCode || doc.partySnapshot?.address?.stateCode || stateCodeFromGstin(doc.partySnapshot?.gstin) || biz.stateCode;
  const addHsn = (items, sign) => {
    for (const l of items || []) {
      const k = `${l.hsn || ''}|${l.gstRate}`;
      const h = hsn.get(k) || { hsn: l.hsn || '', description: l.name, uqc: l.unit || 'OTH', rate: l.gstRate, qty: 0, value: 0, ...zero() };
      h.qty = round2(h.qty + sign * l.qty);
      h.value = round2(h.value + sign * (l.total || 0));
      addTax(h, { taxable: l.taxableValue, igst: l.igst, cgst: l.cgst, sgst: l.sgst }, sign);
      hsn.set(k, h);
    }
  };

  for (const inv of invoices) {
    const gstin = (inv.partySnapshot?.gstin || '').toUpperCase();
    const place = pos(inv);
    const rates = rateRows(inv.items);
    addHsn(inv.items, 1);
    const base = { invoiceNo: inv.invoiceNo, date: inv.invoiceDate, value: inv.grandTotal, placeOfSupply: `${place}-${getStateName(place)}`, rates };
    if (gstin) b2b.push({ ...base, gstin, name: inv.partySnapshot?.name || '', reverseCharge: 'N' });
    else if (inv.taxType === TAX_TYPES.IGST && inv.grandTotal > B2CL_LIMIT) b2cl.push({ ...base, name: inv.partySnapshot?.name || '' });
    else {
      for (const r of rates) {
        const k = `${place}|${r.rate}`;
        const row = b2cs.get(k) || { placeOfSupply: `${place}-${getStateName(place)}`, type: inv.taxType === TAX_TYPES.IGST ? 'Inter-state' : 'Intra-state', rate: r.rate, ...zero() };
        b2cs.set(k, addTax(row, r));
      }
    }
  }
  for (const n of returns) {
    const gstin = (n.partySnapshot?.gstin || '').toUpperCase();
    addHsn(n.items, -1);
    if (gstin) {
      cdnr.push({ gstin, name: n.partySnapshot?.name || '', noteNo: n.returnNo, date: n.returnDate, againstNo: n.againstNo || '', noteType: 'C', value: n.grandTotal, rates: rateRows(n.items) });
    } else {
      const place = pos(n);
      for (const r of rateRows(n.items)) {
        const k = `${place}|${r.rate}`;
        const row = b2cs.get(k) || { placeOfSupply: `${place}-${getStateName(place)}`, type: n.taxType === TAX_TYPES.IGST ? 'Inter-state' : 'Intra-state', rate: r.rate, ...zero() };
        b2cs.set(k, addTax(row, r, -1));
      }
    }
  }

  const sumRates = (list) => list.reduce((acc, d) => { for (const r of d.rates) addTax(acc, r); return acc; }, zero());
  const b2csRows = [...b2cs.values()].sort((a, b) => a.placeOfSupply.localeCompare(b.placeOfSupply) || a.rate - b.rate);
  const nos = invoices.map((i) => i.invoiceNo);
  return {
    period, business: biz,
    summary: {
      b2b: { count: b2b.length, ...sumRates(b2b) },
      b2cl: { count: b2cl.length, ...sumRates(b2cl) },
      b2cs: { count: b2csRows.length, ...b2csRows.reduce((a, r) => addTax(a, r), zero()) },
      cdnr: { count: cdnr.length, ...sumRates(cdnr) },
    },
    b2b, b2cl, b2cs: b2csRows, cdnr,
    hsn: [...hsn.values()].sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate),
    docs: { from: nos[0] || '', to: nos[nos.length - 1] || '', total: invoices.length + cancelled, cancelled },
  };
}

/* ─────────────────────────────── input tax ─────────────────────────────── */

async function inputTax(businessId, { from, to }, biz) {
  const bid = oid(businessId);
  const [purchases, returns] = await Promise.all([
    Purchase.find({ businessId: bid, purchaseDate: { $gte: from, $lte: to }, taxTotal: { $gt: 0 } })
      .select('purchaseNo supplierBillNo purchaseDate supplierId taxableTotal taxTotal grandTotal').lean(),
    ReturnNote.find({ businessId: bid, type: 'PURCHASE_RETURN', returnDate: { $gte: from, $lte: to } })
      .select('returnNo returnDate partyId partySnapshot taxableTotal cgstTotal sgstTotal igstTotal').lean(),
  ]);
  const sup = await Party.find({ _id: { $in: [...purchases.map((p) => p.supplierId), ...returns.map((r) => r.partyId)] } }).select('name gstin stateCode').lean();
  const sm = new Map(sup.map((s) => [String(s._id), s]));
  const eligible = zero(); const blocked = { taxable: 0, tax: 0, count: 0 };
  const rows = [];
  for (const p of purchases) {
    const s = sm.get(String(p.supplierId));
    const gstin = (s?.gstin || '').toUpperCase();
    const state = s?.stateCode || stateCodeFromGstin(gstin);
    const inter = state && biz.stateCode && state !== biz.stateCode;
    const t = { taxable: p.taxableTotal, igst: inter ? p.taxTotal : 0, cgst: inter ? 0 : round2(p.taxTotal / 2), sgst: inter ? 0 : round2(p.taxTotal - round2(p.taxTotal / 2)) };
    if (gstin) addTax(eligible, t);
    else { blocked.taxable = round2(blocked.taxable + p.taxableTotal); blocked.tax = round2(blocked.tax + p.taxTotal); blocked.count += 1; }
    rows.push({ no: p.purchaseNo, billNo: p.supplierBillNo || '', date: p.purchaseDate, supplier: s?.name || '', gstin, eligible: Boolean(gstin), ...t, value: p.grandTotal });
  }
  // Sirf wahi wapasi ITC ghatati hai jiska ITC liya gaya tha (supplier ka GSTIN ho)
  const reversal = returns
    .filter((r) => (sm.get(String(r.partyId))?.gstin || r.partySnapshot?.gstin || '').trim())
    .reduce((a, r) => addTax(a, { taxable: r.taxableTotal, igst: r.igstTotal, cgst: r.cgstTotal, sgst: r.sgstTotal }), zero());
  return { rows, eligible, blocked, reversal, net: addTax({ ...eligible }, reversal, -1) };
}

/* ─────────────────────────────── GSTR-3B ─────────────────────────────── */

function setOff(out, itc) {
  const pay = { igst: out.igst, cgst: out.cgst, sgst: out.sgst };
  const cr = { igst: Math.max(0, itc.igst), cgst: Math.max(0, itc.cgst), sgst: Math.max(0, itc.sgst) };
  const use = (from, head) => { const u = Math.min(cr[from], pay[head]); cr[from] = round2(cr[from] - u); pay[head] = round2(pay[head] - u); };
  use('igst', 'igst'); use('igst', 'cgst'); use('igst', 'sgst');
  use('cgst', 'cgst'); use('cgst', 'igst');
  use('sgst', 'sgst'); use('sgst', 'igst');
  return { payable: pay, carryForward: cr, totalPayable: round2(pay.igst + pay.cgst + pay.sgst) };
}

export async function gstr3b(businessId, { period }) {
  const range = monthRange(period);
  const bid = oid(businessId);
  const biz = await context(businessId);
  const [out, zeroRated, sr, itc] = await Promise.all([
    Invoice.aggregate([
      { $match: { businessId: bid, gstEnabled: true, isCancelled: false, invoiceDate: { $gte: range.from, $lte: range.to } } },
      { $unwind: '$items' }, { $match: { 'items.gstRate': { $gt: 0 } } },
      { $group: { _id: null, taxable: { $sum: '$items.taxableValue' }, igst: { $sum: '$items.igst' }, cgst: { $sum: '$items.cgst' }, sgst: { $sum: '$items.sgst' } } },
    ]),
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, invoiceDate: { $gte: range.from, $lte: range.to } } },
      { $unwind: '$items' }, { $match: { 'items.gstRate': 0 } },
      { $group: { _id: null, taxable: { $sum: '$items.taxableValue' } } },
    ]),
    ReturnNote.aggregate([
      { $match: { businessId: bid, type: 'SALE_RETURN', gstEnabled: true, returnDate: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: null, taxable: { $sum: '$taxableTotal' }, igst: { $sum: '$igstTotal' }, cgst: { $sum: '$cgstTotal' }, sgst: { $sum: '$sgstTotal' } } },
    ]),
    inputTax(businessId, range, biz),
  ]);
  const outward = addTax(addTax(zero(), out[0] || {}), sr[0] || {}, -1);
  const result = setOff(outward, itc.net);
  return {
    period, business: biz,
    table31: { a: outward, c: { taxable: round2(zeroRated[0]?.taxable || 0) } },
    table4: { available: itc.eligible, reversed: itc.reversal, net: itc.net, notEligible: itc.blocked },
    ...result,
  };
}

export async function purchaseGst(businessId, q) {
  const range = q.period ? monthRange(q.period) : { from: dayFrom(q.from), to: dayTo(q.to) };
  const biz = await context(businessId);
  return { ...(await inputTax(businessId, range, biz)), period: q.period };
}

/* ─────────────────────────────── checks ─────────────────────────────── */

export async function gstChecks(businessId, { period }) {
  const { from, to } = monthRange(period);
  const bid = oid(businessId);
  const biz = await context(businessId);
  const [invoices, noGstinSuppliers] = await Promise.all([
    Invoice.find({ businessId: bid, gstEnabled: true, isCancelled: false, invoiceDate: { $gte: from, $lte: to } }).select('invoiceNo partySnapshot items').lean(),
    Purchase.aggregate([
      { $match: { businessId: bid, purchaseDate: { $gte: from, $lte: to }, taxTotal: { $gt: 0 } } },
      { $lookup: { from: 'parties', localField: 'supplierId', foreignField: '_id', as: 's' } },
      { $match: { $or: [{ 's.gstin': '' }, { 's.gstin': null }] } },
      { $project: { purchaseNo: 1, taxTotal: 1, name: { $first: '$s.name' } } },
    ]),
  ]);
  const noHsn = invoices.filter((i) => i.items.some((l) => !l.hsn)).map((i) => i.invoiceNo);
  const badGstin = invoices.filter((i) => i.partySnapshot?.gstin && !validateGstin(i.partySnapshot.gstin).valid).map((i) => `${i.invoiceNo} (${i.partySnapshot.gstin})`);
  const unregistered = await Party.countDocuments({ businessId: bid, type: PARTY_TYPES.RETAILER, gstin: { $in: ['', null] } });
  return [
    { key: 'gstin', ok: Boolean(biz.gstin), title: 'Business GSTIN is set', detail: biz.gstin ? biz.gstin : 'Add GSTIN in Profile → Business to file returns' },
    { key: 'hsn', ok: !noHsn.length, title: 'Every GST bill line has an HSN code', detail: noHsn.slice(0, 10).join(', '), count: noHsn.length },
    { key: 'b2b', ok: !badGstin.length, title: 'Customer GSTINs on bills are valid', detail: badGstin.slice(0, 10).join(', '), count: badGstin.length },
    { key: 'itc', ok: !noGstinSuppliers.length, title: 'Purchases with GST are from registered suppliers', detail: noGstinSuppliers.slice(0, 10).map((p) => `${p.purchaseNo} · ${p.name || ''} · ₹${round2(p.taxTotal)}`).join('; '), count: noGstinSuppliers.length, hint: 'Tax paid to suppliers without a GSTIN cannot be claimed as ITC. Add their GSTIN in the supplier profile.' },
    { key: 'info', ok: true, title: `${unregistered} customer(s) without GSTIN are reported as B2C`, detail: '' },
  ];
}

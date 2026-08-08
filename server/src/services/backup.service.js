import { toCsv } from '../utils/csv.js';
import {
  Business, Party, Category, Item, PartyItemRate, StockMovement,
  Purchase, Order, Invoice, LedgerEntry, Payment, ReturnNote, User,
} from '../models/index.js';

/**
 * "Mera data mujhe do."
 *
 * Do tarah se:
 *   1. Poora JSON backup — sab kuch, ek file me. Kabhi app chhodni pade to ye kaam aayega.
 *   2. Alag alag CSV — Excel me kholne ke liye.
 *
 * Password kabhi bahar nahi jata (User se sirf naam/phone/role).
 */

const clean = (docs) => docs.map((d) => { const { __v, ...rest } = d; return rest; });

export async function fullBackup(businessId) {
  const [
    business, users, parties, categories, items, rates, movements,
    purchases, orders, invoices, ledger, payments, returns,
  ] = await Promise.all([
    Business.findById(businessId).lean(),
    User.find({ businessId }).select('name phone role staffRole permissions isActive createdAt').lean(),
    Party.find({ businessId }).lean(),
    Category.find({ businessId }).lean(),
    Item.find({ businessId }).lean(),
    PartyItemRate.find({ businessId }).lean(),
    StockMovement.find({ businessId }).lean(),
    Purchase.find({ businessId }).lean(),
    Order.find({ businessId }).lean(),
    Invoice.find({ businessId }).lean(),
    LedgerEntry.find({ businessId }).lean(),
    Payment.find({ businessId }).lean(),
    ReturnNote.find({ businessId }).lean(),
  ]);

  const data = {
    business, users: clean(users), parties: clean(parties), categories: clean(categories),
    items: clean(items), rates: clean(rates), stockMovements: clean(movements),
    purchases: clean(purchases), orders: clean(orders), invoices: clean(invoices),
    ledger: clean(ledger), payments: clean(payments), returns: clean(returns),
  };

  return {
    meta: {
      app: 'Rakh Rakhav',
      version: 1,
      businessName: business?.name || '',
      takenAt: new Date().toISOString(),
      counts: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : (v ? 1 : 0)])
      ),
    },
    data,
  };
}

/** Backup lene se pehle "kitna data hai" dikhane ke liye */
export async function backupSummary(businessId) {
  const [parties, items, purchases, orders, invoices, payments, returns, staff] = await Promise.all([
    Party.countDocuments({ businessId }),
    Item.countDocuments({ businessId }),
    Purchase.countDocuments({ businessId }),
    Order.countDocuments({ businessId }),
    Invoice.countDocuments({ businessId }),
    Payment.countDocuments({ businessId }),
    ReturnNote.countDocuments({ businessId }),
    User.countDocuments({ businessId, role: 'wholesaler' }),
  ]);
  return { parties, items, purchases, orders, invoices, payments, returns, staff };
}

/* ------------------------------------------------------------------- CSV */

const CSV_BUILDERS = {
  async parties(businessId) {
    const rows = await Party.find({ businessId }).sort({ name: 1 }).lean();
    const headers = ['type', 'name', 'shopName', 'phone', 'email', 'gstin',
      'city', 'state', 'pincode', 'openingBalance', 'balance', 'creditLimit', 'status'];
    return {
      headers,
      rows: rows.map((p) => ({
        type: p.type, name: p.name, shopName: p.shopName || '', phone: p.phone,
        email: p.email || '', gstin: p.gstin || '',
        city: p.address?.city || '', state: p.address?.state || '', pincode: p.address?.pincode || '',
        openingBalance: p.openingBalance || 0, balance: p.balance || 0,
        creditLimit: p.creditLimit || 0, status: p.status,
      })),
    };
  },

  async invoices(businessId) {
    const rows = await Invoice.find({ businessId }).sort({ invoiceDate: 1 }).lean();
    const headers = ['invoiceNo', 'date', 'party', 'gstin', 'items', 'taxable',
      'cgst', 'sgst', 'igst', 'grandTotal', 'paid', 'due', 'status'];
    return {
      headers,
      rows: rows.map((i) => ({
        invoiceNo: i.invoiceNo,
        date: new Date(i.invoiceDate).toISOString().slice(0, 10),
        party: i.partySnapshot?.shopName || i.partySnapshot?.name || '',
        gstin: i.partySnapshot?.gstin || '',
        items: i.items.length,
        taxable: i.taxableTotal, cgst: i.cgstTotal, sgst: i.sgstTotal, igst: i.igstTotal,
        grandTotal: i.grandTotal, paid: i.paidAmount, due: i.dueAmount,
        status: i.isCancelled ? 'CANCELLED' : i.paymentStatus,
      })),
    };
  },

  async khata(businessId) {
    const [rows, parties] = await Promise.all([
      LedgerEntry.find({ businessId }).sort({ date: 1, createdAt: 1 }).lean(),
      Party.find({ businessId }).select('name shopName').lean(),
    ]);
    const nameMap = Object.fromEntries(parties.map((p) => [String(p._id), p.shopName || p.name]));
    const headers = ['date', 'party', 'type', 'refNo', 'debit', 'credit', 'balanceAfter', 'note'];
    return {
      headers,
      rows: rows.map((e) => ({
        date: new Date(e.date).toISOString().slice(0, 10),
        party: nameMap[String(e.partyId)] || '',
        type: e.type, refNo: e.refNo || '',
        debit: e.debit, credit: e.credit, balanceAfter: e.balanceAfter,
        note: e.note || '',
      })),
    };
  },

  async payments(businessId) {
    const [rows, parties] = await Promise.all([
      Payment.find({ businessId }).sort({ date: 1 }).lean(),
      Party.find({ businessId }).select('name shopName').lean(),
    ]);
    const nameMap = Object.fromEntries(parties.map((p) => [String(p._id), p.shopName || p.name]));
    const headers = ['paymentNo', 'date', 'party', 'direction', 'mode', 'amount', 'reference', 'status'];
    return {
      headers,
      rows: rows.map((p) => ({
        paymentNo: p.paymentNo,
        date: new Date(p.date).toISOString().slice(0, 10),
        party: nameMap[String(p.partyId)] || '',
        direction: p.direction, mode: p.mode, amount: p.amount,
        reference: p.reference || '', status: p.status,
      })),
    };
  },

  async purchases(businessId) {
    const [rows, parties] = await Promise.all([
      Purchase.find({ businessId }).sort({ purchaseDate: 1 }).lean(),
      Party.find({ businessId }).select('name shopName').lean(),
    ]);
    const nameMap = Object.fromEntries(parties.map((p) => [String(p._id), p.shopName || p.name]));
    const headers = ['purchaseNo', 'date', 'supplier', 'supplierBillNo', 'items',
      'taxable', 'tax', 'grandTotal', 'paid', 'due'];
    return {
      headers,
      rows: rows.map((p) => ({
        purchaseNo: p.purchaseNo,
        date: new Date(p.purchaseDate).toISOString().slice(0, 10),
        supplier: nameMap[String(p.supplierId)] || '',
        supplierBillNo: p.supplierBillNo || '',
        items: p.items.length,
        taxable: p.taxableTotal || 0, tax: p.taxTotal || 0,
        grandTotal: p.grandTotal, paid: p.paidAmount, due: p.dueAmount,
      })),
    };
  },

  async returns(businessId) {
    const rows = await ReturnNote.find({ businessId }).sort({ returnDate: 1 }).lean();
    const headers = ['returnNo', 'date', 'type', 'party', 'againstNo', 'items', 'grandTotal', 'reason'];
    return {
      headers,
      rows: rows.map((r) => ({
        returnNo: r.returnNo,
        date: new Date(r.returnDate).toISOString().slice(0, 10),
        type: r.type,
        party: r.partySnapshot?.shopName || r.partySnapshot?.name || '',
        againstNo: r.againstNo || '', items: r.items.length,
        grandTotal: r.grandTotal, reason: r.reason || '',
      })),
    };
  },
};

export const CSV_KINDS = Object.keys(CSV_BUILDERS);

export async function exportCsvKind(businessId, kind) {
  const build = CSV_BUILDERS[kind];
  if (!build) return null;
  const { headers, rows } = await build(businessId);
  return { csv: toCsv(headers, rows), count: rows.length };
}

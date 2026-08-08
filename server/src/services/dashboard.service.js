import mongoose from 'mongoose';
import { round2 } from '../utils/money.js';
import { ORDER_STATUS, PARTY_TYPES, PERMISSIONS } from '../config/constants.js';
import { userCan } from '../middleware/auth.js';
import {
  Invoice, Order, Party, Item, Payment, Purchase, Notification,
} from '../models/index.js';

/**
 * Dukaan kholte hi jo dikhna chahiye.
 *
 * Sab kuch ek hi call me — mobile pe 6 alag request bhejna theek nahi.
 */

const oid = (v) => new mongoose.Types.ObjectId(v);

function boundaries() {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
  const yEnd = new Date(yStart); yEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const trendStart = new Date(todayStart); trendStart.setDate(trendStart.getDate() - 13);

  return { todayStart, todayEnd, yStart, yEnd, monthStart, trendStart };
}

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/* ─────────────────────────────────────────────────── wholesaler ka dashboard */

export async function getWholesalerDashboard(businessId, user = null) {
  const bid = oid(businessId);
  const { todayStart, todayEnd, yStart, yEnd, monthStart, trendStart } = boundaries();

  const saleSum = (from, to) => Invoice.aggregate([
    { $match: { businessId: bid, isCancelled: false, invoiceDate: { $gte: from, $lte: to } } },
    { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
  ]);

  const [
    todaySale, yesterdaySale, monthSale,
    todayCollection, monthCollection,
    orderCounts, balances, stockAgg, lowStockItems,
    trendAgg, topItems, topRetailers,
    recentInvoices, recentOrders, recentPayments,
    pendingPayments, pendingRetailers,
  ] = await Promise.all([
    saleSum(todayStart, todayEnd),
    saleSum(yStart, yEnd),
    saleSum(monthStart, todayEnd),

    Payment.aggregate([
      { $match: { businessId: bid, status: 'confirmed', direction: 'IN', date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { businessId: bid, status: 'confirmed', direction: 'IN', date: { $gte: monthStart, $lte: todayEnd } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),

    Order.aggregate([
      { $match: { businessId: bid } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),

    Party.aggregate([
      { $match: { businessId: bid } },
      {
        $group: {
          _id: null,
          receivable: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] } },
          payable: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'supplier'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] } },
          retailers: { $sum: { $cond: [{ $eq: ['$type', 'retailer'] }, 1, 0] } },
          activeRetailers: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $eq: ['$status', 'active'] }] }, 1, 0] } },
        },
      },
    ]),

    Item.aggregate([
      { $match: { businessId: bid, isActive: true } },
      {
        $group: {
          _id: null,
          items: { $sum: 1 },
          stockValue: { $sum: { $multiply: ['$stockQty', '$purchasePrice'] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stockQty', 0] }, 1, 0] } },
          low: { $sum: { $cond: [{ $and: [{ $gt: ['$stockQty', 0] }, { $lte: ['$stockQty', '$lowStockAt'] }] }, 1, 0] } },
        },
      },
    ]),

    Item.find({ businessId, isActive: true, $expr: { $lte: ['$stockQty', '$lowStockAt'] } })
      .sort({ stockQty: 1 }).limit(6).select('name unit stockQty lowStockAt imageUrl').lean(),

    // Pichhle 14 din ka sale — chart ke liye
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, invoiceDate: { $gte: trendStart, $lte: todayEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } },
          amount: { $sum: '$grandTotal' }, bills: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, invoiceDate: { $gte: monthStart } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId', name: { $first: '$items.name' }, unit: { $first: '$items.unit' },
          qty: { $sum: '$items.qty' }, amount: { $sum: '$items.total' },
        },
      },
      { $sort: { amount: -1 } }, { $limit: 5 },
    ]),

    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, invoiceDate: { $gte: monthStart } } },
      {
        $group: {
          _id: '$partyId', name: { $first: '$partySnapshot.shopName' }, fallback: { $first: '$partySnapshot.name' },
          bills: { $sum: 1 }, amount: { $sum: '$grandTotal' },
        },
      },
      { $sort: { amount: -1 } }, { $limit: 5 },
    ]),

    Invoice.find({ businessId, isCancelled: false }).sort({ createdAt: -1 }).limit(4)
      .select('invoiceNo invoiceDate grandTotal partySnapshot createdAt').lean(),
    Order.find({ businessId }).sort({ createdAt: -1 }).limit(4)
      .select('orderNo status itemsTotal partyId createdAt').populate('partyId', 'name shopName').lean(),
    Payment.find({ businessId, status: 'confirmed' }).sort({ createdAt: -1 }).limit(4)
      .select('paymentNo amount mode direction partyId createdAt').populate('partyId', 'name shopName').lean(),

    Payment.countDocuments({ businessId, status: 'pending' }),
    Party.countDocuments({ businessId, type: PARTY_TYPES.RETAILER, status: 'pending' }),
  ]);

  const statusMap = Object.fromEntries(orderCounts.map((o) => [o._id, o.n]));
  const b = balances[0] || {};
  const st = stockAgg[0] || {};

  // Trend me khali din bhi chahiye, warna chart me gaddha dikhta hai
  const trendMap = Object.fromEntries(trendAgg.map((t) => [t._id, t]));
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    trend.push({
      date: key,
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      amount: round2(trendMap[key]?.amount || 0),
      bills: trendMap[key]?.bills || 0,
    });
  }

  const today = round2(todaySale[0]?.amount || 0);
  const yesterday = round2(yesterdaySale[0]?.amount || 0);

  const activity = buildActivity(recentInvoices, recentOrders, recentPayments);

  /**
   * Staff ko sirf wahi dikhe jiski ijazat hai.
   *
   * Ye sirf UI ki baat nahi — salesman ko udhaar ka total dikh jana bhi
   * leak hai. Isliye data yahin se hata dete hain, chhupate nahi.
   */
  const can = (perm) => !user || userCan(user, perm);

  const full = {
    sale: {
      today,
      todayBills: todaySale[0]?.n || 0,
      yesterday,
      // Kal se kitna upar-neeche — % tabhi jab kal kuch bika ho
      changePct: yesterday > 0 ? round2(((today - yesterday) / yesterday) * 100) : null,
      month: round2(monthSale[0]?.amount || 0),
      monthBills: monthSale[0]?.n || 0,
    },
    collection: {
      today: round2(todayCollection[0]?.amount || 0),
      todayCount: todayCollection[0]?.n || 0,
      month: round2(monthCollection[0]?.amount || 0),
    },
    orders: {
      new: statusMap[ORDER_STATUS.PLACED] || 0,
      packed: statusMap[ORDER_STATUS.PACKED] || 0,
      ready: statusMap[ORDER_STATUS.READY] || 0,
      running: (statusMap[ORDER_STATUS.PLACED] || 0) + (statusMap[ORDER_STATUS.PACKED] || 0)
        + (statusMap[ORDER_STATUS.READY] || 0),
      delivered: statusMap[ORDER_STATUS.DELIVERED] || 0,
    },
    khata: {
      receivable: round2(b.receivable || 0),
      payable: round2(b.payable || 0),
      net: round2((b.receivable || 0) - (b.payable || 0)),
      retailers: b.retailers || 0,
      activeRetailers: b.activeRetailers || 0,
    },
    stock: {
      items: st.items || 0,
      value: round2(st.stockValue || 0),
      low: st.low || 0,
      outOfStock: st.outOfStock || 0,
      lowItems: lowStockItems,
    },
    trend,
    topItems: topItems.map((t) => ({
      _id: t._id, name: t.name, unit: t.unit, qty: round2(t.qty), amount: round2(t.amount),
    })),
    topRetailers: topRetailers.map((t) => ({
      _id: t._id, name: t.name || t.fallback || '—', bills: t.bills, amount: round2(t.amount),
    })),
    activity,
    todo: {
      pendingPayments,
      pendingRetailers,
      newOrders: statusMap[ORDER_STATUS.PLACED] || 0,
      lowStock: st.low || 0,
    },
  };

  // Jiski ijazat nahi, wo hissa response se hi nikal do
  if (!can(PERMISSIONS.KHATA)) {
    delete full.khata;
    delete full.collection;
    full.todo.pendingPayments = 0;
  }
  if (!can(PERMISSIONS.ITEMS)) {
    delete full.stock;
    full.todo.lowStock = 0;
  }
  if (!can(PERMISSIONS.ORDERS)) {
    delete full.orders;
    full.todo.newOrders = 0;
  }
  if (!can(PERMISSIONS.PARTIES)) {
    delete full.topRetailers;
    full.todo.pendingRetailers = 0;
  }
  if (!can(PERMISSIONS.INVOICES)) {
    delete full.sale;
    delete full.trend;
    delete full.topItems;
  }
  // Activity feed me har cheez mil-jul kar aati hai — jo dekh nahi sakta, wo row hata do
  full.activity = (full.activity || []).filter((a) =>
    (a.type === 'invoice' && can(PERMISSIONS.INVOICES))
    || (a.type === 'order' && can(PERMISSIONS.ORDERS))
    || (a.type === 'payment' && can(PERMISSIONS.KHATA)));

  return full;
}

/** Teeno list ko ek hi timeline me mila kar naye se purana */
function buildActivity(invoices, orders, payments) {
  const rows = [
    ...invoices.map((i) => ({
      type: 'invoice', at: i.createdAt,
      title: `Bill ${i.invoiceNo}`,
      subtitle: i.partySnapshot?.shopName || i.partySnapshot?.name || '',
      amount: round2(i.grandTotal), link: `/invoices/${i._id}`,
    })),
    ...orders.map((o) => ({
      type: 'order', at: o.createdAt,
      title: `Order ${o.orderNo}`,
      subtitle: o.partyId?.shopName || o.partyId?.name || '',
      amount: round2(o.itemsTotal), link: `/orders/${o._id}`, status: o.status,
    })),
    ...payments.map((p) => ({
      type: 'payment', at: p.createdAt,
      title: p.direction === 'IN' ? `Paisa aaya ${p.paymentNo}` : `Paisa diya ${p.paymentNo}`,
      subtitle: `${p.partyId?.shopName || p.partyId?.name || ''} · ${p.mode}`,
      amount: round2(p.amount), link: '/payments', direction: p.direction,
    })),
  ];
  return rows.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
}

/* ───────────────────────────────────────────────────── retailer ka dashboard */

export async function getRetailerDashboard(businessId, partyId) {
  const { monthStart } = boundaries();

  const [party, orderCounts, monthSpend, openInvoices, recentOrders, unread] = await Promise.all([
    Party.findById(partyId).select('name shopName balance creditLimit').lean(),
    Order.aggregate([
      { $match: { businessId: oid(businessId), partyId: oid(partyId) } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { businessId: oid(businessId), partyId: oid(partyId), isCancelled: false, invoiceDate: { $gte: monthStart } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
    ]),
    Invoice.find({ businessId, partyId, isCancelled: false, dueAmount: { $gt: 0 } })
      .sort({ invoiceDate: 1 }).limit(5)
      .select('invoiceNo invoiceDate grandTotal dueAmount').lean(),
    Order.find({ businessId, partyId }).sort({ createdAt: -1 }).limit(4)
      .select('orderNo status itemsTotal createdAt').lean(),
    Notification.countDocuments({ businessId, isRead: false }),
  ]);

  const statusMap = Object.fromEntries(orderCounts.map((o) => [o._id, o.n]));

  return {
    balance: round2(party?.balance || 0),
    creditLimit: party?.creditLimit || 0,
    overLimit: party?.creditLimit > 0 && party.balance > party.creditLimit,
    monthSpend: round2(monthSpend[0]?.amount || 0),
    monthBills: monthSpend[0]?.n || 0,
    orders: {
      running: (statusMap[ORDER_STATUS.PLACED] || 0) + (statusMap[ORDER_STATUS.PACKED] || 0)
        + (statusMap[ORDER_STATUS.READY] || 0),
      ready: statusMap[ORDER_STATUS.READY] || 0,
      delivered: statusMap[ORDER_STATUS.DELIVERED] || 0,
    },
    openInvoices,
    recentOrders,
    unread,
  };
}

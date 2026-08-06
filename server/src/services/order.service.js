import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  ORDER_STATUS, ORDER_STATUS_FLOW, COUNTER_KEYS, PARTY_STATUS, NOTIFICATION_TYPES,
} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { Order, Cart, Item, Party, Business, Counter } from '../models/index.js';
import { resolveRates } from './rate.service.js';
import { getCart, clearCart } from './cart.service.js';
import { notifyWholesaler, notifyRetailer } from './notification.service.js';

/**
 * Cart se order banana.
 *
 * Yahan stock LOCK nahi hota — sirf snapshot liya jata hai (`availableAtOrder`).
 * Stock invoice banne pe ghatega (Part 8). Wajah: order aane aur maal dene ke beech
 * wholesaler kuch aur bhi bech sakta hai, aur order cancel bhi ho sakta hai.
 */
export async function placeOrder(businessId, partyId, userId, { note }) {
  const party = await Party.findOne({ _id: partyId, businessId }).select('name shopName status').lean();
  if (!party) throw ApiError.notFound('Aapki dukaan ki entry nahi mili');
  if (party.status !== PARTY_STATUS.ACTIVE) {
    throw ApiError.forbidden('Order karne ke liye wholesaler ka approval chahiye');
  }

  const cart = await Cart.findOne({ businessId, partyId }).lean();
  if (!cart?.items?.length) throw ApiError.badRequest('Cart khali hai');

  const itemIds = cart.items.map((i) => i.itemId);
  const rawItems = await Item.find({
    _id: { $in: itemIds }, businessId, isActive: true, visibleToRetailers: true,
  }).select('name unit stockQty salePrice wholesalePrice').lean();

  const priced = await resolveRates(businessId, partyId, rawItems);
  const priceMap = new Map(priced.map((p) => [String(p._id), p]));

  const lines = [];
  for (const line of cart.items) {
    const item = priceMap.get(String(line.itemId));
    if (!item) continue;                    // beech me hat gaya
    if (item.stockQty <= 0) continue;       // khatam ho gaya

    const qty = round2(line.qty);
    lines.push({
      itemId: item._id,
      name: item.name,                      // snapshot
      unit: item.unit,
      qty,
      rate: item.rate,                      // rate.service se aaya
      amount: round2(qty * item.rate),
      availableAtOrder: item.stockQty,      // order ke waqt kitna tha
    });
  }

  if (!lines.length) {
    throw ApiError.badRequest('Cart ke saare item ab available nahi hain — cart dobara dekh lein');
  }

  const business = await Business.findById(businessId).select('orderPrefix').lean();
  const { number: orderNo } = await Counter.nextNumber({
    businessId, key: COUNTER_KEYS.ORDER, prefix: business?.orderPrefix || 'ORD',
  });

  const order = await Order.create({
    businessId,
    partyId,
    placedByUserId: userId,
    orderNo,
    items: lines,
    itemsTotal: round2(lines.reduce((s, l) => s + l.amount, 0)),
    itemCount: lines.length,
    status: ORDER_STATUS.PLACED,
    statusHistory: [{ status: ORDER_STATUS.PLACED, at: new Date(), byUserId: userId, note: 'Retailer ne order kiya' }],
    retailerNote: note || cart.note || '',
  });

  await clearCart(businessId, partyId);

  // Wholesaler ko turant khabar
  await notifyWholesaler(businessId, {
    type: NOTIFICATION_TYPES.NEW_ORDER,
    title: `Naya order — ${party.shopName || party.name}`,
    body: `${order.itemCount} item · ${order.itemsTotal}`,
    link: `/orders/${order._id}`,
    data: { orderId: order._id, orderNo },
  });

  return getOrder(businessId, order._id, { partyId });
}

export async function getOrder(businessId, id, { partyId = null } = {}) {
  const filter = { _id: id, businessId };
  if (partyId) filter.partyId = partyId;   // retailer sirf apna order dekhe

  const order = await Order.findOne(filter)
    .populate('partyId', 'name shopName phone')
    .lean();
  if (!order) throw ApiError.notFound('Order nahi mila');

  return {
    ...order,
    party: order.partyId,
    partyId: order.partyId?._id || order.partyId,
  };
}

export async function listOrders(businessId, q, { partyId = null } = {}) {
  const filter = { businessId };
  if (partyId) filter.partyId = partyId;
  if (q.status && q.status !== 'all') filter.status = q.status;

  const skip = (q.page - 1) * q.limit;
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(q.limit)
      .populate('partyId', 'name shopName phone').lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders: orders.map((o) => ({
      ...o,
      party: o.partyId ? { _id: o.partyId._id, name: o.partyId.shopName || o.partyId.name, phone: o.partyId.phone } : null,
      partyId: o.partyId?._id || o.partyId,
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

/** Retailer apna PLACED order khud cancel kar sakta hai */
export async function cancelOwnOrder(businessId, partyId, id, userId) {
  const order = await Order.findOne({ _id: id, businessId, partyId });
  if (!order) throw ApiError.notFound('Order nahi mila');

  if (order.status !== ORDER_STATUS.PLACED) {
    throw ApiError.badRequest('Wholesaler ne order pe kaam shuru kar diya hai — ab aap cancel nahi kar sakte');
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.cancelReason = 'Retailer ne cancel kiya';
  order.statusHistory.push({
    status: ORDER_STATUS.CANCELLED, at: new Date(), byUserId: userId, note: 'Retailer ne cancel kiya',
  });
  await order.save();

  await notifyWholesaler(businessId, {
    type: NOTIFICATION_TYPES.ORDER_STATUS,
    title: `Order cancel — ${order.orderNo}`,
    body: 'Retailer ne khud cancel kar diya',
    link: `/orders/${order._id}`,
    data: { orderId: order._id },
  });

  return getOrder(businessId, id, { partyId });
}

/** Retailer ke apne order ka chhota summary (My Orders ke upar) */
export async function myOrderSummary(businessId, partyId) {
  const [rows] = await Order.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId),
      partyId: new mongoose.Types.ObjectId(partyId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        chalu: { $sum: { $cond: [{ $in: ['$status', ['PLACED', 'PACKED', 'READY']] }, 1, 0] } },
        amount: { $sum: '$itemsTotal' },
      },
    },
  ]);
  return { total: rows?.total || 0, chalu: rows?.chalu || 0, amount: round2(rows?.amount || 0) };
}

/* ============================================================ wholesaler */

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Order list ke saath har status ka count — chips pe dikhane ke liye */
export async function listOrdersForWholesaler(businessId, q) {
  const filter = { businessId };

  if (q.status === 'open') filter.status = { $in: [ORDER_STATUS.PLACED, ORDER_STATUS.PACKED, ORDER_STATUS.READY] };
  else if (q.status !== 'all') filter.status = q.status;

  if (q.partyId) filter.partyId = q.partyId;

  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = q.from;
    if (q.to) { const to = new Date(q.to); to.setHours(23, 59, 59, 999); filter.createdAt.$lte = to; }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const parties = await Party.find({ businessId, $or: [{ name: rx }, { shopName: rx }, { phone: rx }] })
      .select('_id').lean();
    filter.$or = [{ orderNo: rx }, { partyId: { $in: parties.map((p) => p._id) } }];
  }

  const skip = (q.page - 1) * q.limit;
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 })
      .skip(skip).limit(q.limit)
      .populate('partyId', 'name shopName phone')
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders: orders.map((o) => ({
      ...o,
      party: o.partyId ? { _id: o.partyId._id, name: o.partyId.shopName || o.partyId.name, phone: o.partyId.phone } : null,
      partyId: o.partyId?._id || o.partyId,
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function getOrderStats(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [byStatus, [today]] = await Promise.all([
    Order.aggregate([
      { $match: { businessId: bid } },
      { $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$itemsTotal' } } },
    ]),
    Order.aggregate([
      { $match: { businessId: bid, createdAt: { $gte: todayStart } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$itemsTotal' } } },
    ]),
  ]);

  const counts = { PLACED: 0, PACKED: 0, READY: 0, DELIVERED: 0, CANCELLED: 0 };
  let openAmount = 0;
  byStatus.forEach((r) => {
    counts[r._id] = r.n;
    if (['PLACED', 'PACKED', 'READY'].includes(r._id)) openAmount = round2(openAmount + r.amount);
  });

  return {
    counts,
    open: counts.PLACED + counts.PACKED + counts.READY,
    openAmount,
    todayCount: today?.n || 0,
    todayAmount: round2(today?.amount || 0),
  };
}

/** Detail ke saath har line ka ABHI ka stock — wholesaler ko pata rahe kya bhej sakta hai */
export async function getOrderForWholesaler(businessId, id) {
  const order = await getOrder(businessId, id);

  const items = await Item.find({ _id: { $in: order.items.map((i) => i.itemId) }, businessId })
    .select('stockQty unit name').lean();
  const stockMap = new Map(items.map((i) => [String(i._id), i.stockQty]));

  const lines = order.items.map((line) => {
    const currentStock = stockMap.has(String(line.itemId)) ? stockMap.get(String(line.itemId)) : null;
    return {
      ...line,
      currentStock,
      enough: currentStock === null ? false : currentStock >= line.qty,
      itemGone: currentStock === null,
    };
  });

  return {
    ...order,
    items: lines,
    canFulfil: lines.every((l) => l.enough),
    shortLines: lines.filter((l) => !l.enough).length,
    nextStatuses: ORDER_STATUS_FLOW[order.status] || [],
  };
}

const STATUS_MESSAGE = {
  PACKED: { title: 'Order pack ho raha hai', body: 'Aapka maal tayyar kiya ja raha hai' },
  READY: { title: 'Order tayyar hai', body: 'Aakar le jaiye ya gaadi bhej dijiye' },
  DELIVERED: { title: 'Order mil gaya', body: 'Order poora ho gaya' },
};

/** Status aage badhana — sirf allowed transition */
export async function updateStatus(businessId, id, { status, note }, userId) {
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw ApiError.notFound('Order nahi mila');

  const allowed = ORDER_STATUS_FLOW[order.status] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(
      `${order.status} se seedha ${status} nahi kar sakte` +
      (allowed.length ? ` — abhi sirf ${allowed.join(' ya ')} ho sakta hai` : ' — ye order band ho chuka hai')
    );
  }

  order.status = status;
  order.statusHistory.push({ status, at: new Date(), byUserId: userId, note });
  if (note) order.wholesalerNote = note;
  await order.save();

  const msg = STATUS_MESSAGE[status];
  if (msg) {
    await notifyRetailer(businessId, order.partyId, {
      type: NOTIFICATION_TYPES.ORDER_STATUS,
      title: `${msg.title} — ${order.orderNo}`,
      body: note || msg.body,
      link: `/my-orders/${order._id}`,
      data: { orderId: order._id, status },
    });
  }

  return getOrderForWholesaler(businessId, id);
}

/** Wholesaler kabhi bhi cancel kar sakta hai — delivered ke alawa */
export async function cancelOrder(businessId, id, { reason }, userId) {
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw ApiError.notFound('Order nahi mila');

  if (order.status === ORDER_STATUS.DELIVERED) {
    throw ApiError.badRequest('Delivered order cancel nahi ho sakta');
  }
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw ApiError.badRequest('Ye order pehle se cancel hai');
  }

  order.status = ORDER_STATUS.CANCELLED;
  order.cancelReason = reason || 'Wholesaler ne cancel kiya';
  order.statusHistory.push({
    status: ORDER_STATUS.CANCELLED, at: new Date(), byUserId: userId,
    note: reason || 'Wholesaler ne cancel kiya',
  });
  await order.save();

  await notifyRetailer(businessId, order.partyId, {
    type: NOTIFICATION_TYPES.ORDER_STATUS,
    title: `Order cancel — ${order.orderNo}`,
    body: reason || 'Wholesaler ne cancel kar diya',
    link: `/my-orders/${order._id}`,
    data: { orderId: order._id },
  });

  return getOrderForWholesaler(businessId, id);
}

/**
 * Quantity badalna — "Suresh ne 10 mange, mere paas 6 hain".
 * qty 0 bhej do to wo line hat jayegi. Rate wahi rehta hai jo order ke waqt tha.
 * Delivered/cancelled order me kuch nahi badal sakta.
 */
export async function updateOrderItems(businessId, id, { items, note }, userId) {
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw ApiError.notFound('Order nahi mila');

  if ([ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status)) {
    throw ApiError.badRequest('Band ho chuke order me badlav nahi ho sakta');
  }

  const qtyMap = new Map(items.map((i) => [String(i.itemId), Number(i.qty)]));
  const kept = [];

  for (const line of order.items) {
    const newQty = qtyMap.has(String(line.itemId)) ? qtyMap.get(String(line.itemId)) : line.qty;
    if (newQty <= 0) continue;
    kept.push({ ...line.toObject(), qty: round2(newQty), amount: round2(newQty * line.rate) });
  }

  if (!kept.length) throw ApiError.badRequest('Saare item hata diye — aisa order nahi rakh sakte. Cancel kar dein.');

  order.items = kept;
  order.itemCount = kept.length;
  order.itemsTotal = round2(kept.reduce((s, l) => s + l.amount, 0));
  order.statusHistory.push({
    status: order.status, at: new Date(), byUserId: userId,
    note: note || 'Wholesaler ne quantity badli',
  });
  await order.save();

  await notifyRetailer(businessId, order.partyId, {
    type: NOTIFICATION_TYPES.ORDER_STATUS,
    title: `Order me badlav — ${order.orderNo}`,
    body: note || 'Wholesaler ne kuch quantity badli hai',
    link: `/my-orders/${order._id}`,
    data: { orderId: order._id },
  });

  return getOrderForWholesaler(businessId, id);
}

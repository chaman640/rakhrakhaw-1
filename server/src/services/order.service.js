import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  ORDER_STATUS, ORDER_STATUS_FLOW, ORDER_PAYMENT_MODES, COUNTER_KEYS, PARTY_STATUS,
  NOTIFICATION_TYPES,
} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { Order, Cart, Item, Party, Business, Counter } from '../models/index.js';
import { scopeByParty, isScoped, canSeeDoc, ownPartyIds, toObjectIds } from '../utils/scope.js';
import { resolveRates } from './rate.service.js';
import { getCart, clearCart } from './cart.service.js';
import { createPayment } from './payment.service.js';
import { notifyWholesaler, notifyRetailer } from './notification.service.js';

/**
 * Cart se order banana.
 *
 * Yahan stock LOCK nahi hota — sirf snapshot liya jata hai (`availableAtOrder`).
 * Stock invoice banne pe ghatega (Part 8). Wajah: order aane aur maal dene ke beech
 * wholesaler kuch aur bhi bech sakta hai, aur order cancel bhi ho sakta hai.
 */
export async function placeOrder(businessId, partyId, userId, { note, paymentMode }) {
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
  /*
    Jo item gir gaya wo CHUP-CHAAP nahi girta.

    Pehle bas `continue` tha: retailer 12 item ka cart bhejta, 8 ka order
    banta, aur use kabhi pata hi nahi chalta — wo maal ka intezaar karta rehta
    jo order me hai hi nahi. Error sirf tab aata tha jab SAB khatam ho.
  */
  const dropped = [];
  for (const line of cart.items) {
    const item = priceMap.get(String(line.itemId));
    if (!item) {
      dropped.push({ itemId: line.itemId, name: line.name || '', reason: 'hat_gaya' });
      continue;
    }
    if (item.stockQty <= 0) {
      dropped.push({ itemId: item._id, name: item.name, reason: 'stock_khatam' });
      continue;
    }

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
    paymentMode: paymentMode || ORDER_PAYMENT_MODES.UDHAAR,
    retailerNote: note || cart.note || '',
  });

  await clearCart(businessId, partyId);

  // Wholesaler ko turant khabar
  await notifyWholesaler(businessId, {
    type: NOTIFICATION_TYPES.NEW_ORDER,
    title: `Naya order — ${party.shopName || party.name}`,
    // Paise ka irada khabar me hi — maal tayyar karne se PEHLE pata hona chahiye
    body: `${order.itemCount} item · ${order.itemsTotal}${
      order.paymentMode === ORDER_PAYMENT_MODES.UDHAAR ? '' : ` · ${order.paymentMode} pe denge`}`,
    link: `/orders/${order._id}`,
    data: { orderId: order._id, orderNo },
  });

  /*
    `dropped` jawab me jata hai taaki app saaf keh sake ki kaunsa item order me
    aaya hi nahi. Ye khabar retailer ke liye order jitni hi zaroori hai.
  */
  return { ...(await getOrder(businessId, order._id, { partyId })), dropped };
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

// Ye RETAILER ke apne app ke liye hai — usme `partyId` pehle se lag jata hai,
// isliye staff wali hadd yahan lagti hi nahi
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
/** Hadd wale staff ke liye: ye order iske retailer ka hai bhi ya nahi */
async function assertCanTouch(businessId, id, viewer) {
  if (!isScoped(viewer)) return;
  const doc = await Order.findOne({ _id: id, businessId }).select('partyId').lean();
  if (!(await canSeeDoc(doc, businessId, viewer))) {
    throw ApiError.notFound('Order nahi mila');
  }
}

export async function listOrdersForWholesaler(businessId, q, viewer = null) {
  let filter = { businessId };

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

  // Order kisi ka apna nahi hota — wo us RETAILER ka hai jisne bheja. Isliye
  // hadd bhi retailer se hi lagti hai.
  filter = await scopeByParty(filter, businessId, viewer);

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

export async function getOrderStats(businessId, viewer = null) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Upar ki ginti aur neeche ki list ek jaisi honi chahiye
  const mine = isScoped(viewer)
    ? { partyId: { $in: toObjectIds(await ownPartyIds(businessId, viewer)) } }
    : {};

  const [byStatus, [today]] = await Promise.all([
    Order.aggregate([
      { $match: { businessId: bid, ...mine } },
      { $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$itemsTotal' } } },
    ]),
    Order.aggregate([
      { $match: { businessId: bid, ...mine, createdAt: { $gte: todayStart } } },
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
export async function getOrderForWholesaler(businessId, id, viewer = null) {
  const order = await getOrder(businessId, id);

  // id URL me daal kar doosre ka order na khul jaye
  if (!(await canSeeDoc(order, businessId, viewer))) {
    throw ApiError.notFound('Order nahi mila');
  }

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

/*
  "PAYMENT MILI" — order pe paisa aa gaya.

  Yahan sirf ek tick nahi lagta, khate me SACH ME payment chadhti hai. Wajah
  simple hai: tick aur khata do alag sach ban jate hain. Malik order pe tick
  laga kar nishchint ho jata, aur mahine ke aakhir me khata kuch aur bolta —
  aur us jhagde me app ka kasoor nikalta.

  Ek baat dhyan dene layak hai: is waqt tak BILL bana hi nahi hota (bill order
  ke baad banta hai). Isliye ye paisa kisi bill pe nahi lagta — wo JAMA
  (advance) ban kar khade rehta hai, aur jab bill banega tab Step 1 wala jama
  system use apne aap us bill me laga dega. Isiliye `allowAdvance: true` —
  bina iske "bill se zyada paisa" kehkar rok diya jata.
*/
export async function markOrderPaid(businessId, id, { amount, mode, reference, note }, userId, viewer = null) {
  await assertCanTouch(businessId, id, viewer);
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw ApiError.notFound('Order nahi mila');
  if (order.status === ORDER_STATUS.CANCELLED) {
    throw ApiError.badRequest('Cancel ho chuke order pe payment nahi lag sakti');
  }
  if (order.paymentId) throw ApiError.badRequest('Is order ki payment pehle se chadh chuki hai');

  const amt = round2(amount ?? order.itemsTotal);
  if (!(amt > 0)) throw ApiError.badRequest('Amount 0 se zyada hona chahiye');

  /*
    `createPayment` `{ payment, advance }` deta hai — payment nahi.

    Bina destructure ke `payment._id` undefined tha, isliye upar wala
    "pehle se chadh chuki hai" wala pehra KABHI nahi lagta tha: ₹10,000 ka
    order, "Payment mili" paanch baar dabao → paanch asli payment, khate me
    ₹50,000 credit. Aur `deletePayment` ka `Order.updateOne({ paymentId })`
    bhi kabhi match nahi karta tha, isliye order hamesha "paisa aa gaya"
    dikhata rehta.
  */
  const { payment } = await createPayment(businessId, {
    partyId: order.partyId,
    amount: amt,
    // Retailer ne jo kaha tha wahi default — par malik badal sakta hai
    mode: mode || (order.paymentMode === ORDER_PAYMENT_MODES.UPI ? 'UPI' : 'CASH'),
    reference: reference || '',
    note: note || `Order ${order.orderNo} ka paisa`,
    allowAdvance: true,
  }, userId);

  order.paymentId = payment._id;
  order.statusHistory.push({
    status: order.status, at: new Date(), byUserId: userId,
    note: `Payment mili — ${amt}`,
  });
  await order.save();

  return getOrderForWholesaler(businessId, id, viewer);
}

const STATUS_MESSAGE = {
  PACKED: { title: 'Order pack ho raha hai', body: 'Aapka maal tayyar kiya ja raha hai' },
  READY: { title: 'Order tayyar hai', body: 'Aakar le jaiye ya gaadi bhej dijiye' },
  DELIVERED: { title: 'Order mil gaya', body: 'Order poora ho gaya' },
};

/** Status aage badhana — sirf allowed transition */
export async function updateStatus(businessId, id, { status, note }, userId, viewer = null) {
  await assertCanTouch(businessId, id, viewer);
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
export async function cancelOrder(businessId, id, { reason }, userId, viewer = null) {
  await assertCanTouch(businessId, id, viewer);
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw ApiError.notFound('Order nahi mila');

  /*
    Bill ban chuka to order ab kagaz pe pakka ho gaya — badlaav bill se hoga,
    order se nahi. Warna retailer ko "cancel ho gaya" dikhta hai jabki bill
    zinda hai aur uska udhaar khate me chadha pada hai.
  */
  if (order.invoiceId) {
    throw ApiError.badRequest('Is order ka bill ban chuka hai — pehle bill cancel karein');
  }

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
export async function updateOrderItems(businessId, id, { items, note }, userId, viewer = null) {
  await assertCanTouch(businessId, id, viewer);
  const order = await Order.findOne({ _id: id, businessId });
  if (!order) throw ApiError.notFound('Order nahi mila');

  /*
    Bill ban chuka to order ab kagaz pe pakka ho gaya — badlaav bill se hoga,
    order se nahi. Warna retailer ko "cancel ho gaya" dikhta hai jabki bill
    zinda hai aur uska udhaar khate me chadha pada hai.
  */
  if (order.invoiceId) {
    throw ApiError.badRequest('Is order ka bill ban chuka hai — pehle bill cancel karein');
  }

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

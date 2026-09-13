import ApiError from '../utils/ApiError.js';
import { saveImage } from '../utils/storage.js';
import { PARTY_TYPES, PARTY_STATUS } from '../config/constants.js';
import { Conversation, Message, Party, Item, Order } from '../models/index.js';

/**
 * CHAT — poora service ek hi jagah (Part 25).
 *
 * `sendMessage`/`getMessages` role-agnostic hain (senderRole bata do, bas) —
 * isi wajah se wholesaler aur retailer dono taraf se EXACT WAHI function
 * chalta hai, ek jagah likha ek jagah sahi rehta hai. Farak sirf itna hai ki
 * kaun kisse pooch raha hai — wo controller tay karta hai.
 */

async function upsertConversation(businessId, partyId, { text, type, senderRole, title }) {
  const snippet = type === 'photo' ? '📷 Photo'
    : type === 'item' ? `🛒 ${title}`
    : type === 'order' ? `📦 ${title}`
    : text.slice(0, 100);
  const inc = senderRole === 'wholesaler' ? { unreadForRetailer: 1 } : { unreadForWholesaler: 1 };

  return Conversation.findOneAndUpdate(
    { businessId, partyId },
    { $set: { lastMessageAt: new Date(), lastMessageSnippet: snippet, lastMessageBy: senderRole }, $inc: inc },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function sendMessage(businessId, partyId, { type = 'text', text = '', refId }, file, senderRole, senderUserId) {
  let imageUrl = '';
  let imagePublicId = '';
  let title = '';
  let subtitle = '';

  if (type === 'photo') {
    if (!file) throw ApiError.badRequest('Photo chahiye');
    const saved = await saveImage(file, 'chat');
    imageUrl = saved.url;
    imagePublicId = saved.publicId;
  } else if (type === 'item') {
    /*
     * Item ka NAAM/RATE/PHOTO yahin SNAPSHOT ho jata hai (Part 26) —
     * WhatsApp forward jaisa. Baad me wholesaler item ka rate badle to
     * purana message wahi dikhega jo bhejte waqt tha.
     */
    const item = await Item.findOne({ _id: refId, businessId })
      .select('name imageUrl salePrice wholesalePrice unit').lean();
    if (!item) throw ApiError.badRequest('Item nahi mila');
    title = item.name;
    imageUrl = item.imageUrl || '';
    subtitle = `₹${item.wholesalePrice || item.salePrice || 0} / ${item.unit}`;
  } else if (type === 'order') {
    const order = await Order.findOne({ _id: refId, businessId, partyId })
      .select('orderNo itemsTotal itemCount status').lean();
    if (!order) throw ApiError.badRequest('Order nahi mila');
    title = `Order ${order.orderNo}`;
    subtitle = `${order.itemCount} item · ₹${order.itemsTotal}`;
  }

  const conv = await upsertConversation(businessId, partyId, { text, type, senderRole, title });

  return Message.create({
    conversationId: conv._id,
    businessId,
    partyId,
    senderRole,
    senderUserId: senderUserId || null,
    type,
    text: text || '',
    imageUrl,
    imagePublicId,
    refId: ['item', 'order'].includes(type) ? refId : null,
    title,
    subtitle,
  });
}

/**
 * Purane pehle nahi, NAYE pehle mangwate hain (`before` cursor se peeche jaate
 * hain) — chat hamesha "sabse neeche se upar" khulti hai, WhatsApp jaisi.
 * Jawab bhejne se pehle ULTA kar dete hain taaki screen pe purana upar, naya
 * neeche aaye.
 */
export async function getMessages(businessId, partyId, readerRole, { before, limit = 50 } = {}) {
  const query = { businessId, partyId };
  if (before) query.createdAt = { $lt: new Date(before) };

  const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit).lean();

  const unreadField = readerRole === 'wholesaler' ? 'unreadForWholesaler' : 'unreadForRetailer';
  await Conversation.updateOne({ businessId, partyId }, { $set: { [unreadField]: 0 } });

  return messages.reverse();
}

/* ─────────────────────────── wholesaler ki taraf ─────────────────────────── */

export async function listConversationsForWholesaler(businessId) {
  const convs = await Conversation.find({ businessId }).sort({ lastMessageAt: -1 }).lean();
  if (!convs.length) return [];

  const parties = await Party.find({ _id: { $in: convs.map((c) => c.partyId) } })
    .select('name shopName phone status').lean();
  const partyMap = new Map(parties.map((p) => [String(p._id), p]));

  return convs.map((c) => {
    const p = partyMap.get(String(c.partyId));
    return {
      partyId: c.partyId,
      name: p?.shopName || p?.name || 'Retailer',
      phone: p?.phone || '',
      partyStatus: p?.status || null,
      lastMessageAt: c.lastMessageAt,
      lastMessageSnippet: c.lastMessageSnippet,
      lastMessageBy: c.lastMessageBy,
      unread: c.unreadForWholesaler,
    };
  }).filter((c) => c.partyStatus); // party hata di gayi ho to chat list me na dikhe
}

/** Naya chat shuru karne ke liye — apne hi retailers me dhoondo */
export async function searchPartiesForWholesaler(businessId, q) {
  const filter = { businessId, type: PARTY_TYPES.RETAILER, status: { $ne: PARTY_STATUS.BLOCKED } };
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { shopName: rx }, { phone: rx }];
  }
  const parties = await Party.find(filter).select('name shopName phone').limit(20).lean();
  return parties.map((p) => ({ partyId: p._id, name: p.shopName || p.name, phone: p.phone || '' }));
}

import { buyerFilter } from '../utils/buyer.js';
import { Conversation, Membership, Business } from '../models/index.js';

export { sendMessage, getMessages } from './chat.service.js';

/**
 * RETAILER KI CHAT LIST — apni saari dukaanon me se, jinse baat ho chuki hai.
 *
 * Ye `withBuyerTenant` ke bahar rehta hai jaan-boojh kar — ek "chuni hui
 * dukaan" nahi maangta, SAARI dukaanein ek saath dikhani hain (shop.routes.js
 * me isi tarah ka comment hai `/shops` ke liye).
 */
export async function listConversationsForRetailer(user) {
  const mine = buyerFilter(user);
  if (!mine) return [];

  const memberships = await Membership.find(mine).select('businessId partyId').lean();
  if (!memberships.length) return [];

  const convs = await Conversation.find({
    $or: memberships.map((m) => ({ businessId: m.businessId, partyId: m.partyId })),
  }).sort({ lastMessageAt: -1 }).lean();
  if (!convs.length) return [];

  const businesses = await Business.find({ _id: { $in: convs.map((c) => c.businessId) } })
    .select('name logoUrl').lean();
  const bizMap = new Map(businesses.map((b) => [String(b._id), b]));

  return convs.map((c) => {
    const biz = bizMap.get(String(c.businessId));
    return {
      businessId: c.businessId,
      name: biz?.name || 'Dukaan',
      logoUrl: biz?.logoUrl || '',
      lastMessageAt: c.lastMessageAt,
      lastMessageSnippet: c.lastMessageSnippet,
      lastMessageBy: c.lastMessageBy,
      unread: c.unreadForRetailer,
    };
  }).filter((c) => bizMap.has(String(c.businessId)));
}

/** Naya chat shuru karne ke liye — sirf jinse jude hain unhi dukaano me dhoondo */
export async function searchShopsForRetailer(user, q) {
  const mine = buyerFilter(user);
  if (!mine) return [];

  const memberships = await Membership.find(mine).select('businessId partyId').lean();
  if (!memberships.length) return [];

  const partyByBiz = new Map(memberships.map((m) => [String(m.businessId), m.partyId]));
  const filter = { _id: { $in: memberships.map((m) => m.businessId) } };
  if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const list = await Business.find(filter).select('name logoUrl').limit(20).lean();
  return list.map((b) => ({
    businessId: b._id,
    partyId: partyByBiz.get(String(b._id)),
    name: b.name,
    logoUrl: b.logoUrl || '',
  }));
}

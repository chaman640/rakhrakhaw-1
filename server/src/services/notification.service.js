import { NOTIFICATION_TYPES } from '../config/constants.js';
import { Notification, User, Business, Party } from '../models/index.js';

/**
 * Notification banane ka ek hi darwaza.
 *
 * Part 7 order wale alerts banata hai, Part 10 payment aur low-stock jodega
 * aur poora notifications page banayega.
 */
export async function notify({ businessId, userId, type, title, body = '', link = '', data = {} }) {
  if (!userId) return null;
  return Notification.create({ businessId, userId, type, title, body, link, data });
}

/** Wholesaler (dukaan ka malik) ko alert */
export async function notifyWholesaler(businessId, payload) {
  const business = await Business.findById(businessId).select('ownerUserId').lean();
  if (!business?.ownerUserId) return null;
  return notify({ businessId, userId: business.ownerUserId, ...payload });
}

/** Retailer ko alert — party se uska login user nikal kar */
export async function notifyRetailer(businessId, partyId, payload) {
  const party = await Party.findById(partyId).select('linkedUserId').lean();
  if (!party?.linkedUserId) return null;   // abhi app pe nahi aaya
  return notify({ businessId, userId: party.linkedUserId, ...payload });
}

export async function listNotifications(userId, { onlyUnread = false, limit = 30 } = {}) {
  const filter = { userId };
  if (onlyUnread) filter.isRead = false;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function unreadCount(userId) {
  const count = await Notification.countDocuments({ userId, isRead: false });
  return { count };
}

export async function markRead(userId, id) {
  await Notification.updateOne({ _id: id, userId }, { isRead: true, readAt: new Date() });
  return unreadCount(userId);
}

export async function markAllRead(userId) {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  return { count: 0 };
}

export { NOTIFICATION_TYPES };

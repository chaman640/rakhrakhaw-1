import mongoose from 'mongoose';
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

export async function listNotifications(userId, { onlyUnread = false, type = 'all', page = 1, limit = 30 } = {}) {
  const filter = { userId };
  if (onlyUnread) filter.isRead = false;
  if (type && type !== 'all') filter.type = type;

  const skip = (page - 1) * limit;
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);

  return {
    rows,
    unread,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Type wise ginti — page ke chips pe dikhane ke liye */
export async function notificationCounts(userId) {
  const agg = await Notification.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: '$type', n: { $sum: 1 }, unread: { $sum: { $cond: ['$isRead', 0, 1] } } } },
  ]);
  const byType = Object.fromEntries(agg.map((a) => [a._id, { total: a.n, unread: a.unread }]));
  return {
    all: agg.reduce((s, a) => s + a.n, 0),
    unread: agg.reduce((s, a) => s + a.unread, 0),
    byType,
  };
}

export async function removeNotification(userId, id) {
  await Notification.deleteOne({ _id: id, userId });
  return unreadCount(userId);
}

/** Padhi hui purani notifications hata do — list saaf rehti hai */
export async function clearRead(userId) {
  const res = await Notification.deleteMany({ userId, isRead: true });
  return { deleted: res.deletedCount || 0 };
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

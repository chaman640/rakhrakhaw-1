import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const { rows, unread, meta } = await service.listNotifications(req.user._id, {
    onlyUnread: req.query.onlyUnread === 'true',
    type: req.query.type || 'all',
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 30),
  });
  return res.json({ success: true, message: 'OK', data: rows, unread, meta });
});

export const counts = asyncHandler(async (req, res) =>
  ok(res, await service.notificationCounts(req.user._id)));

export const unreadCount = asyncHandler(async (req, res) =>
  ok(res, await service.unreadCount(req.user._id)));

export const markRead = asyncHandler(async (req, res) =>
  ok(res, await service.markRead(req.user._id, req.params.id)));

export const markAllRead = asyncHandler(async (req, res) =>
  ok(res, await service.markAllRead(req.user._id), 'Sab padh liya mark kar diya'));

export const remove = asyncHandler(async (req, res) =>
  ok(res, await service.removeNotification(req.user._id, req.params.id), 'Hata diya'));

export const clearRead = asyncHandler(async (req, res) => {
  const result = await service.clearRead(req.user._id);
  return ok(res, result, result.deleted
    ? `${result.deleted} purani notification hata di`
    : 'Hatane layak kuch nahi tha');
});

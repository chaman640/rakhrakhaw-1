import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/order.service.js';
import * as notifications from '../services/notification.service.js';

export const list = asyncHandler(async (req, res) => {
  const { orders, meta } = await service.listOrdersForWholesaler(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: orders, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getOrderStats(req.businessId)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getOrderForWholesaler(req.businessId, req.params.id)));

export const setStatus = asyncHandler(async (req, res) => {
  const order = await service.updateStatus(req.businessId, req.params.id, req.body, req.user._id);
  const messages = {
    PACKED: `${order.orderNo} pack ho raha hai`,
    READY: `${order.orderNo} tayyar mark kar diya — retailer ko khabar chali gayi`,
    DELIVERED: `${order.orderNo} delivered mark kar diya`,
  };
  return ok(res, order, messages[req.body.status]);
});

export const cancel = asyncHandler(async (req, res) => {
  const order = await service.cancelOrder(req.businessId, req.params.id, req.body, req.user._id);
  return ok(res, order, `${order.orderNo} cancel kar diya`);
});

export const updateItems = asyncHandler(async (req, res) => {
  const order = await service.updateOrderItems(req.businessId, req.params.id, req.body, req.user._id);
  return ok(res, order, 'Order update ho gaya — retailer ko bata diya');
});

/* --------------------------------------------------------- notifications */

export const listNotifications = asyncHandler(async (req, res) =>
  ok(res, await notifications.listNotifications(req.user._id, {
    onlyUnread: req.query.onlyUnread === 'true',
    limit: Number(req.query.limit || 30),
  })));

export const unreadCount = asyncHandler(async (req, res) =>
  ok(res, await notifications.unreadCount(req.user._id)));

export const markRead = asyncHandler(async (req, res) =>
  ok(res, await notifications.markRead(req.user._id, req.params.id)));

export const markAllRead = asyncHandler(async (req, res) =>
  ok(res, await notifications.markAllRead(req.user._id), 'Sab padh liya mark kar diya'));

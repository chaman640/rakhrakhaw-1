import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/order.service.js';
import * as notifications from '../services/notification.service.js';
import { logAction } from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const { orders, meta } = await service.listOrdersForWholesaler(req.businessId, req.query, req.user);
  return res.json({ success: true, message: 'OK', data: orders, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getOrderStats(req.businessId, req.user)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getOrderForWholesaler(req.businessId, req.params.id, req.user)));

export const setStatus = asyncHandler(async (req, res) => {
  const order = await service.updateStatus(req.businessId, req.params.id, req.body, req.user._id, req.user);
  const messages = {
    PACKED: `${order.orderNo} pack ho raha hai`,
    READY: `${order.orderNo} tayyar mark kar diya — retailer ko khabar chali gayi`,
    DELIVERED: `${order.orderNo} delivered mark kar diya`,
  };
  await logAction(req, {
    action: 'order.status',
    entityType: 'Order', entityId: order._id, entityLabel: order.orderNo,
    summary: `${order.orderNo} — ${req.body.status} kiya`,
  });
  return ok(res, order, messages[req.body.status]);
});

export const cancel = asyncHandler(async (req, res) => {
  const order = await service.cancelOrder(req.businessId, req.params.id, req.body, req.user._id, req.user);
  await logAction(req, {
    action: 'order.cancel',
    entityType: 'Order', entityId: order._id, entityLabel: order.orderNo,
    summary: `${order.orderNo} cancel kiya${req.body?.reason ? ` — ${req.body.reason}` : ''}`,
  });
  return ok(res, order, `${order.orderNo} cancel kar diya`);
});

export const updateItems = asyncHandler(async (req, res) => {
  const order = await service.updateOrderItems(req.businessId, req.params.id, req.body, req.user._id, req.user);
  await logAction(req, {
    action: 'order.items',
    entityType: 'Order', entityId: order._id, entityLabel: order.orderNo,
    summary: `${order.orderNo} ka maal badla — ab ${order.itemCount} item, ₹${order.itemsTotal}`,
  });
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

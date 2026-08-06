import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as catalog from '../services/catalog.service.js';
import * as cart from '../services/cart.service.js';
import * as orders from '../services/order.service.js';

/* ---------------------------------------------------------------- catalog */

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await catalog.listCatalog(req.businessId, req.partyId, req.query);
  return res.json({ success: true, message: 'OK', data: items, meta });
});

export const categories = asyncHandler(async (req, res) =>
  ok(res, await catalog.listCatalogCategories(req.businessId)));

export const shop = asyncHandler(async (req, res) =>
  ok(res, await catalog.getShopInfo(req.businessId)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await catalog.getCatalogItem(req.businessId, req.partyId, req.params.id)));

/* ------------------------------------------------------------------- cart */

export const getCart = asyncHandler(async (req, res) =>
  ok(res, await cart.getCart(req.businessId, req.partyId)));

export const cartCount = asyncHandler(async (req, res) =>
  ok(res, await cart.getCartCount(req.businessId, req.partyId)));

export const addToCart = asyncHandler(async (req, res) => {
  const { cart: updated, message } = await cart.addToCart(req.businessId, req.partyId, req.body);
  return ok(res, updated, message);
});

export const setQty = asyncHandler(async (req, res) =>
  ok(res, await cart.setCartQty(req.businessId, req.partyId, req.params.itemId, req.body.qty), 'Cart update ho gaya'));

export const removeItem = asyncHandler(async (req, res) =>
  ok(res, await cart.removeFromCart(req.businessId, req.partyId, req.params.itemId), 'Cart se hata diya'));

export const clear = asyncHandler(async (req, res) =>
  ok(res, await cart.clearCart(req.businessId, req.partyId), 'Cart khali kar diya'));

export const setNote = asyncHandler(async (req, res) =>
  ok(res, await cart.setCartNote(req.businessId, req.partyId, req.body.note || ''), 'Note save ho gaya'));

/* ----------------------------------------------------------------- orders */

export const placeOrder = asyncHandler(async (req, res) => {
  const order = await orders.placeOrder(req.businessId, req.partyId, req.user._id, req.body);
  return created(res, order, `Order ${order.orderNo} chala gaya`);
});

export const myOrders = asyncHandler(async (req, res) => {
  const { orders: rows, meta } = await orders.listOrders(req.businessId, req.query, { partyId: req.partyId });
  return res.json({ success: true, message: 'OK', data: rows, meta });
});

export const myOrderSummary = asyncHandler(async (req, res) =>
  ok(res, await orders.myOrderSummary(req.businessId, req.partyId)));

export const myOrderDetail = asyncHandler(async (req, res) =>
  ok(res, await orders.getOrder(req.businessId, req.params.id, { partyId: req.partyId })));

export const cancelOrder = asyncHandler(async (req, res) =>
  ok(res, await orders.cancelOwnOrder(req.businessId, req.partyId, req.params.id, req.user._id),
    'Order cancel ho gaya'));

import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/payment.service.js';

/* --------------------------------------------------------- wholesaler ka side */

export const list = asyncHandler(async (req, res) => {
  const { payments, meta } = await service.listPayments(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: payments, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getPayment(req.businessId, req.params.id)));

export const create = asyncHandler(async (req, res) => {
  const { payment, advance } = await service.createPayment(req.businessId, req.body, req.user._id);
  const extra = advance > 0 ? ` — ₹${advance} advance jama hai` : '';
  return created(res, { ...payment, advance }, `${payment.paymentNo} entry ho gaya${extra}`);
});

export const confirm = asyncHandler(async (req, res) => {
  const payment = await service.confirmPayment(req.businessId, req.params.id, req.user._id);
  return ok(res, payment, `${payment.paymentNo} confirm ho gaya — khate me lag gaya`);
});

export const reject = asyncHandler(async (req, res) => {
  const payment = await service.rejectPayment(req.businessId, req.params.id, req.body, req.user._id);
  return ok(res, payment, `${payment.paymentNo} reject kar diya`);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deletePayment(req.businessId, req.params.id, req.user._id);
  return ok(res, result, result.message);
});

/* ----------------------------------------------------------- retailer ka side */

export const myList = asyncHandler(async (req, res) => {
  const { payments, meta } = await service.listMyPayments(req.businessId, req.partyId, req.query);
  return res.json({ success: true, message: 'OK', data: payments, meta });
});

export const myClaim = asyncHandler(async (req, res) => {
  const payment = await service.claimPayment(req.businessId, req.partyId, req.body, req.user._id);
  return created(
    res, payment,
    'Bata diya gaya — wholesaler confirm karega tab khate me lagega'
  );
});

export const myDetail = asyncHandler(async (req, res) =>
  ok(res, await service.getPayment(req.businessId, req.params.id, { partyId: req.partyId })));

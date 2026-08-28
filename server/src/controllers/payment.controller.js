import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/payment.service.js';
import { logAction } from '../services/audit.service.js';

/* --------------------------------------------------------- wholesaler ka side */

export const list = asyncHandler(async (req, res) => {
  const { payments, meta } = await service.listPayments(req.businessId, req.query, req.user);
  return res.json({ success: true, message: 'OK', data: payments, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId, req.user)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getPayment(req.businessId, req.params.id, { viewer: req.user })));

export const create = asyncHandler(async (req, res) => {
  const { payment, advance } = await service.createPayment(req.businessId, req.body, req.user._id);
  const extra = advance > 0 ? ` — ₹${advance} advance jama hai` : '';

  await logAction(req, {
    action: 'payment.create',
    entityType: 'Payment', entityId: payment._id, entityLabel: payment.paymentNo,
    summary: `${payment.paymentNo} — ₹${payment.amount} ${payment.direction === 'OUT' ? 'diya' : 'liya'} (${payment.mode})`,
  });

  return created(res, { ...payment, advance }, `${payment.paymentNo} entry ho gaya${extra}`);
});

export const confirm = asyncHandler(async (req, res) => {
  const payment = await service.confirmPayment(req.businessId, req.params.id, req.user._id, req.user);
  await logAction(req, {
    action: 'payment.confirm',
    entityType: 'Payment', entityId: payment._id, entityLabel: payment.paymentNo,
    summary: `${payment.paymentNo} confirm kiya — ₹${payment.amount} khate me laga`,
  });
  return ok(res, payment, `${payment.paymentNo} confirm ho gaya — khate me lag gaya`);
});

export const reject = asyncHandler(async (req, res) => {
  const payment = await service.rejectPayment(req.businessId, req.params.id, req.body, req.user._id, req.user);
  await logAction(req, {
    action: 'payment.reject',
    entityType: 'Payment', entityId: payment._id, entityLabel: payment.paymentNo,
    summary: `${payment.paymentNo} reject kiya${req.body?.reason ? ` — ${req.body.reason}` : ''}`,
  });
  return ok(res, payment, `${payment.paymentNo} reject kar diya`);
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deletePayment(req.businessId, req.params.id, req.user._id, req.user);
  // Paisa mitana — ye wo kaam hai jiska sawal sabse zyada poochha jata hai
  await logAction(req, {
    action: 'payment.delete',
    entityType: 'Payment', entityId: req.params.id, entityLabel: result.paymentNo || '',
    summary: `${result.paymentNo || 'Payment'} mitaya${result.amount ? ` — ₹${result.amount}` : ''}`,
  });
  return ok(res, result, result.message);
});

/* ═════════════════════════════════════════════════ "dena hai" aur paisa wapas */

/** Jinka paisa hamare paas jama pada hai — payment history ke bagal wali list */
export const weOwe = asyncHandler(async (req, res) =>
  ok(res, await service.listWeOwePayments(req.businessId, req.user)));

/** Wapasi pe "kitna paisa wapas ho sakta hai" — button dikhane ke liye */
export const refundInfo = asyncHandler(async (req, res) =>
  ok(res, await service.refundInfo(req.businessId, req.params.id)));

/** Wapasi ka paisa cash/UPI se wapas */
export const refund = asyncHandler(async (req, res) => {
  const result = await service.refundReturn(
    req.businessId, req.params.id, req.body, req.user._id,
  );
  return created(res, result, `₹${result.payment.amount} wapas kar diya`);
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

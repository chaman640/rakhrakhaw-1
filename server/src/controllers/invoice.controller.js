import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/invoice.service.js';

export const list = asyncHandler(async (req, res) => {
  const { invoices, meta } = await service.listInvoices(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: invoices, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId)));

export const nextNumber = asyncHandler(async (req, res) =>
  ok(res, await service.nextNumber(req.businessId)));

export const prefill = asyncHandler(async (req, res) =>
  ok(res, await service.prefillFromOrder(req.businessId, req.params.orderId)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getInvoice(req.businessId, req.params.id)));

export const create = asyncHandler(async (req, res) => {
  const invoice = await service.createInvoice(req.businessId, req.body, req.user._id);
  return created(res, invoice, `${invoice.invoiceNo} ban gaya — stock ghata aur khata update ho gaya`);
});

export const cancel = asyncHandler(async (req, res) => {
  const result = await service.cancelInvoice(req.businessId, req.params.id, req.body, req.user._id);
  return ok(res, result, result.message);
});

/* --------------------------------------------------------- retailer side */

export const myList = asyncHandler(async (req, res) => {
  const { invoices, meta } = await service.listMyInvoices(req.businessId, req.partyId, req.query);
  return res.json({ success: true, message: 'OK', data: invoices, meta });
});

export const myDetail = asyncHandler(async (req, res) =>
  ok(res, await service.getInvoice(req.businessId, req.params.id, { partyId: req.partyId })));

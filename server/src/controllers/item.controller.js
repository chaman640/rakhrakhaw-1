import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { UNITS } from '../config/constants.js';
import * as service from '../services/item.service.js';
import { getMovements } from '../services/stock.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await service.listItems(req.businessId, req.query);
  return res.json({ success: true, message: 'OK', data: items, meta });
});

export const brands = asyncHandler(async (req, res) =>
  ok(res, await service.listBrands(req.businessId)));

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId)));

export const lowStock = asyncHandler(async (req, res) =>
  ok(res, await service.getLowStockItems(req.businessId)));

export const units = asyncHandler(async (req, res) => ok(res, UNITS));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getItem(req.businessId, req.params.id)));

export const movements = asyncHandler(async (req, res) =>
  ok(res, await getMovements(req.businessId, req.params.id)));

export const create = asyncHandler(async (req, res) =>
  created(res, await service.createItem(req.businessId, req.body, req.user._id), 'Item add ho gaya'));

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.updateItem(req.businessId, req.params.id, req.body, req.user._id), 'Item save ho gaya'));

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteItem(req.businessId, req.params.id);
  return ok(res, result, result.message);
});

export const uploadPhoto = asyncHandler(async (req, res) =>
  ok(res, await service.setPhoto(req.businessId, req.params.id, req.file), 'Photo lag gayi'));

export const deletePhoto = asyncHandler(async (req, res) =>
  ok(res, await service.removePhoto(req.businessId, req.params.id), 'Photo hata di'));

export const adjustStock = asyncHandler(async (req, res) => {
  const item = await service.adjustStock(req.businessId, req.params.id, req.body, req.user._id);
  return ok(res, item, `${item.name} ka stock ab ${item.stockQty} ${item.unit}`);
});

export const bulk = asyncHandler(async (req, res) => {
  const result = await service.bulkAction(req.businessId, req.body);
  return ok(res, result, result.message);
});

export const exportCsv = asyncHandler(async (req, res) => {
  const result = await service.exportCsv(req.businessId);
  return ok(res, result, `${result.count} item export hue`);
});

export const sampleCsv = asyncHandler(async (req, res) =>
  ok(res, { csv: service.sampleCsv() }));

export const importCsv = asyncHandler(async (req, res) => {
  const result = await service.importCsv(req.businessId, req.body, req.user._id);
  return ok(res, result,
    result.preview
      ? `${result.summary.willCreate} naye, ${result.summary.willUpdate} update honge`
      : `${result.summary.created} add hue, ${result.summary.updated} update hue`);
});

import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { UNITS } from '../config/constants.js';
import * as service from '../services/item.service.js';
import { getMovements } from '../services/stock.service.js';
import { logAction, diff } from '../services/audit.service.js';

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

export const create = asyncHandler(async (req, res) => {
  const item = await service.createItem(req.businessId, req.body, req.user._id);
  await logAction(req, {
    action: 'item.create',
    entityType: 'Item', entityId: item._id, entityLabel: item.name,
    summary: `Naya item "${item.name}" jodha`,
  });
  return created(res, item, 'Item add ho gaya');
});

/**
 * Rate badalna dukaan ka sabse nazuk kaam hai — isliye pehle purani haalat
 * padh lete hain, taaki register me "kya se kya" likha ja sake. Ek extra
 * read lagti hai, par "sale rate kisne 120 se 90 kiya" ka jawab mil jata hai.
 */
const ITEM_FIELDS = {
  name: 'Naam',
  purchasePrice: 'Purchase rate',
  salePrice: 'Sale rate',
  wholesalePrice: 'Wholesale rate',
  gstRate: 'GST %',
  lowStockAt: 'Low stock pe',
  unit: 'Unit',
  hsn: 'HSN',
  isActive: 'Chalu hai',
};

export const update = asyncHandler(async (req, res) => {
  const before = await service.getItem(req.businessId, req.params.id).catch(() => null);
  const item = await service.updateItem(req.businessId, req.params.id, req.body, req.user._id);

  const changes = diff(before, item, ITEM_FIELDS);
  if (changes.length) {
    await logAction(req, {
      action: 'item.update',
      entityType: 'Item', entityId: item._id, entityLabel: item.name,
      changes,
      summary: `"${item.name}" me ${changes.map((c) => c.label).join(', ')} badla`,
    });
  }

  return ok(res, item, 'Item save ho gaya');
});

export const remove = asyncHandler(async (req, res) => {
  const before = await service.getItem(req.businessId, req.params.id).catch(() => null);
  const result = await service.deleteItem(req.businessId, req.params.id);
  await logAction(req, {
    action: 'item.delete',
    entityType: 'Item', entityId: req.params.id, entityLabel: before?.name || '',
    summary: `Item "${before?.name || ''}" hataya`,
  });
  return ok(res, result, result.message);
});

export const uploadPhoto = asyncHandler(async (req, res) =>
  ok(res, await service.setPhoto(req.businessId, req.params.id, req.file), 'Photo lag gayi'));

export const deletePhoto = asyncHandler(async (req, res) =>
  ok(res, await service.removePhoto(req.businessId, req.params.id), 'Photo hata di'));

export const adjustStock = asyncHandler(async (req, res) => {
  const item = await service.adjustStock(req.businessId, req.params.id, req.body, req.user._id);
  await logAction(req, {
    action: 'item.stock',
    entityType: 'Item', entityId: item._id, entityLabel: item.name,
    summary: `"${item.name}" ka stock haath se badla — ab ${item.stockQty} ${item.unit}`
      + (req.body?.note ? ` (${req.body.note})` : ''),
  });
  return ok(res, item, `${item.name} ka stock ab ${item.stockQty} ${item.unit}`);
});

export const bulk = asyncHandler(async (req, res) => {
  const result = await service.bulkAction(req.businessId, req.body);
  await logAction(req, {
    action: 'item.bulk',
    entityType: 'Item',
    summary: `${req.body?.itemIds?.length || 0} item pe ek saath "${req.body?.action}" kiya`,
  });
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

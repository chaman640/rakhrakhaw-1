import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/category.service.js';

export const list = asyncHandler(async (req, res) =>
  ok(res, await service.listCategories(req.businessId, { includeInactive: req.query.all === 'true' })));

export const create = asyncHandler(async (req, res) =>
  created(res, await service.createCategory(req.businessId, req.body), 'Category ban gayi'));

export const update = asyncHandler(async (req, res) =>
  ok(res, await service.updateCategory(req.businessId, req.params.id, req.body), 'Category save ho gayi'));

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteCategory(req.businessId, req.params.id);
  return ok(res, result,
    result.itemsMoved
      ? `Category hat gayi — ${result.itemsMoved} item "bina category" me chale gaye`
      : 'Category hat gayi');
});

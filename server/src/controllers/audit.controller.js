import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/audit.service.js';

export const list = asyncHandler(async (req, res) => {
  const { rows, meta } = await service.listAudit(req.businessId, req.query, req.user);
  return res.json({ success: true, message: 'OK', data: rows, meta });
});

export const history = asyncHandler(async (req, res) =>
  ok(res, await service.historyOf(req.businessId, req.params.entityType, req.params.entityId)));

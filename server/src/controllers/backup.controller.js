import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import ApiError from '../utils/ApiError.js';
import * as service from '../services/backup.service.js';

export const summary = asyncHandler(async (req, res) =>
  ok(res, await service.backupSummary(req.businessId)));

/** Poora data, ek JSON file me */
export const download = asyncHandler(async (req, res) => {
  const backup = await service.fullBackup(req.businessId);
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = (backup.meta.businessName || 'rakhrakhav')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rakhrakhav';

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-backup-${stamp}.json"`);
  return res.send(JSON.stringify(backup, null, 2));
});

export const csv = asyncHandler(async (req, res) => {
  const result = await service.exportCsvKind(req.businessId, req.params.kind);
  if (!result) throw ApiError.notFound('Aisi koi file nahi banti');

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.kind}-${stamp}.csv"`);
  // BOM taaki Excel me Hinglish theek dikhe
  return res.send('﻿' + result.csv);
});

import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import ApiError from '../utils/ApiError.js';
import { toCsv } from '../utils/csv.js';
import { REPORTS } from '../services/report.service.js';
import * as dashboard from '../services/dashboard.service.js';

/* ────────────────────────────────────────────────────────────────── reports */

export const run = asyncHandler(async (req, res) => {
  const fn = REPORTS[req.params.name];
  if (!fn) throw ApiError.notFound('Aisi koi report nahi hai');
  return ok(res, await fn(req.businessId, req.query, req.user));
});

/**
 * Wahi report, CSV me.
 *
 * Columns report se hi aate hain — naya column jodne par CSV apne aap update ho jata hai,
 * yahan kuch badalna nahi padta.
 */
export const download = asyncHandler(async (req, res) => {
  const fn = REPORTS[req.params.name];
  if (!fn) throw ApiError.notFound('Aisi koi report nahi hai');

  const report = await fn(req.businessId, req.query, req.user);
  const headers = report.columns.map((c) => c.header);

  const rows = report.rows.map((r) =>
    Object.fromEntries(report.columns.map((c) => [c.header, r[c.key] ?? ''])));

  // Aakhri line me total — Excel me kholte hi jod dikh jata hai
  if (Object.keys(report.totals || {}).length) {
    rows.push(Object.fromEntries(report.columns.map((c) => [
      c.header, c.key === 'label' ? 'KUL' : (report.totals[c.key] ?? ''),
    ])));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${req.params.name}-report-${stamp}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM taaki Excel me Hinglish/₹ theek dikhe
  return res.send('﻿' + toCsv(headers, rows));
});

/* ──────────────────────────────────────────────────────────────── dashboard */

export const wholesalerHome = asyncHandler(async (req, res) =>
  ok(res, await dashboard.getWholesalerDashboard(req.businessId, req.user, req.query)));

export const retailerHome = asyncHandler(async (req, res) =>
  ok(res, await dashboard.getRetailerDashboard(req.businessId, req.partyId, req.user._id)));

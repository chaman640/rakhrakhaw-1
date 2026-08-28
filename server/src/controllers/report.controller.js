import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import ApiError from '../utils/ApiError.js';
import { toCsv } from '../utils/csv.js';
import { REPORTS } from '../services/report.service.js';
import * as dashboard from '../services/dashboard.service.js';
import { userCan } from '../middleware/auth.js';

/* ────────────────────────────────────────────────────────────────── reports */

/**
 * MUNAFE WALI REPORT ALAG HAI (item 22).
 *
 * `reports:view` ek hi chaabi thi jo SAARI report khol deti thi — "pl" wali
 * bhi. Yaani counter wale ladke ko, jise sirf paisa lena-dena karna hai,
 * dukaan ka poora munafa, har item ki LAGAT aur margin dikh jata tha. Wahi
 * ek number hai jo koi bhi dukaandaar apne staff ko nahi dikhana chahta —
 * aur wo apne aap khula pada tha.
 *
 * "Stock" report bhi isi list me hai, aur wajah wahi hai: usme har item ki
 * lagat hoti hai, yaani munafa ghata kar nikala ja sakta hai. Ek darwaza
 * band karke doosra khula chhod dena band karne ka natak hai.
 *
 * Baaki report (sale, payment, outstanding, gst) wahin ki wahin hain — unme
 * bikri aur udhaar hai, lagat nahi.
 */
const PROFIT_REPORTS = new Set(['pl', 'stock']);

function assertCanSeeProfit(req) {
  if (!PROFIT_REPORTS.has(req.params.name)) return;
  if (userCan(req.user, 'reports:profit')) return;
  throw ApiError.forbidden('Ye report dekhne ki ijazat aapke paas nahi hai');
}

export const run = asyncHandler(async (req, res) => {
  const fn = REPORTS[req.params.name];
  if (!fn) throw ApiError.notFound('Aisi koi report nahi hai');
  assertCanSeeProfit(req);
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
  // CSV bhi wahi hadd — warna download ka rasta khula reh jata, aur wahi
  // sabse aasan rasta hota
  assertCanSeeProfit(req);

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

import mongoose from 'mongoose';
import { AdminNotification, Subscription, Business } from '../models/index.js';
import { ADMIN_ALERTS } from '../models/AdminNotification.js';
import { platformConfig } from './platform.service.js';

const DAY = 86400000;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
// Which admin permission is needed to see each alert
const ALERT_PERM = {
  new_seller: 'businesses:view', new_subscription: 'payments:view', payment_failed: 'payments:view', trial_ending: 'businesses:view', expired: 'businesses:view',
  ticket: 'support:manage', urgent_ticket: 'support:manage', suspicious_login: 'admins:manage', system_error: 'admins:manage', content_issue: 'content:manage',
};

/** Raise an admin alert (never throws; respects the settings switch) */
export async function notifyAdmins(type, { title, body = '', link = '', severity = 'info', key = null }) {
  try {
    if (!ADMIN_ALERTS.includes(type)) return null;
    if (platformConfig().notify?.[type] === false) return null;
    return await AdminNotification.create({ type, title, body: String(body).slice(0, 1000), link, severity, key });
  } catch (e) {
    if (e?.code !== 11000) console.warn('[admin-notify]', e.message);
    return null;
  }
}

export function visibleTypes(perms) {
  return ADMIN_ALERTS.filter((t) => perms.includes(ALERT_PERM[t]));
}

export async function listAdminAlerts(adminId, perms, { unread = false, page = 1, limit = 30 } = {}) {
  const f = { type: { $in: visibleTypes(perms) } };
  if (unread) f.readBy = { $ne: oid(adminId) };
  const [rows, total, unreadCount] = await Promise.all([
    AdminNotification.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdminNotification.countDocuments(f),
    AdminNotification.countDocuments({ type: f.type, readBy: { $ne: oid(adminId) } }),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, read: r.readBy.some((x) => String(x) === String(adminId)), readBy: undefined })),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), unread: unreadCount },
  };
}

export async function markAlertsRead(adminId, perms, ids = null) {
  const f = { type: { $in: visibleTypes(perms) }, readBy: { $ne: oid(adminId) } };
  if (ids?.length) f._id = { $in: ids };
  const r = await AdminNotification.updateMany(f, { $addToSet: { readBy: oid(adminId) } });
  return { updated: r.modifiedCount };
}

/* ── failed user logins → suspicious login alert ── */
const fails = new Map();
export function recordLoginFailure(phone, ip = '') {
  const now = Date.now();
  const list = (fails.get(phone) || []).filter((t) => now - t < 15 * 60000);
  list.push(now);
  fails.set(phone, list);
  if (fails.size > 5000) fails.clear();
  if (list.length === 5) {
    notifyAdmins('suspicious_login', {
      title: `5 wrong passwords for ${String(phone).replace(/^(\d{2})\d+(\d{2})$/, '$1••••••$2')}`,
      body: `Within 15 minutes${ip ? ` from ${ip}` : ''}`, severity: 'warning', key: `login:${phone}:${Math.floor(now / 3600000)}`,
    });
  }
}
export const clearLoginFailures = (phone) => fails.delete(phone);

/* ── system errors (throttled per message per hour) ── */
export function reportSystemError(err, req) {
  const msg = String(err?.message || err).slice(0, 160);
  notifyAdmins('system_error', {
    title: `Server error: ${msg}`, body: `${req?.method || ''} ${req?.originalUrl || ''}`.trim(), severity: 'critical',
    key: `err:${msg}:${Math.floor(Date.now() / 3600000)}`,
  });
}

/* ── subscription sweep: trials ending soon, subscriptions expired ── */
export async function sweepSubscriptionAlerts() {
  const now = new Date();
  const soon = new Date(Date.now() + 2 * DAY);
  const [ending, expired] = await Promise.all([
    Subscription.find({ isTrial: true, trialEndsAt: { $gt: now, $lte: soon } }).select('businessId trialEndsAt planCode').limit(500).lean(),
    Subscription.find({ isTrial: false, paidTill: { $lt: now, $gt: new Date(Date.now() - 7 * DAY) } }).select('businessId paidTill planCode').limit(500).lean(),
  ]);
  const ids = [...ending, ...expired].map((s) => s.businessId);
  const names = new Map((await Business.find({ _id: { $in: ids } }).select('name').lean()).map((b) => [String(b._id), b.name]));
  for (const s of ending) {
    await notifyAdmins('trial_ending', { title: `Trial ending: ${names.get(String(s.businessId)) || 'a shop'}`, body: `Ends ${s.trialEndsAt.toISOString().slice(0, 10)}`, link: `/partner/admin/platform/businesses/${s.businessId}`, key: `trial:${s.businessId}:${s.trialEndsAt.toISOString().slice(0, 10)}` });
  }
  for (const s of expired) {
    await notifyAdmins('expired', { title: `Subscription expired: ${names.get(String(s.businessId)) || 'a shop'}`, body: `${s.planCode} · ended ${s.paidTill.toISOString().slice(0, 10)}`, severity: 'warning', link: `/partner/admin/platform/businesses/${s.businessId}`, key: `exp:${s.businessId}:${s.paidTill.toISOString().slice(0, 10)}` });
  }
  return { ending: ending.length, expired: expired.length };
}

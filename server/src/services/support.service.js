import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { ROLES, NOTIFICATION_TYPES } from '../config/constants.js';
import { STAFF_ROLES } from '../config/permissions.js';
import { permsOfRole } from '../config/adminRoles.js';
import { saveImage } from '../utils/storage.js';
import { notify } from './notification.service.js';
import { audit } from './platformAdmin.service.js';
import {
  SupportTicket, Counter, User, Business, PartnerAdmin,
} from '../models/index.js';

const PLATFORM = new mongoose.Types.ObjectId('000000000000000000000000');
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function nextTicketNo() {
  const c = await Counter.findOneAndUpdate({ businessId: PLATFORM, key: 'support', fy: 'all' }, { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return `SUP-${String(c.seq).padStart(5, '0')}`;
}

const userTypeOf = (u) => (u.role === ROLES.RETAILER ? 'buyer' : u.staffRole === STAFF_ROLES.EMPLOYEE ? 'employee' : 'seller');

async function upload(files) {
  const urls = [];
  for (const f of (files || []).slice(0, 3)) urls.push((await saveImage(f, 'support')).url);
  return urls;
}

// Admin ke andar ke note user ko kabhi nahi jate
const forUser = (t) => ({ ...t, messages: t.messages.filter((m) => !m.internal), adminUnread: undefined, assignedAdminId: undefined });

/* ─────────────────────────────── user ─────────────────────────────── */

export async function myTickets(user) {
  const rows = await SupportTicket.find({ userId: user._id }).sort({ lastActivityAt: -1 }).limit(100)
    .select('ticketNo subject category status priority lastActivityAt userUnread createdAt').lean();
  return rows;
}

export async function createTicket(user, body, files) {
  const attachments = await upload(files);
  const t = await SupportTicket.create({
    ticketNo: await nextTicketNo(),
    userId: user._id,
    businessId: user.businessId || null,
    userType: userTypeOf(user),
    category: body.category,
    subject: body.subject,
    priority: body.priority === 'high' ? 'high' : 'normal',
    messages: [{ by: 'user', byId: user._id, byName: user.name, text: body.description, attachments }],
  });
  return forUser(t.toObject());
}

async function ownTicket(user, id) {
  const t = await SupportTicket.findOne({ _id: id, userId: user._id });
  if (!t) throw ApiError.notFound('Ticket not found');
  return t;
}

export async function getMyTicket(user, id) {
  const t = await ownTicket(user, id);
  if (t.userUnread) { t.userUnread = 0; await t.save(); }
  return forUser(t.toObject());
}

export async function userReply(user, id, { text }, files) {
  const t = await ownTicket(user, id);
  if (t.status === 'closed') throw ApiError.badRequest('This ticket is closed. Please open a new one.');
  const attachments = await upload(files);
  if (!text && !attachments.length) throw ApiError.badRequest('Write a message or attach a photo');
  t.messages.push({ by: 'user', byId: user._id, byName: user.name, text, attachments });
  if (['waiting_user', 'resolved'].includes(t.status)) t.status = 'open';
  t.adminUnread += 1;
  t.lastActivityAt = new Date();
  await t.save();
  return forUser(t.toObject());
}

export async function userClose(user, id) {
  const t = await ownTicket(user, id);
  t.status = 'closed';
  t.lastActivityAt = new Date();
  await t.save();
  return forUser(t.toObject());
}

export async function unreadCount(user) {
  const r = await SupportTicket.aggregate([{ $match: { userId: user._id } }, { $group: { _id: null, n: { $sum: '$userUnread' } } }]);
  return { unread: r[0]?.n || 0 };
}

/* ─────────────────────────────── admin ─────────────────────────────── */

export async function adminList({ status = 'active', priority = '', assigned = '', q = '', page = 1, limit = 30 }, adminId) {
  const f = {};
  if (status === 'active') f.status = { $in: ['open', 'in_progress', 'waiting_user'] };
  else if (status) f.status = status;
  if (priority) f.priority = priority;
  if (assigned === 'me') f.assignedAdminId = adminId;
  else if (assigned === 'none') f.assignedAdminId = null;
  if (q) f.$or = [{ ticketNo: new RegExp(esc(q), 'i') }, { subject: new RegExp(esc(q), 'i') }];
  const [rows, total, counts] = await Promise.all([
    SupportTicket.find(f).sort({ rank: 1, lastActivityAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('ticketNo userId businessId userType subject category status priority assignedAdminId lastActivityAt adminUnread createdAt').lean(),
    SupportTicket.countDocuments(f),
    SupportTicket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, urgent: { $sum: { $cond: [{ $in: ['$priority', ['high', 'urgent']] }, 1, 0] } } } }]),
  ]);
  const [users, bizs, admins] = await Promise.all([
    User.find({ _id: { $in: rows.map((r) => r.userId) } }).select('name phone').lean(),
    Business.find({ _id: { $in: rows.map((r) => r.businessId).filter(Boolean) } }).select('name').lean(),
    PartnerAdmin.find({ _id: { $in: rows.map((r) => r.assignedAdminId).filter(Boolean) } }).select('name email').lean(),
  ]);
  const um = new Map(users.map((u) => [String(u._id), u]));
  const bm = new Map(bizs.map((b) => [String(b._id), b.name]));
  const am = new Map(admins.map((a) => [String(a._id), a.name || a.email]));
  const openStatuses = ['open', 'in_progress', 'waiting_user'];
  return {
    rows: rows.map((r) => ({ ...r, userName: um.get(String(r.userId))?.name || '', userPhone: um.get(String(r.userId))?.phone || '', businessName: bm.get(String(r.businessId)) || '', assignedName: am.get(String(r.assignedAdminId)) || '' })),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    counts: {
      ...Object.fromEntries(counts.map((c) => [c._id, c.n])),
      active: counts.filter((c) => openStatuses.includes(c._id)).reduce((s, c) => s + c.n, 0),
      urgent: counts.filter((c) => openStatuses.includes(c._id)).reduce((s, c) => s + c.urgent, 0),
    },
  };
}

export async function adminGet(id) {
  const t = await SupportTicket.findById(id);
  if (!t) throw ApiError.notFound('Ticket not found');
  if (t.adminUnread) { t.adminUnread = 0; await t.save(); }
  const [u, b, a] = await Promise.all([
    User.findById(t.userId).select('name phone role staffRole lastLoginAt').lean(),
    t.businessId ? Business.findById(t.businessId).select('name phone').lean() : null,
    t.assignedAdminId ? PartnerAdmin.findById(t.assignedAdminId).select('name email').lean() : null,
  ]);
  return { ...t.toObject(), user: u, business: b, assignedName: a ? (a.name || a.email) : '' };
}

export async function adminReply(adminCtx, id, { text, internal = false, status }, files) {
  const t = await SupportTicket.findById(id);
  if (!t) throw ApiError.notFound('Ticket not found');
  const attachments = await upload(files);
  if (!text && !attachments.length) throw ApiError.badRequest('Write a message');
  const admin = await PartnerAdmin.findById(adminCtx.adminId).select('name email').lean();
  t.messages.push({ by: 'admin', byId: adminCtx.adminId, byName: admin?.name || 'RakhRakhav Support', text, attachments, internal });
  if (!internal) {
    t.userUnread += 1;
    t.status = status || (t.status === 'open' ? 'waiting_user' : t.status);
    if (!t.assignedAdminId) t.assignedAdminId = adminCtx.adminId;
  } else if (status) t.status = status;
  if (t.status === 'resolved') t.resolvedAt = new Date();
  t.lastActivityAt = new Date();
  await t.save();
  if (!internal && t.businessId) {
    await notify({
      businessId: t.businessId, userId: t.userId, type: NOTIFICATION_TYPES.SUPPORT_REPLY,
      title: `Support replied on ${t.ticketNo}`, body: text.slice(0, 140), link: `/support/${t._id}`,
    }).catch(() => null);
  }
  return adminGet(id);
}

export async function adminUpdate(adminCtx, id, body) {
  const t = await SupportTicket.findById(id);
  if (!t) throw ApiError.notFound('Ticket not found');
  const before = { status: t.status, priority: t.priority, assignedAdminId: t.assignedAdminId };
  if (body.assignedAdminId !== undefined) {
    if (body.assignedAdminId) {
      const a = await PartnerAdmin.findById(body.assignedAdminId).select('role active').lean();
      if (!a || a.active === false || !permsOfRole(a.role || 'super').includes('support:manage')) throw ApiError.badRequest('This admin cannot handle support tickets');
    }
    t.assignedAdminId = body.assignedAdminId || null;
  }
  if (body.priority) t.priority = body.priority;
  if (body.status) {
    t.status = body.status;
    if (body.status === 'resolved') t.resolvedAt = new Date();
  }
  t.lastActivityAt = new Date();
  await t.save();
  await audit(adminCtx, { action: 'support.updated', targetType: 'SupportTicket', targetId: t._id, targetLabel: t.ticketNo, before, after: { status: t.status, priority: t.priority, assignedAdminId: t.assignedAdminId } });
  return adminGet(id);
}

export async function supportAdmins() {
  const rows = await PartnerAdmin.find({ active: { $ne: false } }).select('name email role').lean();
  return rows.filter((a) => permsOfRole(a.role || 'super').includes('support:manage')).map((a) => ({ _id: a._id, name: a.name || a.email }));
}

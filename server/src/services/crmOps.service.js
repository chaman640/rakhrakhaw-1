import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { currentPeriod, monthOf } from '../utils/istDay.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import { userCan } from '../config/permissions.js';
import {
  Complaint, Party, Invoice, Counter, CrmTask, Lead, Employee, Business, CrmSettings, User, Quotation,
} from '../models/index.js';
import { scopePartiesMatch, isScoped } from '../utils/scope.js';
import {
  hasFeature, assertFeature, isOwner, nameMap, tellAssignee, assignableStaff,
} from './crmWork.service.js';
import { getSettings, loadCustomers, reorderOf, territoryOf } from './crmInsight.service.js';
import { salesByUser, ensureProfiles } from './hr.service.js';
import { notify } from './notification.service.js';

const DAY = 86400000;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const manager = (u) => isOwner(u) || userCan(u, 'parties:edit');

/* ─────────────────────────────── complaints ─────────────────────────────── */

async function visibleParty(businessId, user, partyId) {
  const p = await Party.findOne(scopePartiesMatch({ _id: oid(partyId), businessId: oid(businessId) }, user)).select('name shopName assignedToUserId').lean();
  if (!p) throw ApiError.badRequest('Customer not found');
  return p;
}

function complaintScope(user) {
  if (!isScoped(user)) return {};
  return { $or: [{ assignedToUserId: user._id }, { createdBy: user._id }] };
}

async function shapeComplaints(rows) {
  const names = await nameMap(rows.map((c) => c.assignedToUserId));
  const parties = await Party.find({ _id: { $in: rows.map((c) => c.partyId) } }).select('name shopName phone').lean();
  const pm = new Map(parties.map((p) => [String(p._id), p]));
  return rows.map((c) => {
    const p = pm.get(String(c.partyId));
    return { ...c, assignedToName: names.get(String(c.assignedToUserId)) || '', party: p ? { _id: p._id, name: p.shopName || p.name, phone: p.phone } : null };
  });
}

export async function listComplaints(businessId, user, { status = 'open', priority = '', partyId = '', assigned = '', page = 1, limit = 30 }) {
  await assertFeature(businessId, 'crm_basic');
  const f = { businessId, ...complaintScope(user) };
  if (status === 'open') f.status = { $in: ['new', 'assigned', 'processing'] };
  else if (status) f.status = status;
  if (priority) f.priority = priority;
  if (partyId) f.partyId = partyId;
  if (assigned) f.assignedToUserId = assigned === 'none' ? null : assigned;
  const [rows, total, counts] = await Promise.all([
    Complaint.find(f).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Complaint.countDocuments(f),
    Complaint.aggregate([{ $match: { businessId: oid(businessId), ...complaintScope(user) } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  return {
    rows: await shapeComplaints(rows),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) },
  };
}

export async function getComplaint(businessId, user, id) {
  await assertFeature(businessId, 'crm_basic');
  const c = await Complaint.findOne({ _id: id, businessId, ...complaintScope(user) }).lean();
  if (!c) throw ApiError.notFound('Complaint not found');
  return (await shapeComplaints([c]))[0];
}

export async function createComplaint(businessId, user, body) {
  await assertFeature(businessId, 'crm_basic');
  const party = await visibleParty(businessId, user, body.partyId);
  let invoiceNo = '';
  if (body.invoiceId) {
    const inv = await Invoice.findOne({ _id: body.invoiceId, businessId, partyId: party._id }).select('invoiceNo').lean();
    if (!inv) throw ApiError.badRequest('Bill not found for this customer');
    invoiceNo = inv.invoiceNo;
  }
  const smart = await hasFeature(businessId, 'crm_smart');
  let assignee = null;
  if (body.assignedToUserId) {
    await assertFeature(businessId, 'crm_assign');
    if (!manager(user) && String(body.assignedToUserId) !== String(user._id)) throw ApiError.forbidden('Only the owner or a manager can assign to others');
    if (!(await User.exists({ _id: body.assignedToUserId, businessId, isActive: { $ne: false } }))) throw ApiError.badRequest('Staff not found');
    assignee = body.assignedToUserId;
  } else if (smart) {
    const s = await getSettings(businessId);
    assignee = s.complaintAssigneeUserId || party.assignedToUserId || null;
  }
  const { number } = await Counter.nextNumber({ businessId, key: 'complaint', prefix: 'CMP' });
  const c = await Complaint.create({
    businessId, complaintNo: number, partyId: party._id, invoiceId: body.invoiceId || null, invoiceNo,
    subject: body.subject, detail: body.detail || '', category: body.category || 'other', priority: body.priority || 'normal',
    status: assignee ? 'assigned' : 'new', assignedToUserId: assignee, createdBy: user._id,
    history: [{ byName: user.name, action: 'created', note: assignee ? 'Assigned automatically' : '' }],
  });
  if (assignee && String(assignee) !== String(user._id)) await tellAssignee(businessId, assignee, `Complaint ${number}: ${c.subject}`, `/crm/complaints/${c._id}`);
  if (c.priority === 'urgent') {
    const biz = await Business.findById(businessId).select('ownerUserId').lean();
    if (biz && String(biz.ownerUserId) !== String(user._id)) {
      await notify({ businessId, userId: biz.ownerUserId, type: NOTIFICATION_TYPES.TASK_ASSIGNED, title: `Urgent complaint from ${party.shopName || party.name}`, body: c.subject, link: `/crm/complaints/${c._id}` }).catch(() => {});
    }
  }
  return getComplaint(businessId, user, c._id);
}

export async function updateComplaint(businessId, user, id, body) {
  await assertFeature(businessId, 'crm_basic');
  const c = await Complaint.findOne({ _id: id, businessId, ...complaintScope(user) });
  if (!c) throw ApiError.notFound('Complaint not found');
  const mine = String(c.assignedToUserId || '') === String(user._id) || String(c.createdBy || '') === String(user._id);
  if (!manager(user) && !mine) throw ApiError.forbidden('This complaint is not yours');
  const log = [];
  if (body.assignedToUserId !== undefined && String(body.assignedToUserId || '') !== String(c.assignedToUserId || '')) {
    await assertFeature(businessId, 'crm_assign');
    if (!manager(user)) throw ApiError.forbidden('Only the owner or a manager can reassign');
    if (body.assignedToUserId && !(await User.exists({ _id: body.assignedToUserId, businessId, isActive: { $ne: false } }))) throw ApiError.badRequest('Staff not found');
    c.assignedToUserId = body.assignedToUserId || null;
    const n = (await nameMap([body.assignedToUserId])).get(String(body.assignedToUserId));
    log.push(`Assigned to ${n || 'nobody'}`);
    if (c.status === 'new' && c.assignedToUserId) c.status = 'assigned';
    if (c.assignedToUserId && String(c.assignedToUserId) !== String(user._id)) await tellAssignee(businessId, c.assignedToUserId, `Complaint ${c.complaintNo}: ${c.subject}`, `/crm/complaints/${c._id}`);
  }
  if (body.priority && body.priority !== c.priority) { log.push(`Priority: ${c.priority} → ${body.priority}`); c.priority = body.priority; }
  if (body.category) c.category = body.category;
  if (body.resolution !== undefined) c.resolution = body.resolution;
  if (body.status && body.status !== c.status) {
    if (['resolved', 'closed'].includes(body.status) && !String(body.resolution ?? c.resolution).trim()) throw ApiError.badRequest('Write what was done to solve it');
    log.push(`Status: ${c.status} → ${body.status}`);
    c.status = body.status;
    c.resolvedAt = ['resolved', 'closed'].includes(body.status) ? (c.resolvedAt || new Date()) : null;
  }
  if (body.note) log.push(body.note);
  if (!log.length && body.resolution === undefined && !body.category) return getComplaint(businessId, user, id);
  c.history.push({ byName: user.name, action: log.join(' · ') || 'updated', note: body.note || '' });
  await c.save();
  return getComplaint(businessId, user, id);
}

/* ─────────────────────────────── targets & performance ─────────────────────────────── */

export async function targets(businessId, user, { period = currentPeriod() }) {
  await assertFeature(businessId, 'crm_smart');
  await ensureProfiles(businessId);
  const { start, end } = monthOf(period);
  const staff = await assignableStaff(businessId);
  const visible = manager(user) ? staff : staff.filter((s) => String(s._id) === String(user._id));
  const ids = visible.map((s) => s._id);
  const [emps, sales] = await Promise.all([
    Employee.find({ businessId, userId: { $in: ids } }).select('userId salary.monthlyTarget').lean(),
    salesByUser(businessId, ids, start, end),
  ]);
  const tm = new Map(emps.map((e) => [String(e.userId), e.salary?.monthlyTarget || 0]));
  const rows = visible.map((s) => {
    const target = tm.get(String(s._id)) || 0;
    const achieved = round2(sales.get(String(s._id)) || 0);
    return { userId: s._id, name: s.name, staffRole: s.staffRole, target, achieved, pct: target ? Math.round((achieved / target) * 100) : null };
  }).sort((a, b) => b.achieved - a.achieved);
  const tt = rows.reduce((a, r) => a + r.target, 0);
  const ta = rows.reduce((a, r) => a + r.achieved, 0);
  return { period, rows, total: { target: tt, achieved: round2(ta), pct: tt ? Math.round((ta / tt) * 100) : null } };
}

export async function setTarget(businessId, user, userId, amount) {
  await assertFeature(businessId, 'crm_smart');
  if (!manager(user)) throw ApiError.forbidden('Only the owner or a manager can set targets');
  await ensureProfiles(businessId);
  const r = await Employee.updateOne({ businessId, userId }, { $set: { 'salary.monthlyTarget': amount } });
  if (!r.matchedCount) throw ApiError.notFound('Staff not found');
  return { userId, target: amount };
}

/** Salesman scorecard: leads, contacted, converted, sales, follow-ups done on time */
export async function salesmanPerformance(businessId, user, { days = 30 }) {
  await assertFeature(businessId, 'crm_assign');
  if (!manager(user)) throw ApiError.forbidden('Only the owner or a manager can see team performance');
  const since = new Date(Date.now() - days * DAY);
  const bid = oid(businessId);
  const staff = await assignableStaff(businessId);
  const ids = staff.map((s) => s._id);
  const smart = await hasFeature(businessId, 'crm_smart');
  const [leads, tasks, complaints, sales] = await Promise.all([
    Lead.aggregate([
      { $match: { businessId: bid, createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$assignedToUserId', leads: { $sum: 1 },
          contacted: { $sum: { $cond: [{ $ne: ['$stage', 'new'] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $eq: ['$stage', 'lost'] }, 1, 0] } },
          pipeline: { $sum: { $cond: [{ $in: ['$stage', ['won', 'lost']] }, 0, '$expectedValue'] } },
        },
      },
    ]),
    CrmTask.aggregate([
      { $match: { businessId: bid, dueAt: { $gte: since, $lte: new Date() } } },
      {
        $group: {
          _id: '$assignedToUserId', due: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          onTime: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'done'] }, { $lte: ['$doneAt', { $add: ['$dueAt', DAY] }] }] }, 1, 0] } },
        },
      },
    ]),
    Complaint.aggregate([
      { $match: { businessId: bid, createdAt: { $gte: since } } },
      { $group: { _id: '$assignedToUserId', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] } } } },
    ]),
    smart ? salesByUser(businessId, ids, since, new Date()) : new Map(),
  ]);
  const m = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const L = m(leads); const T = m(tasks); const C = m(complaints);
  return {
    days, smart,
    rows: staff.map((s) => {
      const k = String(s._id);
      const l = L.get(k) || {}; const t = T.get(k) || {}; const c = C.get(k) || {};
      return {
        userId: s._id, name: s.name, staffRole: s.staffRole,
        leads: l.leads || 0, contacted: l.contacted || 0, converted: l.converted || 0, lost: l.lost || 0, pipeline: round2(l.pipeline || 0),
        conversionPct: l.leads ? Math.round(((l.converted || 0) / l.leads) * 100) : null,
        followUpsDue: t.due || 0, followUpsDone: t.done || 0, followUpPct: t.due ? Math.round(((t.done || 0) / t.due) * 100) : null, onTimePct: t.done ? Math.round(((t.onTime || 0) / t.done) * 100) : null,
        complaints: c.total || 0, complaintsResolved: c.resolved || 0,
        sales: smart ? round2(sales.get(k) || 0) : null,
      };
    }).sort((a, b) => (b.sales || 0) - (a.sales || 0) || b.converted - a.converted),
  };
}

/* ─────────────────────────────── automation ─────────────────────────────── */

const RUN_EVERY = 6 * 3600000;

async function usedAutoKeys(businessId, keys) {
  if (!keys.length) return new Set();
  const rows = await CrmTask.find({ businessId, autoKey: { $in: keys } }).select('autoKey').lean();
  return new Set(rows.map((r) => r.autoKey));
}

/**
 * Creates follow-up work on its own: re-orders due, customers going quiet,
 * quotations waiting, leads nobody called. Runs at most every 6 hours per business.
 */
export async function runAutomation(businessId, { force = false, actor = null } = {}) {
  if (!(await hasFeature(businessId, 'crm_smart'))) return { skipped: 'plan' };
  const s = await getSettings(businessId);
  if (!s.automation.enabled) return { skipped: 'off' };
  const cutoff = new Date(Date.now() - RUN_EVERY);
  const claim = await CrmSettings.findOneAndUpdate(
    force ? { businessId } : { businessId, $or: [{ lastAutoRunAt: null }, { lastAutoRunAt: { $lt: cutoff } }] },
    { $set: { lastAutoRunAt: new Date() } },
    { new: true },
  ).lean().catch(() => null);
  if (!claim) {
    const exists = await CrmSettings.exists({ businessId });
    if (exists) return { skipped: 'recent' };
    try { await CrmSettings.create({ businessId, lastAutoRunAt: new Date() }); } catch { return { skipped: 'recent' }; }
  }

  const biz = await Business.findById(businessId).select('ownerUserId').lean();
  const owner = biz?.ownerUserId;
  const createdBy = actor || owner;
  const eod = new Date(); eod.setHours(18, 0, 0, 0);
  const { rows, M } = await loadCustomers(businessId, null);
  const ownerOf = (r) => r.assignedToUserId || territoryOf(s, r.city)?.userId || owner;
  const docs = [];

  if (s.automation.reorder) {
    const keys = []; const cand = [];
    const wk = Math.floor(Date.now() / (7 * DAY));
    for (const r of rows) {
      const due = reorderOf(M.items.get(String(r._id))).filter((i) => i.due);
      if (!due.length) continue;
      const key = `reorder:${r._id}:${wk}`;
      keys.push(key); cand.push({ r, due, key });
    }
    const open = await usedAutoKeys(businessId, keys);
    for (const { r, due, key } of cand) {
      if (open.has(key)) continue;
      docs.push({
        title: `Re-order call: ${r.shopName || r.name}`, kind: 'call', priority: 'normal', partyId: r._id, autoKey: key,
        note: `Usually buys again now: ${due.slice(0, 4).map((i) => `${i.name} (~${i.avgQty})`).join(', ')}`, assignedToUserId: ownerOf(r),
      });
    }
  }
  if (s.automation.inactivity) {
    const cand = rows.filter((r) => r.bills && (r.segments.includes('at_risk') || (r.segments.includes('inactive') && r.daysSince <= s.inactiveDays * 3)));
    const mo = currentPeriod();
    const keys = cand.map((r) => `inactive:${r._id}:${mo}`);
    const open = await usedAutoKeys(businessId, keys);
    const busy = new Set((await CrmTask.find({ businessId, partyId: { $in: cand.map((r) => r._id) }, status: { $ne: 'done' } }).select('partyId').lean()).map((t) => String(t.partyId)));
    for (const r of cand) {
      if (open.has(`inactive:${r._id}:${mo}`) || busy.has(String(r._id))) continue;
      docs.push({
        title: `Check on ${r.shopName || r.name}`, kind: 'call', priority: r.segments.includes('inactive') ? 'high' : 'normal', partyId: r._id, autoKey: `inactive:${r._id}:${mo}`,
        note: r.avgGapDays ? `Orders every ~${r.avgGapDays} days, none for ${r.daysSince} days` : `No order for ${r.daysSince} days`, assignedToUserId: ownerOf(r),
      });
    }
  }
  let quotes = 0;
  if (s.automation.quotation) {
    {
      const old = await Quotation.find({ businessId, status: 'sent', sentAt: { $lt: new Date(Date.now() - s.quotationFollowUpDays * DAY) } })
        .select('quoteNo partyId leadId customer assignedToUserId createdBy total').limit(200).lean();
      const open = await usedAutoKeys(businessId, old.map((q) => `quote:${q._id}`));
      for (const q of old) {
        if (open.has(`quote:${q._id}`)) continue;
        quotes += 1;
        docs.push({
          title: `Quotation ${q.quoteNo} pending: ${q.customer?.shopName || q.customer?.name || ''}`, kind: 'followup', priority: 'normal',
          partyId: q.partyId || null, leadId: q.leadId || null, autoKey: `quote:${q._id}`,
          note: `Sent ${s.quotationFollowUpDays}+ days ago, no order yet`, assignedToUserId: q.assignedToUserId || q.createdBy || owner,
        });
      }
    }
  }
  if (docs.length) {
    await CrmTask.insertMany(docs.slice(0, 300).map((d) => ({ ...d, businessId, dueAt: eod, source: 'auto', createdBy })));
    const per = new Map();
    for (const d of docs.slice(0, 300)) per.set(String(d.assignedToUserId), (per.get(String(d.assignedToUserId)) || 0) + 1);
    for (const [uid, n] of per) await tellAssignee(businessId, uid, `${n} new follow-up task${n > 1 ? 's' : ''} for you`, '/today');
  }

  let escalated = 0;
  if (s.automation.leadEscalation && owner) {
    const stale = await Lead.find({
      businessId, stage: { $nin: ['won', 'lost'] }, escalatedAt: null,
      createdAt: { $lt: new Date(Date.now() - s.leadNoResponseDays * DAY) },
      $or: [{ lastContactAt: null }, { lastContactAt: { $lt: new Date(Date.now() - s.leadNoResponseDays * DAY) } }],
    }).select('name shopName assignedToUserId').limit(100).lean();
    if (stale.length) {
      const names = await nameMap(stale.map((l) => l.assignedToUserId));
      await notify({
        businessId, userId: owner, type: NOTIFICATION_TYPES.TASK_ASSIGNED,
        title: `${stale.length} lead${stale.length > 1 ? 's' : ''} not contacted for ${s.leadNoResponseDays}+ days`,
        body: stale.slice(0, 3).map((l) => `${l.shopName || l.name} (${names.get(String(l.assignedToUserId)) || 'unassigned'})`).join(', '),
        link: '/crm',
      }).catch(() => {});
      await Lead.updateMany({ _id: { $in: stale.map((l) => l._id) } }, { $set: { escalatedAt: new Date() } });
      escalated = stale.length;
    }
  }
  return { created: Math.min(docs.length, 300), quotes, escalated };
}

/** Fire-and-forget trigger used by busy pages */
export function kickAutomation(businessId) {
  runAutomation(businessId).catch((e) => console.warn('[crm] automation failed:', e.message));
}

/** Background sweep over businesses that use CRM settings */
export async function sweepAutomation() {
  const ids = await CrmSettings.find({ 'automation.enabled': { $ne: false } }).distinct('businessId');
  for (const id of ids) {
    try { await runAutomation(id); } catch (e) { console.warn('[crm] sweep failed:', e.message); }
  }
  return ids.length;
}

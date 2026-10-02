import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { cached, cacheBust } from '../utils/cache.js';
import { PARTY_TYPES, ORDER_STATUS, LEDGER_TYPES, RETURN_TYPES } from '../config/constants.js';
import { userCan } from '../config/permissions.js';
import {
  Party, Invoice, Order, ReturnNote, LedgerEntry, CrmSettings, CrmNote, CrmTask, Complaint, User,
} from '../models/index.js';
import { scopePartiesMatch, isScoped } from '../utils/scope.js';
import {
  hasFeature, assertFeature, isOwner, nameMap, createTask,
} from './crmWork.service.js';
import { istDay } from '../utils/istDay.js';

const DAY = 86400000;
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const daysAgo = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : null);

export const SEGMENTS = ['vip', 'high_value', 'regular', 'new', 'at_risk', 'inactive', 'declining'];
export const PRESET_TAGS = ['VIP', 'Regular', 'New', 'Wholesale', 'Retail', 'Credit hold'];

/* ─────────────────────────────── settings ─────────────────────────────── */

const DEFAULTS = {
  vipAmount: 1000000, highValueAmount: 200000, inactiveDays: 60, newDays: 30,
  quotationFollowUpDays: 3, leadNoResponseDays: 3,
  automation: { enabled: true, reorder: true, inactivity: true, quotation: true, leadEscalation: true },
  leadAssign: { mode: 'none', userIds: [], rules: [], cursor: 0 },
  complaintAssigneeUserId: null, territories: [], lastAutoRunAt: null,
};

export async function getSettings(businessId) {
  const s = await CrmSettings.findOne({ businessId }).lean();
  return { ...DEFAULTS, ...(s || {}), automation: { ...DEFAULTS.automation, ...(s?.automation || {}) }, leadAssign: { ...DEFAULTS.leadAssign, ...(s?.leadAssign || {}) } };
}

function assertManager(user) {
  if (!isOwner(user) && !userCan(user, 'parties:edit')) throw ApiError.forbidden('Only the owner or a manager can change this');
}

export async function saveSettings(businessId, user, body) {
  assertManager(user);
  await assertFeature(businessId, 'crm_basic');
  const staff = new Set((await User.find({ businessId, isActive: { $ne: false } }).distinct('_id')).map(String));
  const set = {};
  for (const k of ['vipAmount', 'highValueAmount', 'inactiveDays', 'newDays', 'quotationFollowUpDays', 'leadNoResponseDays']) {
    if (body[k] !== undefined) set[k] = body[k];
  }
  if (body.automation) {
    await assertFeature(businessId, 'crm_smart');
    for (const [k, v] of Object.entries(body.automation)) set[`automation.${k}`] = Boolean(v);
  }
  if (body.complaintAssigneeUserId !== undefined) {
    if (body.complaintAssigneeUserId && !staff.has(String(body.complaintAssigneeUserId))) throw ApiError.badRequest('Staff not found');
    set.complaintAssigneeUserId = body.complaintAssigneeUserId || null;
  }
  if (body.leadAssign) {
    const { mode = 'none', userIds = [], rules = [] } = body.leadAssign;
    if (mode === 'round_robin') await assertFeature(businessId, 'crm_smart');
    if (mode === 'rules' || rules.length) await assertFeature(businessId, 'crm_pro');
    if ([...userIds, ...rules.map((r) => r.userId)].some((u) => !staff.has(String(u)))) throw ApiError.badRequest('Staff not found');
    set['leadAssign.mode'] = mode;
    set['leadAssign.userIds'] = userIds;
    set['leadAssign.rules'] = rules;
  }
  if (body.territories) {
    await assertFeature(businessId, 'crm_pro');
    if (body.territories.some((t) => t.userId && !staff.has(String(t.userId)))) throw ApiError.badRequest('Staff not found');
    const seen = new Set();
    for (const t of body.territories) {
      for (const c of t.cities) {
        const k = c.trim().toLowerCase();
        if (seen.has(k)) throw ApiError.badRequest(`"${c}" is in more than one territory`);
        seen.add(k);
      }
    }
    set.territories = body.territories.map((t) => ({ ...t, cities: t.cities.map((c) => c.trim()).filter(Boolean) }));
  }
  await CrmSettings.updateOne({ businessId }, { $set: set }, { upsert: true });
  cacheBust(`crmm:${businessId}`);
  return getSettings(businessId);
}

/** Assign retailers to the territory owner by city */
export async function applyTerritories(businessId, user, { overwrite = false } = {}) {
  assertManager(user);
  await assertFeature(businessId, 'crm_pro');
  const s = await getSettings(businessId);
  let updated = 0;
  for (const t of s.territories) {
    if (!t.userId || !t.cities.length) continue;
    const r = await Party.updateMany({
      businessId, type: PARTY_TYPES.RETAILER,
      'address.city': { $in: t.cities.map((c) => new RegExp(`^${esc(c)}$`, 'i')) },
      ...(overwrite ? {} : { assignedToUserId: null }),
    }, { $set: { assignedToUserId: t.userId } });
    updated += r.modifiedCount || 0;
  }
  cacheBust(`crmm:${businessId}`);
  return { updated };
}

export function territoryOf(settings, city) {
  const c = String(city || '').trim().toLowerCase();
  if (!c) return null;
  return settings.territories.find((t) => t.cities.some((x) => x.toLowerCase() === c)) || null;
}

/* ─────────────────────────────── metrics ─────────────────────────────── */

/**
 * Per-customer numbers from bills, orders, returns and payments.
 * Cached 60s per business; any sale/payment busts `crmm:` via cacheBust in callers.
 */
async function rawMetrics(businessId) {
  const bid = oid(businessId);
  const now = Date.now();
  const y1 = new Date(now - 365 * DAY);
  const d180 = new Date(now - 180 * DAY);
  const d360 = new Date(now - 360 * DAY);
  const due30 = new Date(now - 30 * DAY);
  const [inv, lines, ord, ret, pay] = await Promise.all([
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: { $ne: true } } },
      {
        $group: {
          _id: '$partyId',
          total: { $sum: '$grandTotal' },
          bills: { $sum: 1 },
          first: { $min: '$invoiceDate' },
          last: { $max: '$invoiceDate' },
          last365: { $sum: { $cond: [{ $gte: ['$invoiceDate', y1] }, '$grandTotal', 0] } },
          last180: { $sum: { $cond: [{ $gte: ['$invoiceDate', d180] }, '$grandTotal', 0] } },
          prev180: { $sum: { $cond: [{ $and: [{ $lt: ['$invoiceDate', d180] }, { $gte: ['$invoiceDate', d360] }] }, '$grandTotal', 0] } },
          count180: { $sum: { $cond: [{ $gte: ['$invoiceDate', d180] }, 1, 0] } },
          days: { $addToSet: { $cond: [{ $gte: ['$invoiceDate', y1] }, { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate', timezone: '+05:30' } }, null] } },
          overdue: {
            $sum: {
              $cond: [{
                $and: [{ $gt: ['$dueAmount', 0] }, {
                  $cond: [{ $ifNull: ['$dueDate', false] }, { $lt: ['$dueDate', new Date(now)] }, { $lt: ['$invoiceDate', due30] }],
                }],
              }, '$dueAmount', 0],
            },
          },
        },
      },
    ]),
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: { $ne: true }, invoiceDate: { $gte: y1 } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { p: '$partyId', i: '$items.itemId', d: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate', timezone: '+05:30' } } },
          name: { $last: '$items.name' }, qty: { $sum: '$items.qty' }, amount: { $sum: '$items.total' },
        },
      },
      { $group: { _id: { p: '$_id.p', i: '$_id.i' }, name: { $last: '$name' }, days: { $push: '$_id.d' }, qty: { $sum: '$qty' }, amount: { $sum: '$amount' } } },
    ]),
    Order.aggregate([
      { $match: { businessId: bid, status: { $ne: ORDER_STATUS.CANCELLED } } },
      { $group: { _id: '$partyId', orders: { $sum: 1 }, last: { $max: '$createdAt' } } },
    ]),
    ReturnNote.aggregate([
      { $match: { businessId: bid, type: RETURN_TYPES.SALE_RETURN } },
      { $group: { _id: '$partyId', total: { $sum: '$grandTotal' } } },
    ]),
    LedgerEntry.aggregate([
      { $match: { businessId: bid, type: LEDGER_TYPES.PAYMENT_IN } },
      { $group: { _id: '$partyId', last: { $max: '$date' }, total: { $sum: '$credit' } } },
    ]),
  ]);
  const items = new Map();
  for (const l of lines) {
    const k = String(l._id.p);
    if (!items.has(k)) items.set(k, []);
    items.get(k).push({ itemId: String(l._id.i), name: l.name, days: l.days.sort(), qty: l.qty, amount: l.amount });
  }
  const m = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  return { inv: m(inv), items, ord: m(ord), ret: m(ret), pay: m(pay) };
}

const metricsOf = (businessId) => cached(`crmm:${businessId}`, 60000, () => rawMetrics(businessId));
export const bustMetrics = (businessId) => cacheBust(`crmm:${businessId}`);

function avgGap(days) {
  const d = days.filter(Boolean).sort();
  if (d.length < 3) return null;
  const span = (Date.parse(d[d.length - 1]) - Date.parse(d[0])) / DAY;
  return Math.max(1, Math.round(span / (d.length - 1)));
}

/** Items this customer buys on a cycle, with the expected next purchase */
function reorderOf(itemRows = []) {
  const out = [];
  for (const r of itemRows) {
    const gap = avgGap(r.days);
    if (!gap || gap < 3) continue;
    const last = r.days[r.days.length - 1];
    const next = Date.parse(last) + gap * DAY;
    const dueIn = Math.round((next - Date.now()) / DAY);
    out.push({
      itemId: r.itemId, name: r.name, times: r.days.length, avgGapDays: gap,
      avgQty: round2(r.qty / r.days.length), lastAt: last, expectedAt: istDay(next), dueIn,
      due: dueIn <= 3 && dueIn >= -gap,
    });
  }
  return out.sort((a, b) => a.dueIn - b.dueIn);
}

function scoreOf(x, s) {
  if (!x.bills) return { total: 0, parts: { value: 0, frequency: 0, recency: 0, payment: 0, range: 0 } };
  const value = Math.min(30, (30 * Math.log10(1 + x.last365)) / Math.log10(1 + Math.max(s.vipAmount, 1000)));
  const frequency = Math.min(25, (x.count180 * 25) / 12);
  const ds = x.daysSince ?? 999;
  const recency = ds <= 15 ? 20 : ds <= 30 ? 15 : ds <= 60 ? 8 : ds <= 90 ? 3 : 0;
  const payment = x.outstanding <= 0 ? 15 : 15 * (1 - Math.min(1, x.overdue / Math.max(x.outstanding, 1)));
  const range = Math.min(10, (x.distinctItems * 10) / 15);
  const parts = {
    value: Math.round(value), frequency: Math.round(frequency), recency, payment: Math.round(payment), range: Math.round(range),
  };
  return { total: Math.min(100, Object.values(parts).reduce((a, b) => a + b, 0)), parts };
}

function segmentsOf(x, s) {
  const out = [];
  const joinedDays = daysAgo(x.createdAt);
  if (x.last365 >= s.vipAmount) out.push('vip');
  else if (x.last180 >= s.highValueAmount) out.push('high_value');
  if (joinedDays <= s.newDays && x.bills <= 2) out.push('new');
  if (x.bills && x.daysSince >= s.inactiveDays) out.push('inactive');
  else if (!x.bills && joinedDays > s.newDays) out.push('inactive');
  else if (x.avgGapDays && x.daysSince > Math.max(x.avgGapDays * 1.5, x.avgGapDays + 7)) out.push('at_risk');
  if (x.prev180 > 0 && x.last180 < x.prev180 * 0.6 && !out.includes('inactive')) out.push('declining');
  if (!out.length && x.count180 >= 2) out.push('regular');
  return out;
}

function shape(p, M, s, smart) {
  const k = String(p._id);
  const i = M.inv.get(k) || {};
  const o = M.ord.get(k) || {};
  const lastSale = i.last || null;
  const lastOrderAt = [lastSale, o.last].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null;
  const x = {
    _id: p._id, name: p.name, shopName: p.shopName || '', phone: p.phone || '', city: p.address?.city || '',
    gstin: p.gstin || '', status: p.status, tags: p.tags || [], assignedToUserId: p.assignedToUserId || null, createdAt: p.createdAt,
    totalSale: round2(i.total || 0), bills: i.bills || 0, orders: o.orders || 0, lastOrderAt, lastBillAt: lastSale,
    daysSince: daysAgo(lastOrderAt), outstanding: round2(p.balance || 0), overdue: round2(i.overdue || 0),
    returns: round2(M.ret.get(k)?.total || 0), lastPaymentAt: M.pay.get(k)?.last || null,
    last365: round2(i.last365 || 0), last180: round2(i.last180 || 0), prev180: round2(i.prev180 || 0), count180: i.count180 || 0,
    avgGapDays: avgGap(i.days || []), distinctItems: (M.items.get(k) || []).length,
  };
  x.expectedNextAt = x.avgGapDays && lastSale ? new Date(new Date(lastSale).getTime() + x.avgGapDays * DAY) : null;
  x.segments = segmentsOf(x, s);
  if (smart) {
    const sc = scoreOf(x, s);
    x.score = sc.total;
    x.scoreParts = sc.parts;
  } else {
    x.score = null;
  }
  return x;
}

async function loadCustomers(businessId, viewer, extra = {}) {
  const [s, M, smart, parties] = await Promise.all([
    getSettings(businessId),
    metricsOf(businessId),
    hasFeature(businessId, 'crm_smart'),
    Party.find(scopePartiesMatch({ businessId: oid(businessId), type: PARTY_TYPES.RETAILER, isActive: true, ...extra }, viewer))
      .select('name shopName phone address gstin status tags assignedToUserId createdAt balance').lean(),
  ]);
  return { s, M, smart, rows: parties.map((p) => shape(p, M, s, smart)) };
}

/* ─────────────────────────────── customer list ─────────────────────────────── */

const SORTS = {
  sale: (a, b) => b.totalSale - a.totalSale,
  outstanding: (a, b) => b.outstanding - a.outstanding,
  recent: (a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0),
  idle: (a, b) => (b.daysSince ?? 99999) - (a.daysSince ?? 99999),
  score: (a, b) => (b.score ?? 0) - (a.score ?? 0),
  name: (a, b) => (a.shopName || a.name).localeCompare(b.shopName || b.name),
};

export async function listCustomers(businessId, viewer, q) {
  await assertFeature(businessId, 'crm_basic');
  const advanced = q.segment || q.minSale || q.inactiveDays || q.overdue;
  if (advanced) await assertFeature(businessId, 'crm_leads');
  if (q.sort === 'score' || q.minScore) await assertFeature(businessId, 'crm_smart');
  const { rows, smart } = await loadCustomers(businessId, viewer);
  const rx = q.q ? new RegExp(esc(q.q), 'i') : null;
  const city = q.city ? q.city.toLowerCase() : '';
  let list = rows.filter((r) => (!rx || rx.test(`${r.name} ${r.shopName} ${r.phone} ${r.gstin}`))
    && (!city || r.city.toLowerCase() === city)
    && (!q.tag || r.tags.includes(q.tag))
    && (!q.segment || r.segments.includes(q.segment))
    && (!q.minSale || r.totalSale >= q.minSale)
    && (!q.inactiveDays || (r.daysSince ?? 99999) >= q.inactiveDays)
    && (!q.overdue || r.overdue > 0)
    && (!q.minScore || (r.score ?? 0) >= q.minScore)
    && (!q.assigned || (q.assigned === 'none' ? !r.assignedToUserId : String(r.assignedToUserId) === q.assigned)));
  list = list.sort(SORTS[q.sort] || SORTS.sale);
  const names = await nameMap(list.map((r) => r.assignedToUserId));
  const total = list.length;
  const page = q.page || 1;
  const limit = q.limit || 25;
  const segCount = Object.fromEntries(SEGMENTS.map((sg) => [sg, rows.filter((r) => r.segments.includes(sg)).length]));
  return {
    rows: list.slice((page - 1) * limit, page * limit).map((r) => ({ ...r, assignedToName: names.get(String(r.assignedToUserId)) || '' })),
    meta: {
      page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
      cities: [...new Set(rows.map((r) => r.city).filter(Boolean))].sort(),
      tags: [...new Set([...PRESET_TAGS, ...rows.flatMap((r) => r.tags)])],
      segments: segCount,
      totals: { customers: rows.length, sale: round2(rows.reduce((a, r) => a + r.totalSale, 0)), outstanding: round2(rows.reduce((a, r) => a + Math.max(0, r.outstanding), 0)) },
      smart,
    },
  };
}

/* ─────────────────────────────── customer profile ─────────────────────────────── */

async function ownParty(businessId, viewer, id) {
  const p = await Party.findOne(scopePartiesMatch({ _id: oid(id), businessId: oid(businessId), type: PARTY_TYPES.RETAILER }, viewer))
    .select('name shopName phone email address gstin status tags assignedToUserId createdBy createdAt balance creditLimit notes isActive').lean();
  if (!p) throw ApiError.notFound('Customer not found');
  return p;
}

export async function customerProfile(businessId, viewer, id) {
  await assertFeature(businessId, 'crm_basic');
  const p = await ownParty(businessId, viewer, id);
  const [s, M, smart, leadsOn] = await Promise.all([getSettings(businessId), metricsOf(businessId), hasFeature(businessId, 'crm_smart'), hasFeature(businessId, 'crm_leads')]);
  const x = shape(p, M, s, smart);
  if (!leadsOn) x.segments = [];
  const pid = p._id;
  const [ledger, orders, complaints, notes, tasks, items] = await Promise.all([
    LedgerEntry.find({ businessId, partyId: pid }).sort({ date: -1, createdAt: -1 }).limit(60).select('date type debit credit refType refId refNo note').lean(),
    Order.find({ businessId, partyId: pid }).sort({ createdAt: -1 }).limit(30).select('orderNo status itemsTotal itemCount createdAt invoiceId').lean(),
    Complaint.find({ businessId, partyId: pid }).sort({ createdAt: -1 }).limit(30).select('complaintNo subject status priority createdAt resolvedAt').lean(),
    CrmNote.find({ businessId, partyId: pid }).sort({ createdAt: -1 }).limit(50).lean(),
    CrmTask.find({ businessId, partyId: pid }).sort({ status: 1, dueAt: 1 }).limit(50).lean(),
    Invoice.aggregate([
      { $match: { businessId: oid(businessId), partyId: pid, isCancelled: { $ne: true } } },
      { $sort: { invoiceDate: -1 } },
      { $limit: 100 },
      { $unwind: '$items' },
      { $project: { _id: 0, invoiceId: '$_id', invoiceNo: 1, date: '$invoiceDate', itemId: '$items.itemId', name: '$items.name', qty: '$items.qty', unit: '$items.unit', rate: '$items.rate', amount: '$items.total' } },
      { $limit: 200 },
    ]),
  ]);
  const names = await nameMap([p.assignedToUserId, ...tasks.map((t) => t.assignedToUserId), ...complaints.map((c) => c.assignedToUserId)]);

  const byItem = new Map();
  for (const r of M.items.get(String(pid)) || []) byItem.set(r.itemId, r);
  const topItems = [...byItem.values()].sort((a, b) => b.amount - a.amount).slice(0, 10)
    .map((r) => ({ itemId: r.itemId, name: r.name, qty: round2(r.qty), amount: round2(r.amount), times: r.days.length, lastAt: r.days[r.days.length - 1] }));

  const LABEL = { INVOICE: 'Sale', PAYMENT_IN: 'Payment received', PAYMENT_OUT: 'Payment made', SALE_RETURN: 'Return', OPENING: 'Opening balance', ADJUSTMENT: 'Adjustment' };
  const timeline = [
    ...ledger.map((e) => ({ at: e.date, kind: 'ledger', type: e.type, title: `${LABEL[e.type] || e.type}${e.refNo ? ` ${e.refNo}` : ''}`, label: LABEL[e.type] || e.type, refNo: e.refNo || '', amount: round2((e.debit || 0) - (e.credit || 0)), refType: e.refType, refId: e.refId, note: e.note })),
    ...orders.map((o) => ({ at: o.createdAt, kind: 'order', title: `Order ${o.orderNo}`, amount: o.itemsTotal, status: o.status, refId: o._id })),
    ...complaints.map((c) => ({ at: c.createdAt, kind: 'complaint', title: `Complaint ${c.complaintNo}: ${c.subject}`, status: c.status, priority: c.priority, refId: c._id })),
    ...notes.map((n) => ({ at: n.createdAt, kind: n.kind, title: n.text, by: n.byName, nextFollowUpAt: n.nextFollowUpAt })),
    ...tasks.filter((t) => t.status === 'done').map((t) => ({ at: t.doneAt, kind: 'task', title: `Done: ${t.title}`, note: t.doneNote, by: names.get(String(t.doneByUserId)) || '' })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 150);

  return {
    ...x,
    email: p.email || '', address: p.address || {}, creditLimit: p.creditLimit || 0, notes: p.notes || '',
    assignedToName: names.get(String(p.assignedToUserId)) || '',
    territory: territoryOf(s, x.city)?.name || '',
    history: items,
    topItems,
    reorder: smart ? reorderOf(M.items.get(String(pid))) : null,
    timeline,
    openTasks: tasks.filter((t) => t.status !== 'done').map((t) => ({ ...t, assignedToName: names.get(String(t.assignedToUserId)) || '' })),
    complaints: complaints.map((c) => ({ ...c })),
    features: { smart, leads: leadsOn },
  };
}

export async function setTags(businessId, viewer, id, tags) {
  await assertFeature(businessId, 'crm_basic');
  const p = await ownParty(businessId, viewer, id);
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 10);
  await Party.updateOne({ _id: p._id }, { $set: { tags: clean } });
  bustMetrics(businessId);
  return { tags: clean };
}

export async function assignCustomer(businessId, user, id, userId) {
  await assertFeature(businessId, 'crm_assign');
  assertManager(user);
  const p = await ownParty(businessId, user, id);
  if (userId && !(await User.exists({ _id: userId, businessId, isActive: { $ne: false } }))) throw ApiError.badRequest('Staff not found');
  await Party.updateOne({ _id: p._id }, { $set: { assignedToUserId: userId || null } });
  bustMetrics(businessId);
  return { assignedToUserId: userId || null };
}

/** Call / meeting note; a follow-up date turns into a task automatically */
export async function addCustomerNote(businessId, user, id, { kind = 'note', text, nextFollowUpAt = null }) {
  await assertFeature(businessId, 'crm_basic');
  const p = await ownParty(businessId, user, id);
  let taskId = null;
  if (nextFollowUpAt) {
    const handOff = p.assignedToUserId && String(p.assignedToUserId) !== String(user._id)
      && (isOwner(user) || userCan(user, 'parties:edit')) && await hasFeature(businessId, 'crm_assign');
    const task = await createTask(businessId, user, {
      title: `Follow-up: ${p.shopName || p.name}`, note: text, kind: 'followup', dueAt: nextFollowUpAt,
      partyId: p._id, assignedToUserId: handOff ? p.assignedToUserId : user._id,
    });
    taskId = task._id;
  }
  const note = await CrmNote.create({ businessId, partyId: p._id, kind, text, nextFollowUpAt, taskId, byUserId: user._id, byName: user.name });
  return note.toObject();
}

/* ─────────────────────────────── insights ─────────────────────────────── */

/** What needs attention today: re-orders due, customers slipping, big buyers slowing down */
export async function insights(businessId, viewer) {
  await assertFeature(businessId, 'crm_leads');
  const { rows, M, smart } = await loadCustomers(businessId, viewer);
  const segments = Object.fromEntries(SEGMENTS.map((sg) => [sg, rows.filter((r) => r.segments.includes(sg)).length]));
  if (!smart) return { smart, segments };
  const brief = (r) => ({ _id: r._id, name: r.shopName || r.name, phone: r.phone, city: r.city, score: r.score, totalSale: r.totalSale, daysSince: r.daysSince, avgGapDays: r.avgGapDays, outstanding: r.outstanding });
  const reorderDue = [];
  for (const r of rows) {
    const due = reorderOf(M.items.get(String(r._id))).filter((i) => i.due);
    if (due.length) reorderDue.push({ ...brief(r), items: due.slice(0, 5) });
  }
  reorderDue.sort((a, b) => a.items[0].dueIn - b.items[0].dueIn);
  const atRisk = rows.filter((r) => r.segments.includes('at_risk')).sort((a, b) => b.totalSale - a.totalSale).map(brief);
  const decliningHigh = rows.filter((r) => r.segments.includes('declining') && (r.segments.includes('vip') || r.segments.includes('high_value') || r.prev180 >= 50000))
    .sort((a, b) => b.prev180 - a.prev180).map((r) => ({ ...brief(r), last180: r.last180, prev180: r.prev180 }));
  const overdue = rows.filter((r) => r.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 20).map((r) => ({ ...brief(r), overdue: r.overdue }));

  const why = new Map();
  const add = (r, reason) => { const k = String(r._id); if (!why.has(k)) why.set(k, { ...r, reasons: [] }); why.get(k).reasons.push(reason); };
  reorderDue.forEach((r) => add(r, 'reorder'));
  atRisk.forEach((r) => add(r, 'at_risk'));
  decliningHigh.forEach((r) => add(r, 'declining'));
  const recommended = [...why.values()].sort((a, b) => b.reasons.length - a.reasons.length || (b.score ?? 0) - (a.score ?? 0)).slice(0, 25);

  const bands = { hot: 0, good: 0, average: 0, low: 0 };
  for (const r of rows) {
    if (!r.bills) continue;
    if (r.score >= 75) bands.hot += 1; else if (r.score >= 50) bands.good += 1; else if (r.score >= 25) bands.average += 1; else bands.low += 1;
  }
  return {
    smart, segments, scoreBands: bands,
    recommended, reorderDue: reorderDue.slice(0, 50), atRisk: atRisk.slice(0, 50), decliningHigh: decliningHigh.slice(0, 30), overdue,
  };
}

export { loadCustomers, reorderOf, isScoped };

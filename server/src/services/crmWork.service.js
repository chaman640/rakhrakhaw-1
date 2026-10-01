import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { ROLES, PARTY_TYPES, NOTIFICATION_TYPES } from '../config/constants.js';
import { STAFF_ROLES, userCan } from '../config/permissions.js';
import { Lead, CrmTask, Party, User, CrmSettings } from '../models/index.js';
import { LEAD_STAGES } from '../models/Lead.js';
import { isScoped } from '../utils/scope.js';
import { businessHasFeature, featurePlanCode } from './billing.service.js';
import { cheapestPlanFor, featureLimit } from './platform.service.js';
import { rupees } from '../config/billing.js';
import { createParty } from './party.service.js';
import { notify } from './notification.service.js';

/**
 * CRM KA KAAM — leads, pipeline, kaam (task), staff ko kaam dena, Aaj ka kaam.
 *
 * PLAN SE (config/features.js):
 *   crm_basic  (₹50+)  — retailer pe follow-up ka kaam, par khule kaam 20 tak
 *   crm_leads  (₹100+) — leads + pipeline, kaam ki hadd nahi
 *   crm_assign (₹100+) — lead/kaam kisi AUR staff ko dena, team ka hisaab
 *   crm_smart  (₹500+) — score, re-order, auto follow-up, target
 *   crm_pro    (₹2000) — territory, lead rules
 *
 * STAFF KO SIRF APNA: jis staff pe "sirf apna data" (scope: own) laga hai
 * use wahi lead/kaam dikhte hain jo use diye gaye ya usne banaye. Malik ko sab.
 */

const DAY = 86400000;
export const STAGE_PROBABILITY = { new: 10, contacted: 20, interested: 40, quotation: 60, negotiation: 80, won: 100, lost: 0 };
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const oid = (v) => new mongoose.Types.ObjectId(String(v));

export const hasFeature = businessHasFeature;

export async function assertFeature(businessId, key) {
  if (await hasFeature(businessId, key)) return;
  const p = cheapestPlanFor(key);
  throw ApiError.forbidden(
    p ? `Ye ${p.name} (₹${rupees(p.pricePaise)}) ya upar ke plan me hai` : 'Ye abhi band hai',
    { reason: 'feature_locked', feature: key, plan: p ? { code: p.code, name: p.name, priceRupees: rupees(p.pricePaise) } : null },
  );
}

export const isOwner = (u) => (u?.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER;

/** Kisi doc ko badal sakta hai: malik, `parties:edit` wala, ya jiska kaam hai/jisne banaya */
export function canTouch(user, doc) {
  if (isOwner(user) || userCan(user, 'parties:edit')) return true;
  const me = String(user._id);
  return String(doc.assignedToUserId || '') === me || String(doc.createdBy || '') === me;
}

export function mineFilter(user) {
  if (!isScoped(user)) return {};
  return { $or: [{ assignedToUserId: user._id }, { createdBy: user._id }] };
}

/**
 * Kisko diya ja raha hai — wahi dukaan ka, chalu staff hona chahiye. Kisi aur
 * ko dena `crm_assign` (₹100+) ka feature hai; khud ko dena hamesha chalta hai.
 */
async function resolveAssignee(businessId, user, assignedToUserId) {
  if (!assignedToUserId || String(assignedToUserId) === String(user._id)) return user._id;
  await assertFeature(businessId, 'crm_assign');
  if (!isOwner(user) && !userCan(user, 'parties:edit')) {
    throw ApiError.forbidden('Kaam doosre staff ko sirf malik ya manager de sakta hai');
  }
  const target = await User.findOne({
    _id: assignedToUserId, businessId, role: ROLES.WHOLESALER, isActive: { $ne: false },
  }).select('_id name').lean();
  if (!target) throw ApiError.badRequest('Ye staff is dukaan me nahi mila');
  return target._id;
}

export async function nameMap(ids) {
  const list = [...new Set(ids.filter(Boolean).map(String))];
  if (!list.length) return new Map();
  const users = await User.find({ _id: { $in: list } }).select('name').lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

/**
 * Lead routing: rules (city/source/value → staff, ₹2000 plan) or round robin (₹500+).
 * Returns null when no automatic owner applies.
 */
async function routeLead(businessId, body) {
  const settings = await CrmSettings.findOne({ businessId }).lean();
  const mode = settings?.leadAssign?.mode || 'none';
  if (mode === 'none') return null;
  const staff = new Set((await assignableStaff(businessId)).map((u) => String(u._id)));
  if (mode === 'rules' && await hasFeature(businessId, 'crm_pro')) {
    const city = String(body.city || '').trim().toLowerCase();
    const value = Number(body.expectedValue) || 0;
    const hit = (settings.leadAssign.rules || []).find((r) => staff.has(String(r.userId))
      && (!r.city || r.city.toLowerCase() === city)
      && (!r.source || r.source === body.source)
      && value >= (r.minValue || 0));
    if (hit) return hit.userId;
  }
  if (!(await hasFeature(businessId, 'crm_smart'))) return null;
  const pool = (settings.leadAssign.userIds || []).filter((u) => staff.has(String(u)));
  if (!pool.length) return null;
  const upd = await CrmSettings.findOneAndUpdate({ businessId }, { $inc: { 'leadAssign.cursor': 1 } }, { new: true }).lean();
  return pool[(upd.leadAssign.cursor - 1) % pool.length];
}

/* ─────────────────────────────── staff list ─────────────────────────────── */

export async function assignableStaff(businessId) {
  const users = await User.find({ businessId, role: ROLES.WHOLESALER, isActive: { $ne: false } })
    .select('name phone staffRole').sort({ name: 1 }).lean();
  return users.map((u) => ({ _id: u._id, name: u.name, phone: u.phone, staffRole: u.staffRole || 'owner' }));
}

/* ─────────────────────────────── LEADS ─────────────────────────────── */

function shapeLead(l, names) {
  return {
    ...l,
    probability: l.probability ?? STAGE_PROBABILITY[l.stage] ?? 0,
    assignedToName: names.get(String(l.assignedToUserId)) || '',
    noteCount: (l.notes || []).length,
    lastNote: (l.notes || []).slice(-1)[0] || null,
  };
}

export async function listLeads(businessId, user, { stage = '', q = '', assigned = '', page = 1, limit = 50 } = {}) {
  await assertFeature(businessId, 'crm_leads');
  const filter = { businessId, ...mineFilter(user) };
  if (stage === 'open') filter.stage = { $nin: ['won', 'lost'] };
  else if (stage) filter.stage = stage;
  if (assigned) filter.assignedToUserId = assigned === 'none' ? null : assigned;
  if (q) {
    const rx = new RegExp(esc(q), 'i');
    filter.$and = [...(filter.$and || []), { $or: [{ name: rx }, { shopName: rx }, { phone: rx }, { city: rx }] }];
  }
  const [rows, total] = await Promise.all([
    Lead.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Lead.countDocuments(filter),
  ]);
  const names = await nameMap(rows.map((r) => r.assignedToUserId));
  return { rows: rows.map((r) => shapeLead(r, names)), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function pipeline(businessId, user) {
  await assertFeature(businessId, 'crm_leads');
  const match = { businessId: oid(businessId) };
  if (isScoped(user)) match.$or = [{ assignedToUserId: user._id }, { createdBy: user._id }];
  const rows = await Lead.aggregate([
    { $match: match },
    { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$expectedValue' }, weighted: { $sum: { $multiply: ['$expectedValue', { $divide: [{ $ifNull: ['$probability', { $ifNull: [{ $arrayElemAt: [LEAD_STAGES.map((x) => STAGE_PROBABILITY[x]), { $indexOfArray: [LEAD_STAGES, '$stage'] }] }, 0] }] }, 100] }] } } } },
  ]);
  const by = new Map(rows.map((r) => [r._id, r]));
  return LEAD_STAGES.map((s) => ({ stage: s, count: by.get(s)?.count || 0, value: by.get(s)?.value || 0, weighted: Math.round(by.get(s)?.weighted || 0) }));
}

export async function getLead(businessId, user, id) {
  await assertFeature(businessId, 'crm_leads');
  const l = await Lead.findOne({ _id: id, businessId, ...mineFilter(user) }).lean();
  if (!l) throw ApiError.notFound('Lead nahi mila');
  const tasks = await CrmTask.find({ businessId, leadId: l._id }).sort({ dueAt: 1 }).lean();
  const names = await nameMap([l.assignedToUserId, ...tasks.map((t) => t.assignedToUserId)]);
  return { ...shapeLead(l, names), tasks: tasks.map((t) => ({ ...t, assignedToName: names.get(String(t.assignedToUserId)) || '' })) };
}

export async function createLead(businessId, user, body) {
  await assertFeature(businessId, 'crm_leads');
  const routed = body.assignedToUserId === undefined ? await routeLead(businessId, body) : null;
  const assignee = routed || await resolveAssignee(businessId, user, body.assignedToUserId);
  const lead = await Lead.create({
    businessId,
    name: body.name,
    shopName: body.shopName || '',
    phone: body.phone || '',
    city: body.city || '',
    source: body.source || 'other',
    stage: 'new',
    expectedValue: Number(body.expectedValue) || 0,
    probability: body.probability ?? null,
    expectedCloseAt: body.expectedCloseAt || null,
    interest: body.interest || '',
    assignedToUserId: assignee,
    nextFollowUpAt: body.nextFollowUpAt || null,
    notes: body.note ? [{ text: body.note, byUserId: user._id, byName: user.name }] : [],
    createdBy: user._id,
  });
  if (body.nextFollowUpAt) {
    await CrmTask.create({
      businessId, title: `Follow-up: ${lead.shopName || lead.name}`, kind: 'followup',
      dueAt: body.nextFollowUpAt, assignedToUserId: assignee, leadId: lead._id, createdBy: user._id,
    });
  } else if (await hasFeature(businessId, 'crm_smart') && (await CrmSettings.findOne({ businessId }).select('automation').lean())?.automation?.enabled !== false) {
    const due = new Date(Date.now() + DAY); due.setHours(12, 0, 0, 0);
    await CrmTask.create({
      businessId, title: `First call: ${lead.shopName || lead.name}`, kind: 'call', dueAt: due, source: 'auto',
      autoKey: `lead:${lead._id}`, assignedToUserId: assignee, leadId: lead._id, createdBy: user._id,
    });
  }
  if (String(assignee) !== String(user._id)) await tellAssignee(businessId, assignee, `Naya lead: ${lead.shopName || lead.name}`, '/today');
  return getLead(businessId, user, lead._id);
}

export async function updateLead(businessId, user, id, body) {
  await assertFeature(businessId, 'crm_leads');
  const lead = await Lead.findOne({ _id: id, businessId });
  if (!lead) throw ApiError.notFound('Lead nahi mila');
  if (!canTouch(user, lead)) throw ApiError.forbidden('Ye lead aapka nahi hai');

  for (const f of ['name', 'shopName', 'phone', 'city', 'source', 'lostReason', 'interest']) {
    if (body[f] !== undefined) lead[f] = body[f];
  }
  if (body.expectedValue !== undefined) lead.expectedValue = Number(body.expectedValue) || 0;
  if (body.probability !== undefined) lead.probability = body.probability;
  if (body.expectedCloseAt !== undefined) lead.expectedCloseAt = body.expectedCloseAt || null;
  if (body.nextFollowUpAt !== undefined) lead.nextFollowUpAt = body.nextFollowUpAt || null;
  if (body.stage && body.stage !== lead.stage) {
    lead.notes.push({ text: `Stage: ${lead.stage} → ${body.stage}`, byUserId: user._id, byName: user.name });
    lead.stage = body.stage;
    lead.stageChangedAt = new Date();
  }
  if (body.assignedToUserId !== undefined && String(body.assignedToUserId || '') !== String(lead.assignedToUserId || '')) {
    const assignee = await resolveAssignee(businessId, user, body.assignedToUserId);
    lead.assignedToUserId = assignee;
    if (String(assignee) !== String(user._id)) await tellAssignee(businessId, assignee, `Aapko lead diya gaya: ${lead.shopName || lead.name}`, '/today');
  }
  await lead.save();
  return getLead(businessId, user, id);
}

/** Call/meeting ke baad note — aur chahein to agla follow-up kaam bhi usi pal */
export async function addLeadNote(businessId, user, id, { text, kind = 'note', nextFollowUpAt = null }) {
  await assertFeature(businessId, 'crm_leads');
  const lead = await Lead.findOne({ _id: id, businessId });
  if (!lead) throw ApiError.notFound('Lead nahi mila');
  if (!canTouch(user, lead)) throw ApiError.forbidden('Ye lead aapka nahi hai');
  lead.notes.push({ text, kind, byUserId: user._id, byName: user.name });
  if (kind !== 'note') lead.lastContactAt = new Date();
  if (lead.stage === 'new' && ['call', 'meeting', 'visit'].includes(kind)) {
    lead.stage = 'contacted';
    lead.stageChangedAt = new Date();
  }
  if (nextFollowUpAt) {
    lead.nextFollowUpAt = nextFollowUpAt;
    await CrmTask.create({
      businessId, title: `Follow-up: ${lead.shopName || lead.name}`, kind: 'followup', note: text,
      dueAt: nextFollowUpAt, assignedToUserId: lead.assignedToUserId || user._id, leadId: lead._id, createdBy: user._id,
    });
  }
  await lead.save();
  return getLead(businessId, user, id);
}

/** Lead jeeta — usi se retailer (Party) banta hai, naam/phone dobara nahi likhna */
export async function convertLead(businessId, user, id) {
  await assertFeature(businessId, 'crm_leads');
  const lead = await Lead.findOne({ _id: id, businessId });
  if (!lead) throw ApiError.notFound('Lead nahi mila');
  if (!canTouch(user, lead)) throw ApiError.forbidden('Ye lead aapka nahi hai');
  if (lead.partyId) return getLead(businessId, user, id);

  let party = lead.phone
    ? await Party.findOne({ businessId, type: PARTY_TYPES.RETAILER, phone: lead.phone }).select('_id').lean()
    : null;
  if (!party) {
    party = await createParty(businessId, {
      type: PARTY_TYPES.RETAILER,
      name: lead.name,
      shopName: lead.shopName,
      phone: lead.phone,
      address: { city: lead.city },
      assignedToUserId: lead.assignedToUserId || user._id,
    }, user._id);
  }
  lead.partyId = party._id;
  lead.stage = 'won';
  lead.stageChangedAt = new Date();
  lead.notes.push({ text: 'Retailer ban gaya', byUserId: user._id, byName: user.name });
  await lead.save();
  return getLead(businessId, user, id);
}

export async function deleteLead(businessId, user, id) {
  await assertFeature(businessId, 'crm_leads');
  const lead = await Lead.findOne({ _id: id, businessId }).lean();
  if (!lead) throw ApiError.notFound('Lead nahi mila');
  if (!isOwner(user) && !userCan(user, 'parties:delete')) throw ApiError.forbidden('Lead sirf malik mita sakta hai');
  await Promise.all([Lead.deleteOne({ _id: id }), CrmTask.deleteMany({ businessId, leadId: id, status: { $ne: 'done' } })]);
  return { deleted: true };
}

/* ─────────────────────────────── KAAM (tasks) ─────────────────────────────── */

async function shapeTasks(businessId, rows) {
  const names = await nameMap(rows.flatMap((t) => [t.assignedToUserId, t.createdBy]));
  const partyIds = rows.map((t) => t.partyId).filter(Boolean);
  const leadIds = rows.map((t) => t.leadId).filter(Boolean);
  const [parties, leads] = await Promise.all([
    partyIds.length ? Party.find({ _id: { $in: partyIds }, businessId }).select('name shopName phone').lean() : [],
    leadIds.length ? Lead.find({ _id: { $in: leadIds }, businessId }).select('name shopName phone stage').lean() : [],
  ]);
  const pMap = new Map(parties.map((p) => [String(p._id), p]));
  const lMap = new Map(leads.map((l) => [String(l._id), l]));
  const now = Date.now();
  return rows.map((t) => {
    const p = t.partyId ? pMap.get(String(t.partyId)) : null;
    const l = t.leadId ? lMap.get(String(t.leadId)) : null;
    return {
      ...t,
      assignedToName: names.get(String(t.assignedToUserId)) || '',
      createdByName: names.get(String(t.createdBy)) || '',
      party: p ? { _id: p._id, name: p.shopName || p.name, phone: p.phone || '' } : null,
      lead: l ? { _id: l._id, name: l.shopName || l.name, phone: l.phone || '', stage: l.stage } : null,
      overdue: t.status !== 'done' && t.dueAt && new Date(t.dueAt).getTime() < now,
    };
  });
}

export async function listTasks(businessId, user, { status = 'open', assigned = '', partyId = '', leadId = '', page = 1, limit = 50 } = {}) {
  await assertFeature(businessId, 'crm_basic');
  const filter = { businessId, ...mineFilter(user) };
  if (status === 'open') filter.status = { $ne: 'done' };
  else if (status) filter.status = status;
  if (assigned === 'me') filter.assignedToUserId = user._id;
  else if (assigned) filter.assignedToUserId = assigned;
  if (partyId) filter.partyId = partyId;
  if (leadId) filter.leadId = leadId;
  const [rows, total] = await Promise.all([
    CrmTask.find(filter).sort(status === 'done' ? { doneAt: -1 } : { dueAt: 1, createdAt: 1 })
      .skip((page - 1) * limit).limit(limit).lean(),
    CrmTask.countDocuments(filter),
  ]);
  return { rows: await shapeTasks(businessId, rows), meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function createTask(businessId, user, body) {
  await assertFeature(businessId, 'crm_basic');
  if (body.leadId) await assertFeature(businessId, 'crm_leads');

  // Open-task cap for small plans (admin-configurable limit)
  const capPlan = await featurePlanCode(businessId);
  if (capPlan) {
    const cap = featureLimit(capPlan, 'crm_reminders');
    if (cap !== null && await CrmTask.countDocuments({ businessId, status: { $ne: 'done' } }) >= cap) {
      const p = cheapestPlanFor('crm_leads');
      throw ApiError.forbidden(
        `Is plan me ${cap} khule kaam tak — purane poore karein ya ${p?.name || 'bada plan'} lein`,
        { reason: 'feature_locked', feature: 'crm_leads', plan: p ? { code: p.code, name: p.name, priceRupees: rupees(p.pricePaise) } : null },
      );
    }
  }

  if (body.partyId && !(await Party.exists({ _id: body.partyId, businessId }))) throw ApiError.badRequest('Retailer nahi mila');
  if (body.leadId && !(await Lead.exists({ _id: body.leadId, businessId }))) throw ApiError.badRequest('Lead nahi mila');
  const assignee = await resolveAssignee(businessId, user, body.assignedToUserId);

  const task = await CrmTask.create({
    businessId,
    title: body.title,
    note: body.note || '',
    kind: body.kind || 'followup',
    priority: body.priority || 'normal',
    dueAt: body.dueAt || null,
    assignedToUserId: assignee,
    partyId: body.partyId || null,
    leadId: body.leadId || null,
    createdBy: user._id,
  });
  if (String(assignee) !== String(user._id)) await tellAssignee(businessId, assignee, `Naya kaam: ${task.title}`, '/today');
  return (await shapeTasks(businessId, [task.toObject()]))[0];
}

export async function updateTask(businessId, user, id, body) {
  await assertFeature(businessId, 'crm_basic');
  const task = await CrmTask.findOne({ _id: id, businessId });
  if (!task) throw ApiError.notFound('Kaam nahi mila');
  if (!canTouch(user, task)) throw ApiError.forbidden('Ye kaam aapka nahi hai');

  for (const f of ['title', 'note', 'kind', 'priority']) if (body[f] !== undefined) task[f] = body[f];
  if (body.dueAt !== undefined) task.dueAt = body.dueAt || null;
  if (body.status && body.status !== task.status) {
    task.status = body.status;
    if (body.status === 'done') {
      task.doneAt = new Date();
      task.doneByUserId = user._id;
      if (body.doneNote !== undefined) task.doneNote = body.doneNote;
    } else {
      task.doneAt = null;
    }
  }
  if (body.assignedToUserId !== undefined && String(body.assignedToUserId || '') !== String(task.assignedToUserId || '')) {
    task.assignedToUserId = await resolveAssignee(businessId, user, body.assignedToUserId);
    if (String(task.assignedToUserId) !== String(user._id)) await tellAssignee(businessId, task.assignedToUserId, `Aapko kaam diya gaya: ${task.title}`, '/today');
  }
  await task.save();

  /*
    Lead ka kaam poora — lead pe bhi asar:
      - note likha ho to lead ke itihaas me
      - lead ka "agla follow-up" isi kaam ka tha to wo ho gaya (warna "Aaj ka
        kaam" me lead latka rehta)
      - "Naya" lead ab "Baat hui"
  */
  if (body.status === 'done' && task.leadId) {
    const lead = await Lead.findOne({ _id: task.leadId, businessId });
    if (lead) {
      if (body.doneNote) {
        lead.notes.push({ text: `Kaam poora: ${task.title} — ${body.doneNote}`, kind: task.kind === 'visit' ? 'visit' : 'call', byUserId: user._id, byName: user.name });
      }
      if (lead.nextFollowUpAt && (!task.dueAt || lead.nextFollowUpAt <= new Date(task.dueAt.getTime() + 60000))) {
        lead.nextFollowUpAt = null;
      }
      if (lead.stage === 'new') { lead.stage = 'contacted'; lead.stageChangedAt = new Date(); }
      lead.lastContactAt = new Date();
      await lead.save();
    }
  }
  return (await shapeTasks(businessId, [task.toObject()]))[0];
}

export async function deleteTask(businessId, user, id) {
  await assertFeature(businessId, 'crm_basic');
  const task = await CrmTask.findOne({ _id: id, businessId }).lean();
  if (!task) throw ApiError.notFound('Kaam nahi mila');
  if (!isOwner(user) && String(task.createdBy) !== String(user._id)) throw ApiError.forbidden('Ye kaam sirf banane wala ya malik mita sakta hai');
  await CrmTask.deleteOne({ _id: id });
  return { deleted: true };
}

/* ─────────────────────────────── AAJ KA KAAM ─────────────────────────────── */

/**
 * Staff ka pehla page — "aaj kya karna hai".
 *
 * Sirf APNE kaam: jo peeche chhoot gaye (laal), aaj ke, aur agle 7 din ke.
 * Saath me apne leads jinka follow-up aaj ya pehle ka hai.
 */
export async function today(businessId, user) {
  const startTomorrow = new Date(); startTomorrow.setHours(24, 0, 0, 0);
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const week = new Date(startTomorrow.getTime() + 7 * DAY);

  const base = { businessId, assignedToUserId: user._id, status: { $ne: 'done' } };
  const [overdue, dueToday, upcoming, noDate, doneToday] = await Promise.all([
    CrmTask.find({ ...base, dueAt: { $lt: startToday } }).sort({ dueAt: 1 }).limit(50).lean(),
    CrmTask.find({ ...base, dueAt: { $gte: startToday, $lt: startTomorrow } }).sort({ dueAt: 1 }).limit(50).lean(),
    CrmTask.find({ ...base, dueAt: { $gte: startTomorrow, $lt: week } }).sort({ dueAt: 1 }).limit(50).lean(),
    CrmTask.find({ ...base, dueAt: null }).sort({ createdAt: -1 }).limit(20).lean(),
    CrmTask.countDocuments({ businessId, assignedToUserId: user._id, status: 'done', doneAt: { $gte: startToday } }),
  ]);

  const leadsOn = await hasFeature(businessId, 'crm_leads');
  const myLeads = leadsOn
    ? await Lead.find({
      businessId, assignedToUserId: user._id, stage: { $nin: ['won', 'lost'] },
      nextFollowUpAt: { $lt: startTomorrow },
    }).sort({ nextFollowUpAt: 1 }).limit(20).lean()
    : [];

  return {
    overdue: await shapeTasks(businessId, overdue),
    today: await shapeTasks(businessId, dueToday),
    upcoming: await shapeTasks(businessId, upcoming),
    noDate: await shapeTasks(businessId, noDate),
    doneToday,
    leadsToFollow: myLeads.map((l) => ({ _id: l._id, name: l.shopName || l.name, phone: l.phone, stage: l.stage, nextFollowUpAt: l.nextFollowUpAt })),
    leadsOn,
  };
}

/* ─────────────────────────────── khabar ─────────────────────────────── */

export async function tellAssignee(businessId, userId, title, link) {
  try {
    await notify({ businessId, userId, type: NOTIFICATION_TYPES.TASK_ASSIGNED, title, body: 'Aaj ka kaam me dekhein', link });
  } catch { /* khabar na jaye to kaam nahi rukta */ }
}

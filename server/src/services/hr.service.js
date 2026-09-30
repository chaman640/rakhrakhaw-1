import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/constants.js';
import { STAFF_ROLES, STAFF_ROLE_LABEL, userCan } from '../config/permissions.js';
import { rupees } from '../config/billing.js';
import { isFreeMode, subscriptionOf } from './billing.service.js';
import { planHasFeature, cheapestPlanFor } from './platform.service.js';
import { addStaff, updateStaff } from './staff.service.js';
import {
  User, Business, Employee, OrgUnit, Team, Attendance, HrRequest, Payroll, HrLog, Counter, Invoice, CrmTask, Party,
} from '../models/index.js';
import { cacheBust } from '../utils/cache.js';
import { istDay, monthOf, currentPeriod } from '../utils/istDay.js';
import { leaveBalances } from './hrTime.service.js';

export const oid = (v) => new mongoose.Types.ObjectId(String(v));
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isOwner = (u) => (u?.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER;
export const canSalary = (u) => userCan(u, 'payroll:view');

export async function hasFeature(businessId, key) {
  if (isFreeMode()) return true;
  const state = await subscriptionOf(businessId);
  return planHasFeature(state.plan.code, key);
}

export async function assertFeature(businessId, key) {
  if (await hasFeature(businessId, key)) return;
  const p = cheapestPlanFor(key);
  throw ApiError.forbidden(
    p ? `This feature is available on the ${p.name} plan (₹${rupees(p.pricePaise)}) and above` : 'This feature is not available',
    { reason: 'feature_locked', feature: key, plan: p ? { code: p.code, name: p.name, priceRupees: rupees(p.pricePaise) } : null },
  );
}

export async function hrLog(businessId, employeeUserId, actor, action, summary, before = null, after = null) {
  return HrLog.create({
    businessId, employeeUserId, byUserId: actor?._id || null, byName: actor?.name || '', action, summary, before, after,
  });
}

async function nextEmployeeCode(businessId) {
  const doc = await Counter.findOneAndUpdate(
    { businessId, key: 'employee', fy: 'all' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return `EMP-${String(doc.seq).padStart(4, '0')}`;
}

/* ─────────────────────────────── settings ─────────────────────────────── */

export async function hrSettings(businessId) {
  const b = await Business.findById(businessId).select('hr').lean();
  const hr = b?.hr || {};
  return {
    workStart: hr.workStart || '10:00',
    lateAfterMinutes: hr.lateAfterMinutes ?? 15,
    halfDayHours: hr.halfDayHours ?? 4,
    fullDayHours: hr.fullDayHours ?? 8,
    weeklyOff: hr.weeklyOff?.length ? hr.weeklyOff : [0],
    requirePhoto: Boolean(hr.requirePhoto),
    requireLocation: Boolean(hr.requireLocation),
    leaveTypes: (hr.leaveTypes?.length ? hr.leaveTypes : [
      { name: 'Casual Leave', paid: true, yearlyQuota: 12, active: true },
      { name: 'Sick Leave', paid: true, yearlyQuota: 6, active: true },
      { name: 'Unpaid Leave', paid: false, yearlyQuota: 0, active: true },
    ]).map((l) => ({ name: l.name, paid: l.paid !== false, yearlyQuota: l.yearlyQuota || 0, active: l.active !== false })),
  };
}

export async function updateHrSettings(businessId, actor, patch) {
  const before = await hrSettings(businessId);
  const next = { ...before, ...patch };
  if (patch.leaveTypes) {
    const names = new Set();
    for (const l of patch.leaveTypes) {
      const k = l.name.trim().toLowerCase();
      if (names.has(k)) throw ApiError.badRequest(`Leave type "${l.name}" is listed twice`);
      names.add(k);
    }
  }
  await Business.updateOne({ _id: businessId }, { $set: { hr: next } });
  await hrLog(businessId, null, actor, 'settings', 'HR settings updated', before, next);
  return next;
}

/* ─────────────────────────────── org: department / designation ─────────────────────────────── */

export async function listOrg(businessId, kind) {
  const [rows, counts] = await Promise.all([
    OrgUnit.find({ businessId, kind }).sort({ name: 1 }).lean(),
    Employee.aggregate([
      { $match: { businessId: oid(businessId), status: { $ne: 'left' } } },
      { $group: { _id: kind === 'department' ? '$departmentId' : '$designationId', n: { $sum: 1 } } },
    ]),
  ]);
  const n = new Map(counts.map((c) => [String(c._id), c.n]));
  const names = await userNames(rows.map((r) => r.managerUserId));
  return rows.map((r) => ({ ...r, employees: n.get(String(r._id)) || 0, managerName: names.get(String(r.managerUserId)) || '' }));
}

export async function saveOrg(businessId, kind, id, body) {
  const clash = await OrgUnit.findOne({
    businessId, kind, name: new RegExp(`^${esc(body.name)}$`, 'i'), ...(id ? { _id: { $ne: id } } : {}),
  }).lean();
  if (clash) throw ApiError.conflict(`"${body.name}" already exists`);
  if (body.managerUserId) await assertStaff(businessId, body.managerUserId);
  if (!id) return OrgUnit.create({ businessId, kind, ...body });
  const doc = await OrgUnit.findOneAndUpdate({ _id: id, businessId, kind }, { $set: body }, { new: true });
  if (!doc) throw ApiError.notFound('Not found');
  return doc;
}

export async function deleteOrg(businessId, kind, id) {
  const field = kind === 'department' ? 'departmentId' : 'designationId';
  const used = await Employee.countDocuments({ businessId, [field]: id, status: { $ne: 'left' } });
  if (used) throw ApiError.badRequest(`${used} employee(s) are linked to this ${kind}. Move them first or mark it inactive.`);
  const r = await OrgUnit.deleteOne({ _id: id, businessId, kind });
  if (!r.deletedCount) throw ApiError.notFound('Not found');
  return { deleted: true };
}

/* ─────────────────────────────── teams ─────────────────────────────── */

export async function salesByUser(businessId, userIds, start, end) {
  if (!userIds.length) return new Map();
  const parties = await Party.find({ businessId, assignedToUserId: { $in: userIds } }).select('_id assignedToUserId').lean();
  const partyOwner = new Map(parties.map((p) => [String(p._id), String(p.assignedToUserId)]));
  const rows = await Invoice.find({
    businessId,
    isCancelled: { $ne: true },
    invoiceDate: { $gte: start, $lt: end },
    $or: [{ createdBy: { $in: userIds } }, { partyId: { $in: [...partyOwner.keys()].map(oid) } }],
  }).select('grandTotal createdBy partyId').lean();
  const ids = new Set(userIds.map(String));
  const out = new Map();
  for (const inv of rows) {
    const who = partyOwner.get(String(inv.partyId)) || (ids.has(String(inv.createdBy)) ? String(inv.createdBy) : null);
    if (who) out.set(who, (out.get(who) || 0) + (inv.grandTotal || 0));
  }
  return out;
}

export async function listTeams(businessId) {
  const teams = await Team.find({ businessId }).sort({ name: 1 }).lean();
  const all = teams.flatMap((t) => [...t.memberIds, t.leaderUserId]).filter(Boolean);
  const names = await userNames(all);
  const { start, end } = monthOf(currentPeriod());
  const withSales = await hasFeature(businessId, 'hr_advanced');
  const sales = withSales ? await salesByUser(businessId, [...new Set(all.map(String))].map(oid), start, end) : new Map();
  return teams.map((t) => {
    const achieved = t.memberIds.reduce((s, id) => s + (sales.get(String(id)) || 0), 0);
    return {
      ...t,
      leaderName: names.get(String(t.leaderUserId)) || '',
      members: t.memberIds.map((id) => ({ _id: id, name: names.get(String(id)) || '' })),
      achieved: withSales ? Math.round(achieved) : null,
    };
  });
}

export async function saveTeam(businessId, id, body) {
  const ids = [...new Set([...(body.memberIds || []), body.leaderUserId].filter(Boolean).map(String))];
  if (ids.length) {
    const n = await User.countDocuments({ _id: { $in: ids }, businessId, role: ROLES.WHOLESALER });
    if (n !== ids.length) throw ApiError.badRequest('Some selected members do not belong to this business');
  }
  const doc = { ...body };
  if (body.memberIds && body.leaderUserId && !body.memberIds.map(String).includes(String(body.leaderUserId))) {
    doc.memberIds = [...body.memberIds, body.leaderUserId];
  }
  if (!id) return Team.create({ businessId, ...doc });
  const t = await Team.findOneAndUpdate({ _id: id, businessId }, { $set: doc }, { new: true });
  if (!t) throw ApiError.notFound('Team not found');
  return t;
}

export async function deleteTeam(businessId, id) {
  const r = await Team.deleteOne({ _id: id, businessId });
  if (!r.deletedCount) throw ApiError.notFound('Team not found');
  return { deleted: true };
}

/* ─────────────────────────────── employees ─────────────────────────────── */

export async function userNames(ids) {
  const list = [...new Set(ids.filter(Boolean).map(String))];
  if (!list.length) return new Map();
  const users = await User.find({ _id: { $in: list } }).select('name').lean();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

async function assertStaff(businessId, userId) {
  const u = await User.findOne({ _id: userId, businessId, role: ROLES.WHOLESALER }).select('_id name').lean();
  if (!u) throw ApiError.badRequest('This person does not belong to this business');
  return u;
}

/** Staff jinka HR profile abhi nahi bana — unka profile apne aap ban jata hai */
export async function ensureProfiles(businessId) {
  const users = await User.find({ businessId, role: ROLES.WHOLESALER, staffRole: { $nin: [null, STAFF_ROLES.OWNER] } }).select('_id createdAt').lean();
  const have = new Set((await Employee.find({ businessId }).select('userId').lean()).map((e) => String(e.userId)));
  for (const u of users) {
    if (have.has(String(u._id))) continue;
    try {
      await Employee.create({ businessId, userId: u._id, code: await nextEmployeeCode(businessId), joiningDate: u.createdAt });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

function shapeEmployee(e, u, org, viewer) {
  const out = {
    _id: e.userId,
    profileId: e._id,
    code: e.code,
    name: u?.name || '',
    phone: u?.phone || '',
    staffRole: u?.staffRole || STAFF_ROLES.OWNER,
    staffRoleLabel: STAFF_ROLE_LABEL[u?.staffRole || STAFF_ROLES.OWNER],
    loginActive: u?.isActive !== false,
    photoUrl: e.photoUrl,
    email: e.email,
    dob: e.dob,
    gender: e.gender,
    address: e.address,
    emergencyContact: e.emergencyContact,
    joiningDate: e.joiningDate,
    departmentId: e.departmentId,
    designationId: e.designationId,
    department: org.get(String(e.departmentId)) || '',
    designation: org.get(String(e.designationId)) || '',
    reportingManagerId: e.reportingManagerId,
    employmentType: e.employmentType,
    status: e.status,
    leftAt: e.leftAt,
    documents: e.documents || [],
  };
  if (canSalary(viewer)) out.salary = e.salary;
  return out;
}

async function orgNames(businessId) {
  const rows = await OrgUnit.find({ businessId }).select('name').lean();
  return new Map(rows.map((r) => [String(r._id), r.name]));
}

export async function listEmployees(businessId, viewer, { q = '', status = 'active', departmentId = '', designationId = '' } = {}) {
  await ensureProfiles(businessId);
  const filter = { businessId };
  if (status) filter.status = status;
  if (departmentId) filter.departmentId = departmentId;
  if (designationId) filter.designationId = designationId;
  const profiles = await Employee.find(filter).lean();
  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } }).select('name phone staffRole isActive').lean();
  const um = new Map(users.map((u) => [String(u._id), u]));
  const org = await orgNames(businessId);
  const today = istDay();
  const att = await Attendance.find({ businessId, day: today, userId: { $in: profiles.map((p) => p.userId) } }).select('userId status checkIn checkOut').lean();
  const am = new Map(att.map((a) => [String(a.userId), a]));

  const rx = q ? new RegExp(esc(q), 'i') : null;
  return profiles
    .map((e) => {
      const u = um.get(String(e.userId));
      const a = am.get(String(e.userId));
      return {
        ...shapeEmployee(e, u, org, viewer),
        today: a ? { status: a.status, checkIn: a.checkIn?.at || null, checkOut: a.checkOut?.at || null } : null,
      };
    })
    .filter((r) => !rx || rx.test(r.name) || rx.test(r.phone) || rx.test(r.code))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const PROFILE_FIELDS = ['photoUrl', 'email', 'dob', 'gender', 'address', 'emergencyContact', 'joiningDate', 'departmentId', 'designationId', 'reportingManagerId', 'employmentType', 'documents'];

async function checkRefs(businessId, body) {
  for (const [k, kind] of [['departmentId', 'department'], ['designationId', 'designation']]) {
    if (body[k] && !(await OrgUnit.exists({ _id: body[k], businessId, kind }))) throw ApiError.badRequest(`Selected ${kind} not found`);
  }
  if (body.reportingManagerId) await assertStaff(businessId, body.reportingManagerId);
}

export async function createEmployee(businessId, actor, body) {
  await checkRefs(businessId, body);
  if (body.salary && !userCan(actor, 'payroll:create')) throw ApiError.forbidden('You do not have permission to set salary');
  const staff = await addStaff(businessId, {
    name: body.name, phone: body.phone, password: body.password, staffRole: body.staffRole || STAFF_ROLES.EMPLOYEE,
  }, actor);
  const profile = {};
  for (const k of PROFILE_FIELDS) if (body[k] !== undefined) profile[k] = body[k];
  if (body.salary) profile.salary = { ...body.salary, effectiveFrom: body.salary.effectiveFrom || new Date() };
  const e = await Employee.create({ businessId, userId: staff._id, code: await nextEmployeeCode(businessId), ...profile });
  await hrLog(businessId, staff._id, actor, 'created', `Employee ${staff.name} (${e.code}) added`);
  return getEmployee(businessId, actor, staff._id);
}

export async function profileOf(businessId, userId) {
  let e = await Employee.findOne({ businessId, userId });
  if (!e) {
    const u = await assertStaff(businessId, userId);
    try {
      e = await Employee.create({ businessId, userId: u._id, code: await nextEmployeeCode(businessId) });
    } catch (err) {
      if (err.code !== 11000) throw err;
      e = await Employee.findOne({ businessId, userId });
    }
  }
  return e;
}

export async function updateEmployee(businessId, actor, userId, body) {
  const e = await profileOf(businessId, userId);
  const user = await User.findById(userId).select('name phone staffRole isActive');
  if (isOwner(user) && !isOwner(actor) && (body.status || body.staffRole)) {
    throw ApiError.forbidden('The owner\'s status or role cannot be changed');
  }
  await checkRefs(businessId, body);
  if (String(body.reportingManagerId || '') === String(userId)) throw ApiError.badRequest('An employee cannot report to themselves');

  const before = e.toObject();
  for (const k of PROFILE_FIELDS) if (body[k] !== undefined) e[k] = body[k];

  if (body.salary) {
    if (!userCan(actor, 'payroll:create')) throw ApiError.forbidden('You do not have permission to change salary');
    e.salary = { ...(e.salary?.toObject?.() || e.salary || {}), ...body.salary, effectiveFrom: body.salary.effectiveFrom || new Date() };
  }

  const staffPatch = {};
  if (body.name !== undefined && body.name !== user.name) staffPatch.name = body.name;
  if (body.phone !== undefined && body.phone !== user.phone) staffPatch.phone = body.phone;
  if (body.staffRole !== undefined && body.staffRole !== user.staffRole) staffPatch.staffRole = body.staffRole;

  if (body.status && body.status !== e.status) {
    if (String(userId) === String(actor._id)) throw ApiError.badRequest('You cannot change your own status');
    e.status = body.status;
    e.leftAt = body.status === 'left' ? (body.leftAt || new Date()) : null;
    if (!isOwner(user)) staffPatch.isActive = body.status === 'active';
  }
  if (Object.keys(staffPatch).length && !isOwner(user)) await updateStaff(businessId, userId, staffPatch, actor);
  else if (staffPatch.name && isOwner(user)) await User.updateOne({ _id: userId }, { $set: { name: staffPatch.name } });

  await e.save();

  const changed = Object.keys(body).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(e.toObject()[k]) || staffPatch[k] !== undefined);
  if (changed.length) {
    const hideSalary = (o) => { const x = { ...o }; delete x.salary; return x; };
    const pick = (o) => Object.fromEntries(changed.map((k) => [k, o[k] ?? null]));
    const salaryChanged = changed.includes('salary');
    await hrLog(businessId, userId, actor, salaryChanged ? 'salary' : 'updated',
      `${salaryChanged ? 'Salary / ' : ''}Profile updated: ${changed.join(', ')}`,
      pick(salaryChanged ? before : hideSalary(before)), pick(salaryChanged ? e.toObject() : hideSalary(e.toObject())));
  }
  return getEmployee(businessId, actor, userId);
}

export async function getEmployee(businessId, viewer, userId) {
  const e = await profileOf(businessId, userId);
  const u = await User.findById(userId).select('name phone staffRole isActive lastLoginAt').lean();
  const org = await orgNames(businessId);
  const period = currentPeriod();
  const { from, to } = monthOf(period);
  const [att, requests, logs, payrolls, tasks, manager, teams] = await Promise.all([
    Attendance.find({ businessId, userId, day: { $gte: from, $lte: to } }).sort({ day: 1 }).lean(),
    HrRequest.find({ businessId, userId }).sort({ createdAt: -1 }).limit(20).lean(),
    userCan(viewer, 'hr:edit') ? HrLog.find({ businessId, employeeUserId: userId }).sort({ createdAt: -1 }).limit(30).lean() : [],
    canSalary(viewer) ? Payroll.find({ businessId, userId, status: { $ne: 'cancelled' } }).sort({ period: -1 }).limit(12).lean() : [],
    CrmTask.aggregate([
      { $match: { businessId: oid(businessId), assignedToUserId: oid(userId) } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    e.reportingManagerId ? User.findById(e.reportingManagerId).select('name').lean() : null,
    Team.find({ businessId, memberIds: userId }).select('name').lean(),
  ]);
  return {
    ...shapeEmployee(e.toObject(), u, org, viewer),
    lastLoginAt: u?.lastLoginAt || null,
    reportingManagerName: manager?.name || '',
    teams: teams.map((t) => ({ _id: t._id, name: t.name })),
    attendance: { period, days: att, summary: countStatus(att) },
    leaveBalances: await leaveBalances(businessId, userId),
    requests,
    logs,
    payrolls,
    tasks: Object.fromEntries(tasks.map((t) => [t._id, t.n])),
  };
}

export function countStatus(rows) {
  const s = { present: 0, late: 0, half_day: 0, absent: 0, leave: 0, holiday: 0, weekly_off: 0 };
  for (const r of rows) s[r.status] = (s[r.status] || 0) + 1;
  return s;
}

export async function listLogs(businessId, { userId = '', page = 1, limit = 50 } = {}) {
  const filter = { businessId, ...(userId ? { employeeUserId: userId } : {}) };
  const [rows, total] = await Promise.all([
    HrLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    HrLog.countDocuments(filter),
  ]);
  const names = await userNames(rows.map((r) => r.employeeUserId));
  return {
    rows: rows.map((r) => ({ ...r, employeeName: names.get(String(r.employeeUserId)) || '' })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/** Short code employees type with their Employee ID to sign in */
export async function ensureCompanyCode(businessId) {
  const b = await Business.findById(businessId).select('name companyCode').lean();
  if (b?.companyCode) return b.companyCode;
  const base = String(b?.name || 'SHOP').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5).padEnd(3, 'X');
  for (let i = 0; i < 20; i += 1) {
    const code = `${base}${Math.floor(10 + Math.random() * 90)}`;
    try {
      const r = await Business.updateOne({ _id: businessId, companyCode: { $in: [null, undefined] } }, { $set: { companyCode: code } });
      if (r.modifiedCount) return code;
      const again = await Business.findById(businessId).select('companyCode').lean();
      if (again?.companyCode) return again.companyCode;
    } catch (e) { if (e.code !== 11000) throw e; }
  }
  throw ApiError.conflict('Could not create a company code, please retry');
}

/** HR sets a temporary password; the employee must change it at next sign-in */
export async function resetEmployeePassword(businessId, actor, userId, password) {
  const user = await User.findOne({ _id: userId, businessId, role: ROLES.WHOLESALER });
  if (!user) throw ApiError.notFound('Employee not found');
  if (isOwner(user)) throw ApiError.forbidden('The owner password cannot be reset here');
  if (String(user._id) === String(actor._id)) throw ApiError.badRequest('Use Profile → Change password for your own account');
  await user.setPassword(password);
  user.mustChangePassword = true;
  user.sessionSeq = (user.sessionSeq || 0) + 1;
  await user.save();
  cacheBust(`u:${user._id}`);
  await hrLog(businessId, user._id, actor, 'password_reset', `Login password reset for ${user.name}`);
  return { reset: true };
}

export async function hrMeta(businessId) {
  const [departments, designations, staff, settings, companyCode] = await Promise.all([
    OrgUnit.find({ businessId, kind: 'department', active: true }).select('name').sort({ name: 1 }).lean(),
    OrgUnit.find({ businessId, kind: 'designation', active: true }).select('name').sort({ name: 1 }).lean(),
    User.find({ businessId, role: ROLES.WHOLESALER, isActive: { $ne: false } }).select('name staffRole').sort({ name: 1 }).lean(),
    hrSettings(businessId),
    ensureCompanyCode(businessId),
  ]);
  const [teams, adv] = await Promise.all([hasFeature(businessId, 'hr_teams'), hasFeature(businessId, 'hr_advanced')]);
  return {
    departments, designations, staff, settings, companyCode,
    businessName: (await Business.findById(businessId).select('name').lean())?.name || '',
    features: { teams, advanced: adv },
    roles: Object.values(STAFF_ROLES).filter((r) => r !== STAFF_ROLES.OWNER).map((r) => ({ value: r, label: STAFF_ROLE_LABEL[r] })),
  };
}

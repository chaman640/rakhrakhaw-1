import { round2 } from '../utils/money.js';
import { userCan } from '../config/permissions.js';
import {
  User, Employee, Attendance, HrRequest, Payroll, Team, CrmTask, OrgUnit,
} from '../models/index.js';
import { istDay, monthOf, currentPeriod } from '../utils/istDay.js';
import {
  hrSettings, hasFeature, userNames, salesByUser, ensureProfiles, oid,
} from './hr.service.js';
import { dayBoard, monthSheet, leaveBalances } from './hrTime.service.js';
import { payrollTrend, myPayslips } from './payroll.service.js';

const md = (d) => istDay(d).slice(5);

function upcomingDates(emps, field, within = 30) {
  const today = istDay();
  const limit = istDay(new Date(Date.now() + within * 86400000));
  const out = [];
  for (const e of emps) {
    const d = e[field];
    if (!d) continue;
    const y = today.slice(0, 4);
    let next = `${y}-${md(d)}`;
    if (next < today) next = `${Number(y) + 1}-${md(d)}`;
    if (next <= limit) out.push({ userId: e.userId, date: next, years: Number(next.slice(0, 4)) - Number(istDay(d).slice(0, 4)) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function hrDashboard(businessId, viewer) {
  await ensureProfiles(businessId);
  const period = currentPeriod();
  const emps = await Employee.find({ businessId, status: 'active' }).select('userId dob joiningDate departmentId documents').lean();
  const soon = istDay(new Date(Date.now() + 30 * 86400000));
  const [board, pending, depts, payroll, trend] = await Promise.all([
    dayBoard(businessId),
    HrRequest.aggregate([{ $match: { businessId: oid(businessId), status: 'pending' } }, { $group: { _id: '$kind', n: { $sum: 1 } } }]),
    OrgUnit.find({ businessId, kind: 'department' }).select('name').lean(),
    userCan(viewer, 'payroll:view') ? Payroll.aggregate([
      { $match: { businessId: oid(businessId), period, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$status', n: { $sum: 1 }, net: { $sum: '$net' } } },
    ]) : null,
    userCan(viewer, 'payroll:view') ? payrollTrend(businessId, 6) : null,
  ]);
  const names = await userNames(emps.map((e) => e.userId));
  const withName = (rows) => rows.map((r) => ({ ...r, name: names.get(String(r.userId)) || '' }));
  const deptCount = new Map();
  for (const e of emps) deptCount.set(String(e.departmentId || ''), (deptCount.get(String(e.departmentId || '')) || 0) + 1);
  const expiring = [];
  for (const e of emps) {
    for (const d of e.documents || []) {
      if (d.expiry && istDay(d.expiry) <= soon) expiring.push({ userId: e.userId, type: d.type, expiry: d.expiry });
    }
  }
  return {
    today: board.summary,
    weeklyOff: board.weeklyOff,
    lateToday: board.rows.filter((r) => r.status === 'late').map((r) => ({ userId: r.userId, name: r.name, at: r.checkIn?.at })),
    notMarked: board.rows.filter((r) => r.status === 'not_marked').map((r) => ({ userId: r.userId, name: r.name })),
    pending: Object.fromEntries(pending.map((p) => [p._id, p.n])),
    employees: emps.length,
    departments: depts.map((d) => ({ _id: d._id, name: d.name, employees: deptCount.get(String(d._id)) || 0 })),
    unassigned: deptCount.get('') || 0,
    birthdays: withName(upcomingDates(emps, 'dob')),
    anniversaries: withName(upcomingDates(emps, 'joiningDate').filter((a) => a.years > 0)),
    expiringDocuments: withName(expiring),
    payroll: payroll ? { period, byStatus: Object.fromEntries(payroll.map((p) => [p._id, { count: p.n, net: round2(p.net) }])), trend } : null,
  };
}

/** Kaun kitna kaam kar raha hai — sales, target, kaam, attendance */
export async function performance(businessId, { period = currentPeriod(), userId = '' } = {}) {
  const { start, end, from, to } = monthOf(period);
  const filter = { businessId, status: 'active', ...(userId ? { userId } : {}) };
  const emps = await Employee.find(filter).select('userId code salary.monthlyTarget salary.commissionPct').lean();
  const ids = emps.map((e) => e.userId);
  const advanced = await hasFeature(businessId, 'hr_advanced');
  const [names, sales, tasks, att] = await Promise.all([
    userNames(ids),
    advanced ? salesByUser(businessId, ids, start, end) : new Map(),
    CrmTask.aggregate([
      { $match: { businessId: oid(businessId), assignedToUserId: { $in: ids }, $or: [{ dueAt: { $gte: start, $lt: end } }, { doneAt: { $gte: start, $lt: end } }] } },
      { $group: { _id: '$assignedToUserId', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'done'] }, { $lt: ['$dueAt', new Date()] }] }, 1, 0] } } } },
    ]),
    Attendance.aggregate([
      { $match: { businessId: oid(businessId), userId: { $in: ids }, day: { $gte: from, $lte: to } } },
      { $group: { _id: '$userId', present: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, { $cond: [{ $eq: ['$status', 'half_day'] }, 0.5, 0] }] } }, late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } }, marked: { $sum: { $cond: [{ $in: ['$status', ['present', 'late', 'half_day', 'absent']] }, 1, 0] } } } },
    ]),
  ]);
  const tm = new Map(tasks.map((t) => [String(t._id), t]));
  const am = new Map(att.map((a) => [String(a._id), a]));
  return {
    period,
    salesTracked: advanced,
    rows: emps.map((e) => {
      const k = String(e.userId);
      const t = tm.get(k) || { total: 0, done: 0, overdue: 0 };
      const a = am.get(k) || { present: 0, late: 0, marked: 0 };
      const target = e.salary?.monthlyTarget || 0;
      const sold = advanced ? round2(sales.get(k) || 0) : null;
      return {
        userId: e.userId, code: e.code, name: names.get(k) || '',
        sales: sold, target, achievedPct: advanced && target ? Math.round((sold / target) * 100) : null,
        tasks: { total: t.total, done: t.done, overdue: t.overdue },
        attendance: { present: a.present, late: a.late, pct: a.marked ? Math.round((a.present / a.marked) * 100) : null },
      };
    }).sort((x, y) => (y.sales || 0) - (x.sales || 0) || y.tasks.done - x.tasks.done),
  };
}

/* ─────────────────────────────── employee self-service ─────────────────────────────── */

export async function meHome(businessId, user) {
  await ensureProfiles(businessId);
  const today = istDay();
  const [emp, rec, settings, sheet, balances, pendingReq, slips, open, teams] = await Promise.all([
    Employee.findOne({ businessId, userId: user._id }).lean(),
    Attendance.findOne({ businessId, userId: user._id, day: today }).lean(),
    hrSettings(businessId),
    monthSheet(businessId, user._id, currentPeriod()),
    leaveBalances(businessId, user._id),
    HrRequest.countDocuments({ businessId, userId: user._id, status: 'pending' }),
    myPayslips(businessId, user._id),
    CrmTask.countDocuments({ businessId, assignedToUserId: user._id, status: { $ne: 'done' } }),
    Team.find({ businessId, memberIds: user._id }).select('name').lean(),
  ]);
  const [dept, desig] = await Promise.all([
    emp?.departmentId ? OrgUnit.findById(emp.departmentId).select('name').lean() : null,
    emp?.designationId ? OrgUnit.findById(emp.designationId).select('name').lean() : null,
  ]);
  const perf = (await performance(businessId, { userId: user._id })).rows[0] || null;
  return {
    profile: emp ? {
      code: emp.code, photoUrl: emp.photoUrl, status: emp.status, joiningDate: emp.joiningDate,
      department: dept?.name || '', designation: desig?.name || '',
    } : null,
    today: {
      day: today,
      status: rec?.status || null,
      checkIn: rec?.checkIn?.at || null,
      checkOut: rec?.checkOut?.at || null,
      workMinutes: rec?.workMinutes || 0,
    },
    rules: {
      workStart: settings.workStart, requirePhoto: settings.requirePhoto, requireLocation: settings.requireLocation,
    },
    month: sheet.summary,
    leaveBalances: balances,
    pendingRequests: pendingReq,
    openTasks: open,
    lastPayslip: slips[0] || null,
    teams: teams.map((t) => ({ _id: t._id, name: t.name })),
    performance: perf,
  };
}

export async function myTeam(businessId, user) {
  const teams = await Team.find({ businessId, memberIds: user._id }).lean();
  const emp = await Employee.findOne({ businessId, userId: user._id }).select('reportingManagerId').lean();
  const ids = [...teams.flatMap((t) => [...t.memberIds, t.leaderUserId]), emp?.reportingManagerId].filter(Boolean);
  const users = await User.find({ _id: { $in: ids } }).select('name phone').lean();
  const um = new Map(users.map((u) => [String(u._id), u]));
  const who = (id) => (id && um.get(String(id))) || null;
  return {
    manager: who(emp?.reportingManagerId),
    teams: teams.map((t) => ({
      _id: t._id, name: t.name, description: t.description, monthlyTarget: t.monthlyTarget,
      leader: who(t.leaderUserId),
      members: t.memberIds.map(who).filter(Boolean),
    })),
  };
}

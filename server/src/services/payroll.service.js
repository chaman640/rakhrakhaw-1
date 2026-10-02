import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { NOTIFICATION_TYPES } from '../config/constants.js';
import { notify } from './notification.service.js';
import { createExpense } from './expense.service.js';
import {
  Business, Employee, Attendance, Payroll, SalaryAdvance, Expense, Counter,
} from '../models/index.js';
import { istDay, monthOf, weekdayOf, currentPeriod } from '../utils/istDay.js';
import {
  hrSettings, hrLog, hasFeature, userNames, salesByUser, oid,
} from './hr.service.js';

/** Kitne din ki salary banti hai — attendance shuru hone se pehle ke din poore gine jate hain */
export function attendanceDays(emp, recs, days, weeklyOff, today, firstDay) {
  const joined = istDay(emp.joiningDate || emp.createdAt);
  const trackFrom = firstDay || '9999-12-31';
  const left = emp.leftAt ? istDay(emp.leftAt) : '9999-12-31';
  const working = days.filter((d) => !weeklyOff.includes(weekdayOf(d)));
  // Attendance is mahine se pehle shuru ho chuki ho to bina entry wala din gair-haazir hai —
  // warna poore mahine na aane wale ko poori salary ban jati
  const tracked = recs.length > 0 || Boolean(firstDay && firstDay <= days[days.length - 1]);
  const rm = new Map(recs.map((r) => [r.day, r]));
  let paid = 0; let unpaidLeave = 0; let absent = 0;
  for (const d of working) {
    if (d < joined || d > left) continue;
    const r = rm.get(d);
    if (!tracked || d > today || d < trackFrom) { paid += 1; continue; }
    if (!r) { absent += 1; continue; }
    if (r.status === 'present' || r.status === 'late' || r.status === 'holiday') paid += 1;
    else if (r.status === 'half_day') {
      if (r.source === 'leave' && r.leavePaid) paid += 1;
      else { paid += 0.5; if (r.source === 'leave') unpaidLeave += 0.5; else absent += 0.5; }
    } else if (r.status === 'leave') {
      if (r.leavePaid) paid += 1; else unpaidLeave += 1;
    } else if (r.status === 'absent') absent += 1;
    else paid += 1;
  }
  return { workingDays: working.length, paidDays: paid, unpaidLeaveDays: unpaidLeave, absentDays: absent, tracked };
}

function totals(p) {
  p.gross = round2(p.basic + p.allowances + p.commission + p.incentive + p.bonus + p.overtime - p.leaveDeduction);
  p.net = round2(p.gross - p.otherDeduction - p.advanceAdjusted);
  if (p.net < 0) throw ApiError.badRequest('Net salary cannot be negative. Reduce deductions or advance recovery.');
  return p;
}

export async function generatePayroll(businessId, actor, { period, userIds = [] }) {
  if (period > currentPeriod()) throw ApiError.badRequest('Payroll cannot be generated for a future month');
  const settings = await hrSettings(businessId);
  const { from, to, days, start, end } = monthOf(period);
  const filter = {
    businessId, 'salary.basic': { $gt: 0 },
    joiningDate: { $lt: end },
    $or: [{ status: 'active' }, { leftAt: { $gte: start } }],
  };
  if (userIds.length) filter.userId = { $in: userIds };
  const emps = await Employee.find(filter).lean();
  const existing = new Set((await Payroll.find({ businessId, period, status: { $ne: 'cancelled' } }).select('userId').lean()).map((p) => String(p.userId)));
  const todo = emps.filter((e) => !existing.has(String(e.userId)));
  if (!todo.length) {
    return { created: 0, skipped: emps.length, message: emps.length ? 'Payroll already exists for all employees this month' : 'No employees with salary set. Add salary in the employee profile first.' };
  }

  const recs = await Attendance.find({ businessId, day: { $gte: from, $lte: to }, userId: { $in: todo.map((e) => e.userId) } }).lean();
  const byUser = new Map();
  for (const r of recs) { const k = String(r.userId); if (!byUser.has(k)) byUser.set(k, []); byUser.get(k).push(r); }
  const firsts = await Attendance.aggregate([
    { $match: { businessId: oid(businessId), userId: { $in: todo.map((e) => e.userId) } } },
    { $group: { _id: '$userId', day: { $min: '$day' } } },
  ]);
  const firstDay = new Map(firsts.map((f) => [String(f._id), f.day]));
  const advanced = await hasFeature(businessId, 'hr_advanced');
  const sales = advanced ? await salesByUser(businessId, todo.filter((e) => e.salary.commissionPct > 0).map((e) => e.userId), start, end) : new Map();
  const today = istDay();

  let created = 0;
  for (const e of todo) {
    const a = attendanceDays(e, byUser.get(String(e.userId)) || [], days, settings.weeklyOff, today, firstDay.get(String(e.userId)));
    const s = e.salary || {};
    const p = {
      businessId, userId: e.userId, period, ...a,
      basic: 0, allowances: round2(s.allowances || 0), incentive: 0, bonus: 0, overtime: 0,
      commission: 0, commissionSales: 0, leaveDeduction: 0, otherDeduction: 0, advanceAdjusted: 0,
      note: a.tracked ? '' : 'Attendance not recorded this month — full month counted',
    };
    if (s.type === 'daily') {
      p.basic = round2(s.basic * a.paidDays);
    } else {
      p.basic = round2(s.basic);
      const missing = a.workingDays - a.paidDays;
      if (missing > 0 && a.workingDays) p.leaveDeduction = round2(((s.basic + (s.allowances || 0)) / a.workingDays) * missing);
    }
    if (advanced && s.commissionPct > 0) {
      p.commissionSales = round2(sales.get(String(e.userId)) || 0);
      p.commission = round2((p.commissionSales * s.commissionPct) / 100);
    }
    totals(p);

    const advances = await SalaryAdvance.find({ businessId, userId: e.userId, recoveredInPayrollId: null, date: { $lt: end } }).sort({ date: 1 }).lean();
    const take = [];
    for (const adv of advances) {
      if (p.advanceAdjusted + adv.amount > p.net) break;
      p.advanceAdjusted = round2(p.advanceAdjusted + adv.amount);
      take.push(adv._id);
    }
    totals(p);

    const { number } = await Counter.nextNumber({ businessId, key: 'payroll', prefix: 'PAY', date: start });
    const doc = await Payroll.create({ ...p, payrollNo: number });
    if (take.length) await SalaryAdvance.updateMany({ _id: { $in: take } }, { $set: { recoveredInPayrollId: doc._id } });
    created += 1;
  }
  await hrLog(businessId, null, actor, 'payroll_generated', `Payroll generated for ${period}: ${created} employee(s)`);
  return { created, skipped: emps.length - created, message: `Payroll draft created for ${created} employee(s)` };
}

async function findPayroll(businessId, id) {
  const p = await Payroll.findOne({ _id: id, businessId });
  if (!p) throw ApiError.notFound('Payroll not found');
  return p;
}

export async function listPayroll(businessId, { period = currentPeriod(), status = '', userId = '' } = {}) {
  const filter = { businessId, ...(period ? { period } : {}), ...(status ? { status } : { status: { $ne: 'cancelled' } }), ...(userId ? { userId } : {}) };
  const rows = await Payroll.find(filter).sort({ period: -1, createdAt: 1 }).lean();
  const [names, emps] = await Promise.all([
    userNames(rows.map((r) => r.userId)),
    Employee.find({ businessId, userId: { $in: rows.map((r) => r.userId) } }).select('userId code').lean(),
  ]);
  const codes = new Map(emps.map((e) => [String(e.userId), e.code]));
  const sum = (k, st) => round2(rows.filter((r) => !st || r.status === st).reduce((s, r) => s + (r[k] || 0), 0));
  return {
    period,
    rows: rows.map((r) => ({ ...r, name: names.get(String(r.userId)) || '', code: codes.get(String(r.userId)) || '' })),
    totals: {
      count: rows.length, gross: sum('gross'), net: sum('net'),
      draft: rows.filter((r) => r.status === 'draft').length,
      approved: rows.filter((r) => r.status === 'approved').length,
      paid: rows.filter((r) => r.status === 'paid').length,
      paidAmount: sum('net', 'paid'),
    },
  };
}

export async function updatePayroll(businessId, actor, id, body) {
  const p = await findPayroll(businessId, id);
  if (p.status !== 'draft') throw ApiError.badRequest('Only draft payroll can be edited');
  const before = p.toObject();
  for (const k of ['incentive', 'bonus', 'overtime', 'otherDeduction', 'leaveDeduction', 'note']) {
    if (body[k] !== undefined) p[k] = typeof body[k] === 'number' ? round2(body[k]) : body[k];
  }
  totals(p);
  await p.save();
  await hrLog(businessId, p.userId, actor, 'payroll_edited', `Payroll ${p.payrollNo} edited`,
    { gross: before.gross, net: before.net }, { gross: p.gross, net: p.net });
  return p;
}

export async function approvePayroll(businessId, actor, ids) {
  const r = await Payroll.updateMany(
    { businessId, _id: { $in: ids }, status: 'draft' },
    { $set: { status: 'approved', approvedBy: actor._id, approvedAt: new Date() } },
  );
  await hrLog(businessId, null, actor, 'payroll_approved', `${r.modifiedCount} payroll(s) approved`);
  return { approved: r.modifiedCount, message: `${r.modifiedCount} payroll(s) approved` };
}

export async function payPayroll(businessId, actor, id, { mode = 'BANK', date = null }) {
  const p = await findPayroll(businessId, id);
  if (p.status !== 'approved') throw ApiError.badRequest(p.status === 'draft' ? 'Approve the payroll before marking it paid' : `This payroll is already ${p.status}`);
  const claimed = await Payroll.findOneAndUpdate({ _id: p._id, status: 'approved' }, { $set: { status: 'paid', paidAt: date || new Date(), paymentMode: mode } }, { new: true });
  if (!claimed) throw ApiError.conflict('This payroll was just updated. Please refresh.');

  const cost = round2(claimed.gross - claimed.otherDeduction);
  if (cost > 0) {
    try {
      const [name] = (await userNames([claimed.userId])).values();
      const exp = await createExpense(businessId, {
        category: 'salary', amount: cost, mode, date: claimed.paidAt,
        paidTo: name || '', note: `${claimed.payrollNo} · Salary ${claimed.period}`,
      }, actor._id);
      await Expense.updateOne({ _id: exp._id }, { $set: { payrollId: claimed._id } });
      claimed.expenseId = exp._id;
      await claimed.save();
    } catch (err) {
      await Payroll.updateOne({ _id: claimed._id }, { $set: { status: 'approved', paidAt: null, paymentMode: '' } });
      throw err;
    }
  }
  await notify({
    businessId, userId: claimed.userId, type: NOTIFICATION_TYPES.HR_UPDATE,
    title: `Salary for ${claimed.period} has been paid`, body: `Net pay ₹${claimed.net}`, link: '/emp/salary',
  }).catch(() => null);
  await hrLog(businessId, claimed.userId, actor, 'payroll_paid', `Payroll ${claimed.payrollNo} paid (₹${claimed.net}, ${mode})`);
  return claimed;
}

export async function cancelPayroll(businessId, actor, id, reason) {
  const p = await findPayroll(businessId, id);
  if (p.status === 'cancelled') throw ApiError.badRequest('Already cancelled');
  if (p.expenseId) await Expense.deleteOne({ _id: p.expenseId, businessId });
  await SalaryAdvance.updateMany({ businessId, recoveredInPayrollId: p._id }, { $set: { recoveredInPayrollId: null } });
  const wasPaid = p.status === 'paid';
  p.status = 'cancelled';
  p.cancelReason = reason;
  p.expenseId = null;
  await p.save();
  await hrLog(businessId, p.userId, actor, 'payroll_cancelled', `Payroll ${p.payrollNo} cancelled${wasPaid ? ' (salary expense removed)' : ''}: ${reason}`);
  return p;
}

export async function payslip(businessId, id, { userId = null } = {}) {
  const p = await Payroll.findOne({ _id: id, businessId, ...(userId ? { userId, status: { $in: ['approved', 'paid'] } } : {}) }).lean();
  if (!p) throw ApiError.notFound('Payslip not found');
  const [emp, biz, names] = await Promise.all([
    Employee.findOne({ businessId, userId: p.userId }).lean(),
    Business.findById(businessId).select('name address phone gstin logoUrl').lean(),
    userNames([p.userId]),
  ]);
  return {
    ...p,
    employee: { name: names.get(String(p.userId)) || '', code: emp?.code || '', joiningDate: emp?.joiningDate || null, salaryType: emp?.salary?.type || 'monthly' },
    business: biz,
  };
}

export async function myPayslips(businessId, userId) {
  return Payroll.find({ businessId, userId, status: { $in: ['approved', 'paid'] } })
    .select('period payrollNo status gross net paidAt').sort({ period: -1 }).limit(24).lean();
}

/* ─────────────────────────────── advances ─────────────────────────────── */

export async function listAdvances(businessId, { userId = '' } = {}) {
  const rows = await SalaryAdvance.find({ businessId, ...(userId ? { userId } : {}) }).sort({ date: -1 }).limit(200).lean();
  const names = await userNames(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, name: names.get(String(r.userId)) || '', recovered: Boolean(r.recoveredInPayrollId) }));
}

export async function createAdvance(businessId, actor, body) {
  const emp = await Employee.findOne({ businessId, userId: body.userId }).lean();
  if (!emp) throw ApiError.notFound('Employee not found');
  const doc = await SalaryAdvance.create({ businessId, ...body, createdBy: actor._id });
  await hrLog(businessId, body.userId, actor, 'advance', `Salary advance ₹${body.amount} given`);
  return doc;
}

export async function deleteAdvance(businessId, actor, id) {
  const a = await SalaryAdvance.findOne({ _id: id, businessId });
  if (!a) throw ApiError.notFound('Advance not found');
  if (a.recoveredInPayrollId) throw ApiError.badRequest('This advance is already adjusted in a payroll. Cancel that payroll first.');
  await a.deleteOne();
  await hrLog(businessId, a.userId, actor, 'advance_deleted', `Salary advance ₹${a.amount} removed`);
  return { deleted: true };
}

export async function payrollTrend(businessId, months = 6) {
  const rows = await Payroll.aggregate([
    { $match: { businessId: oid(businessId), status: 'paid' } },
    { $group: { _id: '$period', gross: { $sum: '$gross' }, net: { $sum: '$net' }, n: { $sum: 1 } } },
    { $sort: { _id: -1 } }, { $limit: months },
  ]);
  return rows.reverse().map((r) => ({ period: r._id, gross: round2(r.gross), net: round2(r.net), employees: r.n }));
}

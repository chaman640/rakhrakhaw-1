import { Router } from 'express';
import { z } from 'zod';
import { requireFeature } from '../middleware/feature.js';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { ROLES } from '../config/constants.js';
import { STAFF_ROLES, userCan } from '../config/permissions.js';
import { ATTENDANCE_STATUS } from '../models/Attendance.js';
import { Employee } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { saveImage } from '../utils/storage.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as hr from '../services/hr.service.js';
import * as time from '../services/hrTime.service.js';
import * as pay from '../services/payroll.service.js';
import * as dash from '../services/hrDash.service.js';
import * as work from '../services/crmWork.service.js';
import { currentPeriod } from '../utils/istDay.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller, requireFeature('hr_basic'));

const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const idP = z.object({ id: oid });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Invalid month').optional().default(() => currentPeriod());
const money = z.coerce.number().min(0).max(1e8);
const page = z.coerce.number().int().min(1).max(1000).optional().default(1);
const h = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req)));
const hm = (msg, fn) => asyncHandler(async (req, res) => ok(res, await fn(req), msg));
const list = (fn) => asyncHandler(async (req, res) => {
  const { rows, meta } = await fn(req);
  return res.json({ success: true, message: 'OK', data: rows, meta });
});
const photo = [uploadImage.single('photo'), handleUploadError];

/* ─────────────────────────────── employee self-service ─────────────────────────────── */

const punch = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
const selfProfile = z.object({
  email: z.string().trim().email().max(120).or(z.literal('')).optional(),
  dob: z.coerce.date().nullable().optional(),
  gender: z.enum(['', 'male', 'female', 'other']).optional(),
  address: z.string().trim().max(300).optional(),
  emergencyContact: z.object({ name: z.string().trim().max(80), phone: z.string().trim().max(20) }).optional(),
});

router.get('/me', h((req) => dash.meHome(req.businessId, req.user)));
router.get('/me/attendance', validate({ query: z.object({ period }) }), h((req) => time.monthSheet(req.businessId, req.user._id, req.query.period)));
router.post('/me/check-in', ...photo, validate({ body: punch }), asyncHandler(async (req, res) => {
  const r = await time.checkIn(req.businessId, req.user, req.body, req.file);
  return ok(res, r, r.message);
}));
router.post('/me/check-out', ...photo, validate({ body: punch }), asyncHandler(async (req, res) => {
  const r = await time.checkOut(req.businessId, req.user, req.body, req.file);
  return ok(res, r, r.message);
}));

const requestBody = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('leave'), leaveType: z.string().trim().min(1).max(40), from: day, to: day, halfDay: z.boolean().optional().default(false), reason: z.string().trim().min(3, 'Please give a reason').max(1000) }),
  z.object({ kind: z.literal('correction'), day, wantStatus: z.enum(['present', 'late', 'half_day']), reason: z.string().trim().min(3, 'Please give a reason').max(1000) }),
  z.object({ kind: z.literal('help'), category: z.enum(['salary', 'attendance', 'leave', 'document', 'other']).optional().default('other'), subject: z.string().trim().min(3).max(160), reason: z.string().trim().max(1000).optional().default('') }),
]);
router.get('/me/requests', validate({ query: z.object({ kind: z.enum(['', 'leave', 'correction', 'help']).optional().default('') }) }),
  h((req) => time.myRequests(req.businessId, req.user, req.query)));
router.post('/me/requests', validate({ body: requestBody }), asyncHandler(async (req, res) => created(res, await time.createRequest(req.businessId, req.user, req.body), 'Request submitted')));
router.post('/me/requests/:id/cancel', validate({ params: idP }), hm('Request cancelled', (req) => time.cancelRequest(req.businessId, req.user, req.params.id)));
router.post('/me/requests/:id/messages', validate({ params: idP, body: z.object({ text: z.string().trim().min(1).max(1000) }) }),
  h((req) => time.addMessage(req.businessId, req.user, req.params.id, req.body.text)));
router.get('/me/leave-balances', h((req) => time.leaveBalances(req.businessId, req.user._id)));
router.get('/me/payslips', h((req) => pay.myPayslips(req.businessId, req.user._id)));
router.get('/me/payslips/:id', validate({ params: idP }), h((req) => pay.payslip(req.businessId, req.params.id, { userId: req.user._id })));
router.get('/me/tasks', h((req) => work.today(req.businessId, req.user)));
router.put('/me/tasks/:id', validate({ params: idP, body: z.object({ status: z.enum(['pending', 'in_progress', 'done']), doneNote: z.string().trim().max(1000).optional() }) }),
  h((req) => work.updateTask(req.businessId, req.user, req.params.id, req.body)));
router.get('/me/team', h((req) => dash.myTeam(req.businessId, req.user)));
router.get('/me/performance', validate({ query: z.object({ period }) }),
  h(async (req) => (await dash.performance(req.businessId, { period: req.query.period, userId: req.user._id })).rows[0] || null));
router.get('/me/profile', h(async (req) => {
  const p = await hr.getEmployee(req.businessId, req.user, req.user._id);
  const e = await Employee.findOne({ businessId: req.businessId, userId: req.user._id }).select('salary').lean();
  return { ...p, salary: e?.salary || null, logs: undefined, payrolls: undefined };
}));
router.put('/me/profile', validate({ body: selfProfile }), hm('Profile updated', async (req) => {
  await Employee.updateOne({ businessId: req.businessId, userId: req.user._id }, { $set: req.body });
  return { updated: true };
}));
router.post('/me/photo', ...photo, hm('Photo updated', async (req) => {
  if (!req.file) throw ApiError.badRequest('No image received');
  const { url } = await saveImage(req.file, 'employees');
  await Employee.updateOne({ businessId: req.businessId, userId: req.user._id }, { $set: { photoUrl: url } });
  return { photoUrl: url };
}));

/* ─────────────────────────────── HR: employees ─────────────────────────────── */

const salary = z.object({
  type: z.enum(['monthly', 'daily']).optional().default('monthly'),
  basic: money,
  allowances: money.optional().default(0),
  commissionPct: z.coerce.number().min(0).max(100).optional().default(0),
  monthlyTarget: money.optional().default(0),
  effectiveFrom: z.coerce.date().nullable().optional(),
});
const profile = selfProfile.extend({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(10).max(15).optional(),
  staffRole: z.enum(Object.values(STAFF_ROLES).filter((r) => r !== STAFF_ROLES.OWNER)).optional(),
  joiningDate: z.coerce.date().optional(),
  departmentId: oid.nullable().optional(),
  designationId: oid.nullable().optional(),
  reportingManagerId: oid.nullable().optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  documents: z.array(z.object({ type: z.string().trim().min(1).max(40), number: z.string().trim().max(60).optional().default(''), expiry: z.coerce.date().nullable().optional() })).max(20).optional(),
  salary: salary.optional(),
});

router.get('/meta', requirePermission('hr:view', 'payroll:view'), h((req) => hr.hrMeta(req.businessId)));
router.get('/dashboard', requirePermission('hr:view'), h((req) => dash.hrDashboard(req.businessId, req.user)));
router.get('/employees', requirePermission('hr:view', 'payroll:view'), validate({
  query: z.object({
    q: z.string().trim().max(60).optional().default(''),
    status: z.enum(['', 'active', 'inactive', 'left']).optional().default('active'),
    departmentId: z.string().trim().max(24).optional().default(''),
    designationId: z.string().trim().max(24).optional().default(''),
  }),
}), h((req) => hr.listEmployees(req.businessId, req.user, req.query)));
router.post('/employees', requirePermission('hr:create'), validate({
  body: profile.extend({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(10).max(15),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  }),
}), asyncHandler(async (req, res) => created(res, await hr.createEmployee(req.businessId, req.user, req.body), 'Employee added')));
router.get('/employees/:id', requirePermission('hr:view', 'payroll:view'), validate({ params: idP }), h((req) => hr.getEmployee(req.businessId, req.user, req.params.id)));
router.put('/employees/:id', requirePermission('hr:edit', 'payroll:create'), validate({
  params: idP,
  body: profile.extend({ status: z.enum(['active', 'inactive', 'left']).optional(), leftAt: z.coerce.date().optional() }),
}), hm('Employee updated', (req) => {
  if (!userCan(req.user, 'hr:edit') && Object.keys(req.body).some((k) => k !== 'salary')) {
    throw ApiError.forbidden('You can only change salary details');
  }
  return hr.updateEmployee(req.businessId, req.user, req.params.id, req.body);
}));
router.post('/employees/:id/photo', requirePermission('hr:edit'), validate({ params: idP }), ...photo, hm('Photo updated', async (req) => {
  if (!req.file) throw ApiError.badRequest('No image received');
  const { url } = await saveImage(req.file, 'employees');
  const r = await Employee.updateOne({ businessId: req.businessId, userId: req.params.id }, { $set: { photoUrl: url } });
  if (!r.matchedCount) throw ApiError.notFound('Employee not found');
  return { photoUrl: url };
}));
router.get('/employees/:id/attendance', requirePermission('hr:view'), validate({ params: idP, query: z.object({ period }) }),
  h((req) => time.monthSheet(req.businessId, req.params.id, req.query.period)));

/* ─────────────────────────────── HR: org & teams ─────────────────────────────── */

const kindP = z.object({ kind: z.enum(['department', 'designation']) });
const orgBody = z.object({ name: z.string().trim().min(2).max(80), managerUserId: oid.nullable().optional(), active: z.boolean().optional() });
router.get('/org/:kind', requirePermission('hr:view'), validate({ params: kindP }), h((req) => hr.listOrg(req.businessId, req.params.kind)));
router.post('/org/:kind', requirePermission('hr:edit'), validate({ params: kindP, body: orgBody }),
  asyncHandler(async (req, res) => created(res, await hr.saveOrg(req.businessId, req.params.kind, null, req.body), 'Saved')));
router.put('/org/:kind/:id', requirePermission('hr:edit'), validate({ params: kindP.extend({ id: oid }), body: orgBody.partial().extend({ name: z.string().trim().min(2).max(80) }) }),
  hm('Saved', (req) => hr.saveOrg(req.businessId, req.params.kind, req.params.id, req.body)));
router.delete('/org/:kind/:id', requirePermission('hr:edit'), validate({ params: kindP.extend({ id: oid }) }),
  hm('Deleted', (req) => hr.deleteOrg(req.businessId, req.params.kind, req.params.id)));

const teamBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().default(''),
  leaderUserId: oid.nullable().optional(),
  memberIds: z.array(oid).max(200).optional().default([]),
  monthlyTarget: money.optional().default(0),
  active: z.boolean().optional(),
});
router.get('/teams', requirePermission('hr:view'), requireFeature('hr_teams'), h((req) => hr.listTeams(req.businessId)));
router.post('/teams', requirePermission('hr:edit'), requireFeature('hr_teams'), validate({ body: teamBody }),
  asyncHandler(async (req, res) => created(res, await hr.saveTeam(req.businessId, null, req.body), 'Team created')));
router.put('/teams/:id', requirePermission('hr:edit'), requireFeature('hr_teams'), validate({ params: idP, body: teamBody }),
  hm('Team updated', (req) => hr.saveTeam(req.businessId, req.params.id, req.body)));
router.delete('/teams/:id', requirePermission('hr:edit'), requireFeature('hr_teams'), validate({ params: idP }),
  hm('Team deleted', (req) => hr.deleteTeam(req.businessId, req.params.id)));

/* ─────────────────────────────── HR: settings ─────────────────────────────── */

router.get('/settings', requirePermission('hr:view'), h((req) => hr.hrSettings(req.businessId)));
router.put('/settings', requirePermission('hr:edit'), validate({
  body: z.object({
    workStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format').optional(),
    lateAfterMinutes: z.coerce.number().int().min(0).max(240).optional(),
    halfDayHours: z.coerce.number().min(1).max(12).optional(),
    fullDayHours: z.coerce.number().min(1).max(16).optional(),
    weeklyOff: z.array(z.number().int().min(0).max(6)).max(6).optional(),
    requirePhoto: z.boolean().optional(),
    requireLocation: z.boolean().optional(),
    leaveTypes: z.array(z.object({
      name: z.string().trim().min(2).max(40),
      paid: z.boolean(),
      yearlyQuota: z.coerce.number().min(0).max(365),
      active: z.boolean().optional().default(true),
    })).min(1).max(15).optional(),
  }),
}), hm('HR settings saved', (req) => hr.updateHrSettings(req.businessId, req.user, req.body)));

/* ─────────────────────────────── HR: attendance & requests ─────────────────────────────── */

router.get('/attendance', requirePermission('hr:view'), validate({ query: z.object({ day: day.optional() }) }),
  h((req) => time.dayBoard(req.businessId, req.query.day)));
router.post('/attendance', requirePermission('hr:edit'), validate({
  body: z.object({
    userId: oid,
    day,
    status: z.enum(ATTENDANCE_STATUS),
    note: z.string().trim().max(300).optional().default(''),
    checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal('')).optional(),
    checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).or(z.literal('')).optional(),
  }),
}), hm('Attendance saved', (req) => time.markAttendance(req.businessId, req.user, req.body)));
router.get('/attendance/report', requirePermission('hr:view'), requireFeature('hr_teams'), validate({ query: z.object({ period }) }),
  h((req) => time.attendanceReport(req.businessId, req.query.period)));

router.get('/requests', requirePermission('hr:view'), validate({
  query: z.object({
    kind: z.enum(['', 'leave', 'correction', 'help']).optional().default(''),
    status: z.enum(['', 'pending', 'approved', 'rejected', 'cancelled', 'closed']).optional().default('pending'),
    userId: z.string().trim().max(24).optional().default(''),
    page,
  }),
}), list((req) => time.listRequests(req.businessId, req.user, req.query)));
router.post('/requests/:id/review', requirePermission('hr:approve'), validate({
  params: idP,
  body: z.object({ action: z.enum(['approve', 'reject', 'close']), note: z.string().trim().max(500).optional().default('') }),
}), asyncHandler(async (req, res) => {
  const r = await time.reviewRequest(req.businessId, req.user, req.params.id, req.body);
  return ok(res, r, `Request ${r.status}`);
}));
router.post('/requests/:id/messages', requirePermission('hr:view'), validate({ params: idP, body: z.object({ text: z.string().trim().min(1).max(1000) }) }),
  h((req) => time.addMessage(req.businessId, req.user, req.params.id, req.body.text, { asStaff: true })));

router.get('/performance', requirePermission('hr:view'), validate({ query: z.object({ period }) }),
  h((req) => dash.performance(req.businessId, { period: req.query.period })));
router.get('/logs', requirePermission('hr:edit'), validate({ query: z.object({ userId: z.string().trim().max(24).optional().default(''), page }) }),
  list((req) => hr.listLogs(req.businessId, req.query)));

/* ─────────────────────────────── payroll ─────────────────────────────── */

router.get('/payroll', requirePermission('payroll:view'), validate({
  query: z.object({ period, status: z.enum(['', 'draft', 'approved', 'paid', 'cancelled']).optional().default(''), userId: z.string().trim().max(24).optional().default('') }),
}), h((req) => pay.listPayroll(req.businessId, req.query)));
router.post('/payroll/generate', requirePermission('payroll:create'), validate({ body: z.object({ period, userIds: z.array(oid).max(500).optional().default([]) }) }),
  asyncHandler(async (req, res) => {
    const r = await pay.generatePayroll(req.businessId, req.user, req.body);
    return ok(res, r, r.message);
  }));
router.post('/payroll/approve', requirePermission('payroll:approve'), validate({ body: z.object({ ids: z.array(oid).min(1).max(500) }) }),
  asyncHandler(async (req, res) => {
    const r = await pay.approvePayroll(req.businessId, req.user, req.body.ids);
    return ok(res, r, r.message);
  }));
router.get('/payroll/advances', requirePermission('payroll:view'), validate({ query: z.object({ userId: z.string().trim().max(24).optional().default('') }) }),
  h((req) => pay.listAdvances(req.businessId, req.query)));
router.post('/payroll/advances', requirePermission('payroll:create'), validate({
  body: z.object({
    userId: oid,
    amount: z.coerce.number().min(1).max(1e7),
    date: z.coerce.date().optional(),
    mode: z.enum(['CASH', 'UPI', 'BANK', 'CHEQUE']).optional().default('CASH'),
    note: z.string().trim().max(300).optional().default(''),
  }),
}), asyncHandler(async (req, res) => created(res, await pay.createAdvance(req.businessId, req.user, req.body), 'Advance recorded')));
router.delete('/payroll/advances/:id', requirePermission('payroll:create'), validate({ params: idP }),
  hm('Advance removed', (req) => pay.deleteAdvance(req.businessId, req.user, req.params.id)));
router.get('/payroll/trend', requirePermission('payroll:view'), h((req) => pay.payrollTrend(req.businessId, 12)));
router.put('/payroll/:id', requirePermission('payroll:create'), validate({
  params: idP,
  body: z.object({
    incentive: money.optional(), bonus: money.optional(), overtime: money.optional(),
    otherDeduction: money.optional(), leaveDeduction: money.optional(), note: z.string().trim().max(500).optional(),
  }),
}), hm('Payroll updated', (req) => pay.updatePayroll(req.businessId, req.user, req.params.id, req.body)));
router.post('/payroll/:id/pay', requirePermission('payroll:approve'), validate({
  params: idP,
  body: z.object({ mode: z.enum(['CASH', 'UPI', 'BANK', 'CHEQUE']).optional().default('BANK'), date: z.coerce.date().optional() }),
}), hm('Salary marked as paid', (req) => pay.payPayroll(req.businessId, req.user, req.params.id, req.body)));
router.post('/payroll/:id/cancel', requirePermission('payroll:approve'), validate({
  params: idP, body: z.object({ reason: z.string().trim().min(3, 'Please give a reason').max(200) }),
}), hm('Payroll cancelled', (req) => pay.cancelPayroll(req.businessId, req.user, req.params.id, req.body.reason)));
router.get('/payroll/:id/payslip', requirePermission('payroll:view'), validate({ params: idP }), h((req) => pay.payslip(req.businessId, req.params.id)));

export default router;

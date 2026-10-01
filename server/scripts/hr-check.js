/**
 * HR + Employee App ki jaanch — employee, attendance, chhutti, payroll, rok-tok.
 *
 *   MONGO_URI=... npm run hr:check --prefix server
 *
 * Test DB pe chalayein; production me mana karta hai.
 */
process.env.BILLING_MODE = 'paid';
process.env.RATE_LIMIT_PER_MIN = '100000';
process.env.RAZORPAY_KEY_ID ||= 'rzp_test_hr';
process.env.RAZORPAY_KEY_SECRET ||= 'hr_secret';
process.env.RAZORPAY_WEBHOOK_SECRET ||= 'hr_webhook';

const mongoose = (await import('mongoose')).default;
const jwt = (await import('jsonwebtoken')).default;
const { env } = await import('../src/config/env.js');
if (env.isProd) { console.error('Not for production'); process.exit(1); }

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { loadPlatformConfig } = await import('../src/services/platform.service.js');
const { istDay } = await import('../src/utils/istDay.js');
const M = await import('../src/models/index.js');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`${G}  ✔${N} ${name}`); } else { failed++; console.log(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
};
const step = (s) => console.log(`\n${Y}${s}${N}`);

const PORT = 5989;
const BASE = `http://localhost:${PORT}/api`;
const PH = { owner: '9400000001', emp: '9400000002', hr: '9400000003', viewer: '9400000004', emp2: '9400000005' };
const otp = (phone) => jwt.sign({ phone, purpose: 'SIGNUP', otp: true }, env.jwtSecret, { expiresIn: '15m' });

async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, ...json };
}
const login = async (phone, password = 'hr123456') => (await call('POST', '/auth/login', { body: { phone, password } })).data?.token;

const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
function nextWeekday(from, weekday) {
  let d = addDays(from, 1);
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== weekday) d = addDays(d, 1);
  return d;
}

async function cleanup() {
  const users = await M.User.find({ phone: { $in: Object.values(PH) } }).select('businessId').lean();
  const b = { businessId: { $in: users.map((u) => u.businessId).filter(Boolean) } };
  await Promise.all([
    M.User.deleteMany({ $or: [{ phone: { $in: Object.values(PH) } }, b] }),
    M.Business.deleteMany({ _id: b.businessId }),
    ...['Subscription', 'Counter', 'Notification', 'Employee', 'OrgUnit', 'Team', 'Attendance', 'HrRequest', 'Payroll', 'SalaryAdvance', 'Expense', 'CrmTask', 'Party', 'Invoice']
      .map((m) => M[m].deleteMany(b)),
  ]);
}

async function run() {
  await connectDB();
  await loadPlatformConfig();
  await cleanup();
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));
  const today = istDay();

  try {
    step('1. Owner, org structure');
    let r = await call('POST', '/auth/wholesaler/signup', {
      body: { name: 'HR Owner', phone: PH.owner, password: 'hr123456', businessName: 'HR Test Traders', otpToken: otp(PH.owner), planCode: 'BADI' },
    });
    const oTok = r.data?.token;
    const bizId = r.data?.business?._id;
    check('owner signed up (BADI trial)', Boolean(oTok), r.message);

    r = await call('GET', '/hr/meta', { token: oTok });
    check('meta: default leave types + features', r.data?.settings?.leaveTypes?.length === 3 && r.data?.features?.teams && r.data?.features?.advanced, JSON.stringify(r.data?.features));
    r = await call('POST', '/hr/org/department', { token: oTok, body: { name: 'Sales' } });
    const deptId = r.data?._id;
    check('department created', r.status === 201, r.message);
    r = await call('POST', '/hr/org/department', { token: oTok, body: { name: 'sales' } });
    check('duplicate department blocked', r.status === 409, `${r.status}`);
    r = await call('POST', '/hr/org/designation', { token: oTok, body: { name: 'Sales Executive' } });
    const desigId = r.data?._id;

    step('2. Employees');
    r = await call('POST', '/hr/employees', {
      token: oTok,
      body: {
        name: 'Ravi Employee', phone: PH.emp, password: 'hr123456', staffRole: 'employee',
        departmentId: deptId, designationId: desigId, joiningDate: '2024-01-01',
        salary: { type: 'monthly', basic: 30000, allowances: 0, commissionPct: 2, monthlyTarget: 100000 },
      },
    });
    const empId = r.data?._id;
    check('employee created with code + login', r.status === 201 && /^EMP-\d{4}$/.test(r.data?.code || '') && r.data?.salary?.basic === 30000, r.message);
    r = await call('POST', '/hr/employees', { token: oTok, body: { name: 'Hina HR', phone: PH.hr, password: 'hr123456', staffRole: 'hr' } });
    const hrId = r.data?._id;
    check('HR manager created', r.status === 201, r.message);
    r = await call('POST', '/staff', { token: oTok, body: { name: 'View Only', phone: PH.viewer, password: 'hr123456', staffRole: 'custom', permissions: ['hr:view'] } });
    check('custom staff with hr:view only', r.status === 201, r.message);
    r = await call('POST', '/hr/employees', { token: oTok, body: { name: 'Dup', phone: PH.emp, password: 'hr123456' } });
    check('same phone twice blocked', r.status === 409, `${r.status}`);

    let r0 = await login(PH.emp);
    const tmpTok = r0;
    r0 = await call('GET', '/hr/me', { token: tmpTok });
    check('temporary password: app blocked until changed', r0.status === 403 && r0.details?.reason === 'must_change_password', `${r0.status}`);
    r0 = await call('GET', '/auth/me', { token: tmpTok });
    check('profile says password must change', r0.data?.user?.mustChangePassword === true, JSON.stringify(r0.data?.user?.mustChangePassword));
    r0 = await call('POST', '/auth/change-password', { token: tmpTok, body: { currentPassword: 'hr123456', newPassword: 'hr123456' } });
    check('same password not accepted', r0.status === 400, `${r0.status}`);
    r0 = await call('POST', '/auth/change-password', { token: tmpTok, body: { currentPassword: 'hr123456', newPassword: 'emp98765' } });
    check('employee sets own password', r0.status === 200, r0.message);
    await M.User.updateMany({ phone: { $in: [PH.emp, PH.hr, PH.viewer] } }, { $set: { mustChangePassword: false } });
    await M.User.updateOne({ phone: PH.emp }, { $set: { passwordHash: (await M.User.findOne({ phone: PH.hr }).select('+passwordHash').lean()).passwordHash } });
    const eTok = await login(PH.emp);
    const hTok = await login(PH.hr);
    const vTok = await login(PH.viewer);
    check('employee / HR / viewer can log in', Boolean(eTok && hTok && vTok));

    r = await call('GET', '/hr/employees', { token: vTok });
    const viewerRow = (r.data || []).find((e) => String(e._id) === String(empId));
    check('viewer sees employees (auto profile for staff) but not salary', viewerRow && viewerRow.salary === undefined && (r.data || []).length >= 3, JSON.stringify(viewerRow?.salary));
    r = await call('GET', '/hr/payroll', { token: vTok });
    check('viewer blocked from payroll', r.status === 403, `${r.status}`);
    r = await call('GET', '/hr/employees', { token: eTok });
    check('employee blocked from HR list', r.status === 403, `${r.status}`);
    r = await call('PUT', `/hr/employees/${empId}`, { token: vTok, body: { address: 'x' } });
    check('viewer cannot edit', r.status === 403, `${r.status}`);

    step('3. Attendance (Employee App)');
    r = await call('GET', '/hr/me', { token: eTok });
    check('employee home loads', r.status === 200 && r.data?.profile?.code && r.data?.today?.day === today, r.message);
    r = await call('POST', '/hr/me/check-in', { token: eTok, body: { lat: 28.6, lng: 77.2 } });
    check('check-in marks present/late', r.status === 200 && ['present', 'late'].includes(r.data?.status), r.message);
    r = await call('POST', '/hr/me/check-in', { token: eTok, body: {} });
    check('second check-in blocked', r.status === 409, `${r.status}`);
    r = await call('POST', '/hr/me/check-out', { token: eTok, body: {} });
    check('early check-out becomes half day', r.status === 200 && r.data?.status === 'half_day', `${r.data?.status}`);
    r = await call('POST', '/hr/me/check-out', { token: eTok, body: {} });
    check('second check-out blocked', r.status === 409, `${r.status}`);

    r = await call('PUT', '/hr/settings', { token: oTok, body: { requireLocation: true } });
    check('settings saved', r.status === 200 && r.data?.requireLocation === true, r.message);
    r = await call('POST', '/hr/me/check-in', { token: hTok, body: {} });
    check('location required when enabled', r.status === 400, `${r.status}`);
    r = await call('POST', '/hr/me/check-in', { token: hTok, body: { lat: 28.6, lng: 77.2 } });
    check('check-in with location works', r.status === 200, r.message);
    await call('PUT', '/hr/settings', { token: oTok, body: { requireLocation: false } });

    r = await call('GET', '/hr/attendance', { token: hTok });
    check('day board shows marked + not marked', r.data?.summary?.total >= 3 && r.data?.summary?.half_day >= 1, JSON.stringify(r.data?.summary));
    r = await call('POST', '/hr/attendance', { token: hTok, body: { userId: empId, day: addDays(today, 1), status: 'present' } });
    check('future attendance blocked', r.status === 400, `${r.status}`);

    step('4. Leave + correction');
    const mon = nextWeekday(addDays(today, 7), 1);
    const tue = addDays(mon, 1);
    r = await call('POST', '/hr/me/requests', { token: eTok, body: { kind: 'leave', leaveType: 'Casual Leave', from: mon, to: tue, reason: 'Family function' } });
    const leaveId = r.data?._id;
    check('leave applied (2 working days)', r.status === 201 && r.data?.days === 2, r.message);
    r = await call('POST', '/hr/me/requests', { token: eTok, body: { kind: 'leave', leaveType: 'Casual Leave', from: tue, to: tue, reason: 'Again' } });
    check('overlapping leave blocked', r.status === 409, `${r.status}`);
    r = await call('POST', '/hr/me/requests', { token: eTok, body: { kind: 'leave', leaveType: 'Sick Leave', from: addDays(mon, 7), to: addDays(mon, 20), reason: 'Too long' } });
    check('leave beyond quota blocked', r.status === 400, r.message);
    const notes = await M.Notification.countDocuments({ userId: hrId, type: 'HR_REQUEST' });
    check('HR manager notified of request', notes >= 1, `${notes}`);
    r = await call('POST', `/hr/requests/${leaveId}/review`, { token: eTok, body: { action: 'approve' } });
    check('employee cannot approve', r.status === 403, `${r.status}`);
    r = await call('POST', `/hr/requests/${leaveId}/review`, { token: hTok, body: { action: 'approve', note: 'Enjoy' } });
    check('HR approved leave', r.status === 200 && r.data?.status === 'approved', r.message);
    const leaveDays = await M.Attendance.find({ userId: empId, day: { $in: [mon, tue] }, status: 'leave' }).countDocuments();
    check('attendance marked as leave for both days', leaveDays === 2, `${leaveDays}`);
    r = await call('GET', '/hr/me/leave-balances', { token: eTok });
    const cl = (r.data || []).find((b) => b.name === 'Casual Leave');
    check('balance: 2 taken, 10 left', cl?.taken === 2 && cl?.left === 10, JSON.stringify(cl));
    r = await call('POST', `/hr/me/requests/${leaveId}/cancel`, { token: eTok });
    check('upcoming approved leave can be cancelled', r.status === 200, r.message);
    const leftOver = await M.Attendance.countDocuments({ userId: empId, day: { $in: [mon, tue] } });
    check('cancel clears leave attendance', leftOver === 0, `${leftOver}`);

    const yday = addDays(today, -1);
    r = await call('POST', '/hr/me/requests', { token: eTok, body: { kind: 'correction', day: yday, wantStatus: 'present', reason: 'Forgot to check in' } });
    const corrId = r.data?._id;
    check('correction requested', r.status === 201, r.message);
    r = await call('POST', `/hr/requests/${corrId}/review`, { token: hTok, body: { action: 'approve' } });
    const y = await M.Attendance.findOne({ userId: empId, day: yday }).lean();
    check('correction applied', r.status === 200 && y?.status === 'present' && y?.source === 'correction', JSON.stringify(y?.status));
    r = await call('POST', `/hr/requests/${corrId}/review`, { token: hTok, body: { action: 'reject' } });
    check('cannot review twice', r.status === 400, `${r.status}`);

    r = await call('POST', '/hr/me/requests', { token: eTok, body: { kind: 'help', category: 'salary', subject: 'Salary slip query' } });
    const helpId = r.data?._id;
    await call('POST', `/hr/requests/${helpId}/messages`, { token: hTok, body: { text: 'Will check' } });
    r = await call('POST', `/hr/requests/${helpId}/review`, { token: hTok, body: { action: 'close', note: 'Resolved' } });
    check('help ticket replied + closed', r.status === 200 && r.data?.status === 'closed' && r.data?.messages?.length === 2, r.message);

    step('5. Payroll');
    r = await call('POST', '/hr/payroll/advances', { token: hTok, body: { userId: empId, amount: 5000, note: 'Festival' } });
    check('advance recorded', r.status === 201, r.message);
    const period = today.slice(0, 7);
    r = await call('POST', '/hr/payroll/generate', { token: hTok, body: { period } });
    check('payroll generated', r.status === 200 && r.data?.created >= 1, r.message);
    r = await call('POST', '/hr/payroll/generate', { token: hTok, body: { period } });
    check('no duplicate payroll for same month', r.data?.created === 0, JSON.stringify(r.data));
    r = await call('GET', `/hr/payroll?period=${period}`, { token: hTok });
    let pr = (r.data?.rows || []).find((p) => String(p.userId) === String(empId));
    check('advance recovered in payroll', pr?.advanceAdjusted === 5000 && pr?.net === Math.round((pr.gross - 5000) * 100) / 100, JSON.stringify(pr && { g: pr.gross, n: pr.net, a: pr.advanceAdjusted }));
    check('only employees with salary get payroll', (r.data?.rows || []).length === 1, `${(r.data?.rows || []).length}`);
    r = await call('PUT', `/hr/payroll/${pr._id}`, { token: hTok, body: { bonus: 1000 } });
    check('bonus added to gross', r.status === 200 && r.data?.gross === pr.gross + 1000, `${r.data?.gross}`);
    pr = r.data;
    r = await call('POST', `/hr/payroll/${pr._id}/pay`, { token: hTok, body: { mode: 'BANK' } });
    check('cannot pay before approval', r.status === 400, `${r.status}`);
    r = await call('POST', '/hr/payroll/approve', { token: hTok, body: { ids: [pr._id] } });
    check('approved', r.data?.approved === 1, r.message);
    r = await call('PUT', `/hr/payroll/${pr._id}`, { token: hTok, body: { bonus: 5 } });
    check('approved payroll locked for edits', r.status === 400, `${r.status}`);
    r = await call('POST', `/hr/payroll/${pr._id}/pay`, { token: hTok, body: { mode: 'BANK' } });
    const exp = await M.Expense.findOne({ payrollId: pr._id }).lean();
    check('paid → salary expense = gross', r.status === 200 && exp?.category === 'salary' && exp?.amount === pr.gross, JSON.stringify(exp && { c: exp.category, a: exp.amount }));
    r = await call('GET', '/hr/me/payslips', { token: eTok });
    check('employee sees own payslip', (r.data || []).some((p) => String(p._id) === String(pr._id)), `${(r.data || []).length}`);
    r = await call('GET', `/hr/me/payslips/${pr._id}`, { token: hTok });
    check('someone else cannot open it via /me', r.status === 404, `${r.status}`);
    r = await call('POST', `/hr/payroll/${pr._id}/cancel`, { token: hTok, body: { reason: 'Wrong bonus' } });
    const expAfter = await M.Expense.countDocuments({ payrollId: pr._id });
    const advFree = await M.SalaryAdvance.countDocuments({ userId: empId, recoveredInPayrollId: null });
    check('cancel removes expense and frees advance', r.status === 200 && expAfter === 0 && advFree === 1, `${expAfter} ${advFree}`);

    step('6. Teams, performance, logs');
    r = await call('POST', '/hr/teams', { token: oTok, body: { name: 'North Team', leaderUserId: hrId, memberIds: [empId], monthlyTarget: 500000 } });
    check('team created (leader auto-added)', r.status === 201 && r.data?.memberIds?.length === 2, r.message);
    r = await call('GET', '/hr/teams', { token: oTok });
    check('team list with achieved sales', r.data?.[0]?.achieved === 0 && r.data?.[0]?.members?.length === 2, JSON.stringify(r.data?.[0]?.achieved));
    r = await call('GET', '/hr/me/team', { token: eTok });
    check('employee sees own team', r.data?.teams?.[0]?.name === 'North Team', r.message);
    r = await call('GET', '/hr/performance', { token: oTok });
    check('performance rows', (r.data?.rows || []).some((x) => String(x.userId) === String(empId) && x.target === 100000), r.message);
    r = await call('GET', '/hr/dashboard', { token: oTok });
    check('dashboard', r.status === 200 && r.data?.employees >= 3 && r.data?.payroll, r.message);
    r = await call('PUT', `/hr/employees/${empId}`, { token: oTok, body: { salary: { basic: 32000 } } });
    r = await call('GET', `/hr/logs?userId=${empId}`, { token: oTok });
    check('salary change logged', (r.data || []).some((l) => l.action === 'salary'), JSON.stringify((r.data || []).map((l) => l.action)));
    let threw = false;
    try { await M.HrLog.updateOne({}, { $set: { summary: 'x' } }); } catch { threw = true; }
    check('HR log is append-only', threw);
    r = await call('DELETE', `/hr/org/department/${deptId}`, { token: oTok });
    check('department in use cannot be deleted', r.status === 400, `${r.status}`);

    step('6b. Employee ID login, HR password reset');
    r = await call('GET', '/hr/meta', { token: oTok });
    const company = r.data?.companyCode;
    const empCode = (await M.Employee.findOne({ userId: empId }).lean())?.code;
    check('company code created', /^[A-Z0-9]{4,10}$/.test(company || ''), company);
    r = await call('POST', '/auth/login', { body: { companyCode: company, employeeCode: empCode, password: 'hr123456' } });
    check('login with company code + Employee ID', Boolean(r.data?.token) && r.data?.user?.staffRole === 'employee', r.message);
    r = await call('POST', '/auth/login', { body: { companyCode: company, employeeCode: 'EMP-9999', password: 'hr123456' } });
    check('wrong Employee ID rejected', r.status === 401, `${r.status}`);
    const beforeReset = await login(PH.emp);
    r = await call('POST', `/hr/employees/${empId}/password`, { token: vTok, body: { password: 'temp4321' } });
    check('viewer cannot reset passwords', r.status === 403, `${r.status}`);
    r = await call('POST', `/hr/employees/${empId}/password`, { token: hTok, body: { password: 'temp4321' } });
    check('HR resets password', r.status === 200, r.message);
    r = await call('GET', '/hr/me', { token: beforeReset });
    check('old session signed out after reset', r.status === 401, `${r.status}`);
    const t2 = await login(PH.emp, 'temp4321');
    r = await call('GET', '/hr/me', { token: t2 });
    check('temporary password forces change', r.status === 403 && r.details?.reason === 'must_change_password', `${r.status}`);
    await call('POST', '/auth/change-password', { token: t2, body: { currentPassword: 'temp4321', newPassword: 'hr123456x' } });
    r = await call('GET', '/hr/me', { token: t2 });
    check('after change, app opens', r.status === 200, `${r.status}`);

    step('7. Plan gating + exit');
    await M.Subscription.updateOne({ businessId: bizId }, { $set: { planCode: 'CHOTI' } });
    r = await call('GET', '/hr/teams', { token: oTok });
    check('teams locked on CHOTI', r.status === 403 && r.details?.reason === 'feature_locked', `${r.status}`);
    r = await call('GET', '/hr/me', { token: t2 });
    check('HR (attendance) locked on CHOTI — ₹100 plan se', r.status === 403 && r.details?.reason === 'feature_locked', `${r.status}`);
    await M.Subscription.updateOne({ businessId: bizId }, { $set: { planCode: 'BADI' } });

    r = await call('PUT', `/hr/employees/${empId}`, { token: oTok, body: { status: 'left' } });
    const u = await M.User.findById(empId).lean();
    check('employee marked left → login disabled', r.status === 200 && r.data?.status === 'left' && u?.isActive === false, JSON.stringify(u?.isActive));
    r = await call('PUT', `/hr/employees/${hrId}`, { token: hTok, body: { status: 'left' } });
    check('cannot change own status', r.status === 400, `${r.status}`);
  } finally {
    await cleanup().catch(() => {});
    server.close();
    await mongoose.disconnect();
  }

  console.log(`\n${failed === 0 ? G : R}${passed} pass, ${failed} fail${N}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(`${R}HR check crash:${N}`, err);
  process.exit(1);
});

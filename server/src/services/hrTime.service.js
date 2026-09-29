import ApiError from '../utils/ApiError.js';
import { ROLES, NOTIFICATION_TYPES } from '../config/constants.js';
import { STAFF_ROLES } from '../config/permissions.js';
import { saveImage } from '../utils/storage.js';
import { notify } from './notification.service.js';
import {
  User, Employee, Attendance, HrRequest,
} from '../models/index.js';
import {
  istDay, istMinutes, weekdayOf, daysBetween, monthOf,
} from '../utils/istDay.js';
import {
  hrSettings, hrLog, ensureProfiles, userNames, countStatus, oid, profileOf,
} from './hr.service.js';

const toMin = (hhmm) => { const [h, m] = String(hhmm || '10:00').split(':').map(Number); return h * 60 + (m || 0); };
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const PRESENT_LIKE = ['present', 'late', 'half_day'];

async function activeProfile(businessId, userId) {
  const e = await profileOf(businessId, userId);
  if (e.status !== 'active') throw ApiError.forbidden('Your employee profile is not active');
  return e;
}

/* ─────────────────────────────── check-in / check-out ─────────────────────────────── */

async function punchData(settings, { lat, lng }, file, kind) {
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);
  if (settings.requireLocation && !hasLoc) throw ApiError.badRequest('Location is required. Please allow location access and try again.');
  if (settings.requirePhoto && !file) throw ApiError.badRequest('A selfie is required to mark attendance');
  const photoUrl = file ? (await saveImage(file, 'attendance')).url : '';
  return { at: new Date(), lat: hasLoc ? lat : null, lng: hasLoc ? lng : null, photoUrl, kind };
}

export async function checkIn(businessId, user, body = {}, file = null) {
  await activeProfile(businessId, user._id);
  const settings = await hrSettings(businessId);
  const day = istDay();
  const existing = await Attendance.findOne({ businessId, userId: user._id, day }).lean();
  if (existing?.checkIn?.at) throw ApiError.conflict(`You already checked in today at ${fmtTime(existing.checkIn.at)}`);

  const { kind, ...punch } = await punchData(settings, body, file, 'in');
  const late = istMinutes(punch.at) > toMin(settings.workStart) + settings.lateAfterMinutes;
  const doc = await Attendance.findOneAndUpdate(
    { businessId, userId: user._id, day },
    { $set: { checkIn: punch, status: late ? 'late' : 'present', source: 'app' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return { ...doc, message: late ? `Checked in at ${fmtTime(punch.at)} (late)` : `Checked in at ${fmtTime(punch.at)}` };
}

export async function checkOut(businessId, user, body = {}, file = null) {
  const settings = await hrSettings(businessId);
  const day = istDay();
  const rec = await Attendance.findOne({ businessId, userId: user._id, day });
  if (!rec?.checkIn?.at) throw ApiError.badRequest('Please check in first');
  if (rec.checkOut?.at) throw ApiError.conflict(`You already checked out today at ${fmtTime(rec.checkOut.at)}`);

  const { kind, ...punch } = await punchData(settings, body, file, 'out');
  rec.checkOut = punch;
  rec.workMinutes = Math.max(0, Math.round((punch.at - rec.checkIn.at) / 60000));
  if (rec.workMinutes < settings.halfDayHours * 60) rec.status = 'half_day';
  await rec.save();
  const h = Math.floor(rec.workMinutes / 60);
  const m = rec.workMinutes % 60;
  return { ...rec.toObject(), message: `Checked out. Worked ${h}h ${m}m today` };
}

/* ─────────────────────────────── HR views ─────────────────────────────── */

/** Ek din ka board — sab active employee, chahe record ho ya nahi */
export async function dayBoard(businessId, day = istDay()) {
  await ensureProfiles(businessId);
  const settings = await hrSettings(businessId);
  const emps = await Employee.find({ businessId, status: 'active' }).select('userId code photoUrl').lean();
  const [users, recs] = await Promise.all([
    User.find({ _id: { $in: emps.map((e) => e.userId) } }).select('name phone staffRole').lean(),
    Attendance.find({ businessId, day, userId: { $in: emps.map((e) => e.userId) } }).lean(),
  ]);
  const um = new Map(users.map((u) => [String(u._id), u]));
  const rm = new Map(recs.map((r) => [String(r.userId), r]));
  const off = settings.weeklyOff.includes(weekdayOf(day));
  const rows = emps.map((e) => {
    const r = rm.get(String(e.userId));
    return {
      userId: e.userId,
      code: e.code,
      photoUrl: e.photoUrl,
      name: um.get(String(e.userId))?.name || '',
      status: r?.status || (off ? 'weekly_off' : 'not_marked'),
      checkIn: r?.checkIn?.at ? r.checkIn : null,
      checkOut: r?.checkOut?.at ? r.checkOut : null,
      workMinutes: r?.workMinutes || 0,
      note: r?.note || '',
      source: r?.source || '',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const summary = { total: rows.length, not_marked: 0, ...countStatus([]) };
  for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1;
  return { day, weeklyOff: off, rows, summary };
}

export async function markAttendance(businessId, actor, { userId, day, status, note = '', checkInTime = '', checkOutTime = '' }) {
  if (day > istDay()) throw ApiError.badRequest('Attendance cannot be marked for a future date');
  const emp = await Employee.findOne({ businessId, userId }).lean();
  if (!emp) throw ApiError.notFound('Employee not found');
  const before = await Attendance.findOne({ businessId, userId, day }).lean();
  const set = { status, note, source: 'hr', editedBy: actor._id };
  const at = (hhmm) => new Date(Date.parse(`${day}T${hhmm}:00+05:30`));
  if (checkInTime) set['checkIn.at'] = at(checkInTime);
  if (checkOutTime) set['checkOut.at'] = at(checkOutTime);
  const inAt = checkInTime ? at(checkInTime) : before?.checkIn?.at;
  const outAt = checkOutTime ? at(checkOutTime) : before?.checkOut?.at;
  if (inAt && outAt) {
    if (outAt <= inAt) throw ApiError.badRequest('Check-out time must be after check-in time');
    set.workMinutes = Math.round((outAt - inAt) / 60000);
  }
  if (!PRESENT_LIKE.includes(status)) { set.checkIn = {}; set.checkOut = {}; set.workMinutes = 0; delete set['checkIn.at']; delete set['checkOut.at']; }
  const doc = await Attendance.findOneAndUpdate({ businessId, userId, day }, { $set: set }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  await hrLog(businessId, userId, actor, 'attendance', `Attendance for ${day} set to ${status}`, before ? { status: before.status } : null, { status });
  return doc;
}

/** Mahine ki sheet — har din ka status (khali din: weekly off / not marked) */
export async function monthSheet(businessId, userId, period) {
  const settings = await hrSettings(businessId);
  const { from, to, days } = monthOf(period);
  const [recs, first, emp] = await Promise.all([
    Attendance.find({ businessId, userId, day: { $gte: from, $lte: to } }).lean(),
    Attendance.findOne({ businessId, userId }).sort({ day: 1 }).select('day').lean(),
    Employee.findOne({ businessId, userId }).select('joiningDate').lean(),
  ]);
  const rm = new Map(recs.map((r) => [r.day, r]));
  const today = istDay();
  // Attendance shuru hone / joining se pehle ke din "not marked" nahi gine jate
  const trackFrom = [first?.day || today, emp?.joiningDate ? istDay(emp.joiningDate) : ''].sort().pop();
  const rows = days.map((day) => {
    const r = rm.get(day);
    if (r) return r;
    if (settings.weeklyOff.includes(weekdayOf(day))) return { day, status: 'weekly_off' };
    if (day > today) return { day, status: 'upcoming' };
    return { day, status: day < trackFrom ? 'not_tracked' : 'not_marked' };
  });
  const summary = countStatus(recs);
  summary.not_marked = rows.filter((r) => r.status === 'not_marked').length;
  summary.workMinutes = recs.reduce((s, r) => s + (r.workMinutes || 0), 0);
  return { period, days: rows, summary };
}

/** Mahine ki report — har employee ka hisaab */
export async function attendanceReport(businessId, period) {
  await ensureProfiles(businessId);
  const { from, to } = monthOf(period);
  const emps = await Employee.find({ businessId, status: { $ne: 'left' } }).select('userId code').lean();
  const [names, agg] = await Promise.all([
    userNames(emps.map((e) => e.userId)),
    Attendance.aggregate([
      { $match: { businessId: oid(businessId), day: { $gte: from, $lte: to } } },
      { $group: { _id: { u: '$userId', s: '$status' }, n: { $sum: 1 }, m: { $sum: '$workMinutes' } } },
    ]),
  ]);
  const by = new Map();
  for (const a of agg) {
    const k = String(a._id.u);
    const row = by.get(k) || { ...countStatus([]), workMinutes: 0 };
    row[a._id.s] = a.n;
    row.workMinutes += a.m;
    by.set(k, row);
  }
  return emps.map((e) => ({ userId: e.userId, code: e.code, name: names.get(String(e.userId)) || '', ...(by.get(String(e.userId)) || { ...countStatus([]), workMinutes: 0 }) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ─────────────────────────────── leave balance ─────────────────────────────── */

export async function leaveBalances(businessId, userId, year = istDay().slice(0, 4)) {
  const settings = await hrSettings(businessId);
  const rows = await HrRequest.aggregate([
    { $match: { businessId: oid(businessId), userId: oid(userId), kind: 'leave', status: { $in: ['approved', 'pending'] }, from: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } } },
    { $group: { _id: { t: '$leaveType', s: '$status' }, days: { $sum: '$days' } } },
  ]);
  const used = (t, s) => rows.find((r) => r._id.t === t && r._id.s === s)?.days || 0;
  return settings.leaveTypes.filter((l) => l.active).map((l) => {
    const taken = used(l.name, 'approved');
    const pending = used(l.name, 'pending');
    return {
      name: l.name, paid: l.paid, quota: l.yearlyQuota, taken, pending,
      left: l.yearlyQuota ? Math.max(0, l.yearlyQuota - taken - pending) : null,
    };
  });
}

/* ─────────────────────────────── requests (leave / correction / help) ─────────────────────────────── */

async function approvers(businessId, employeeUserId) {
  const emp = await Employee.findOne({ businessId, userId: employeeUserId }).select('reportingManagerId').lean();
  const users = await User.find({
    businessId, role: ROLES.WHOLESALER, isActive: { $ne: false },
    $or: [{ staffRole: STAFF_ROLES.OWNER }, { staffRole: { $exists: false } }, { permissions: 'hr:approve' }, ...(emp?.reportingManagerId ? [{ _id: emp.reportingManagerId }] : [])],
  }).select('_id').lean();
  return users.map((u) => u._id).filter((id) => String(id) !== String(employeeUserId));
}

async function tellApprovers(businessId, user, title, body) {
  const ids = await approvers(businessId, user._id);
  await Promise.all(ids.map((uid) => notify({
    businessId, userId: uid, type: NOTIFICATION_TYPES.HR_REQUEST, title, body, link: '/hr/requests',
  }).catch(() => null)));
}

function workingDays(from, to, weeklyOff) {
  return daysBetween(from, to).filter((d) => !weeklyOff.includes(weekdayOf(d)));
}

export async function createRequest(businessId, user, body) {
  await activeProfile(businessId, user._id);
  const settings = await hrSettings(businessId);
  const doc = { businessId, userId: user._id, kind: body.kind, reason: body.reason || '' };

  if (body.kind === 'leave') {
    const type = settings.leaveTypes.find((l) => l.active && l.name === body.leaveType);
    if (!type) throw ApiError.badRequest('Please choose a valid leave type');
    if (body.to < body.from) throw ApiError.badRequest('End date cannot be before start date');
    if (body.from.slice(0, 4) !== body.to.slice(0, 4)) throw ApiError.badRequest('Please apply separately for each calendar year');
    const days = workingDays(body.from, body.to, settings.weeklyOff);
    const count = body.halfDay && days.length === 1 ? 0.5 : days.length;
    if (!count) throw ApiError.badRequest('The selected dates fall on weekly off days');
    const overlap = await HrRequest.findOne({
      businessId, userId: user._id, kind: 'leave', status: { $in: ['pending', 'approved'] },
      from: { $lte: body.to }, to: { $gte: body.from },
    }).lean();
    if (overlap) throw ApiError.conflict(`You already have a ${overlap.status} leave from ${overlap.from} to ${overlap.to}`);
    if (type.yearlyQuota) {
      const bal = (await leaveBalances(businessId, user._id, body.from.slice(0, 4))).find((b) => b.name === type.name);
      if (bal && count > bal.left) throw ApiError.badRequest(`Only ${bal.left} day(s) of ${type.name} left this year`);
    }
    Object.assign(doc, { leaveType: type.name, paid: type.paid, from: body.from, to: body.to, days: count });
  } else if (body.kind === 'correction') {
    if (body.day > istDay()) throw ApiError.badRequest('Correction can only be requested for past dates');
    const dup = await HrRequest.findOne({ businessId, userId: user._id, kind: 'correction', day: body.day, status: 'pending' }).lean();
    if (dup) throw ApiError.conflict('A correction request for this date is already pending');
    Object.assign(doc, { day: body.day, wantStatus: body.wantStatus });
  } else {
    Object.assign(doc, { category: body.category || 'other', subject: body.subject });
  }

  const req = await HrRequest.create(doc);
  const title = body.kind === 'leave' ? `${user.name} applied for ${doc.leaveType} (${doc.days} day${doc.days === 1 ? '' : 's'})`
    : body.kind === 'correction' ? `${user.name} requested attendance correction for ${doc.day}`
      : `${user.name}: ${doc.subject}`;
  await tellApprovers(businessId, user, title, doc.reason);
  return req;
}

export async function listRequests(businessId, viewer, { kind = '', status = 'pending', userId = '', page = 1, limit = 50 } = {}) {
  const filter = { businessId };
  if (kind) filter.kind = kind;
  if (status) filter.status = status;
  if (userId) filter.userId = userId;
  const [rows, total] = await Promise.all([
    HrRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    HrRequest.countDocuments(filter),
  ]);
  const names = await userNames([...rows.map((r) => r.userId), ...rows.map((r) => r.reviewedBy)]);
  return {
    rows: rows.map((r) => ({ ...r, name: names.get(String(r.userId)) || '', reviewedByName: names.get(String(r.reviewedBy)) || '' })),
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function myRequests(businessId, user, { kind = '' } = {}) {
  return HrRequest.find({ businessId, userId: user._id, ...(kind ? { kind } : {}) }).sort({ createdAt: -1 }).limit(50).lean();
}

async function applyLeave(businessId, req, actor) {
  const settings = await hrSettings(businessId);
  const days = workingDays(req.from, req.to, settings.weeklyOff);
  const half = req.days === 0.5;
  for (const day of days) {
    const cur = await Attendance.findOne({ businessId, userId: req.userId, day }).lean();
    if (cur?.checkIn?.at && !half) continue;
    await Attendance.findOneAndUpdate(
      { businessId, userId: req.userId, day },
      { $set: { status: half ? 'half_day' : 'leave', leavePaid: req.paid, source: 'leave', note: req.leaveType, editedBy: actor._id } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
}

async function undoLeave(businessId, req) {
  await Attendance.deleteMany({
    businessId, userId: req.userId, source: 'leave', day: { $gte: req.from, $lte: req.to }, 'checkIn.at': null,
  });
}

export async function reviewRequest(businessId, actor, id, { action, note = '' }) {
  const req = await HrRequest.findOne({ _id: id, businessId });
  if (!req) throw ApiError.notFound('Request not found');
  const ownerActor = (actor.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER;
  if (String(req.userId) === String(actor._id) && !ownerActor) throw ApiError.forbidden('You cannot review your own request');

  if (action === 'close') {
    if (req.kind !== 'help') throw ApiError.badRequest('Only help requests can be closed');
  } else if (req.status !== 'pending') {
    throw ApiError.badRequest(`This request is already ${req.status}`);
  }

  if (action === 'approve') {
    if (req.kind === 'leave') await applyLeave(businessId, req, actor);
    if (req.kind === 'correction') {
      await markAttendance(businessId, actor, { userId: req.userId, day: req.day, status: req.wantStatus, note: `Correction: ${req.reason}`.slice(0, 300) });
      await Attendance.updateOne({ businessId, userId: req.userId, day: req.day }, { $set: { source: 'correction' } });
    }
  }
  req.status = { approve: 'approved', reject: 'rejected', close: 'closed' }[action];
  req.reviewedBy = actor._id;
  req.reviewedAt = new Date();
  req.reviewNote = note;
  if (note && req.kind === 'help') req.messages.push({ byUserId: actor._id, byName: actor.name, text: note });
  await req.save();

  const what = req.kind === 'leave' ? `Your ${req.leaveType} request (${req.from} to ${req.to})`
    : req.kind === 'correction' ? `Your attendance correction for ${req.day}` : `Your request "${req.subject}"`;
  await notify({
    businessId, userId: req.userId, type: NOTIFICATION_TYPES.HR_UPDATE,
    title: `${what} was ${req.status}`, body: note, link: '/emp/more/requests',
  }).catch(() => null);
  if (req.kind !== 'help') await hrLog(businessId, req.userId, actor, `request_${req.status}`, `${what} was ${req.status}`);
  return req;
}

export async function cancelRequest(businessId, user, id) {
  const req = await HrRequest.findOne({ _id: id, businessId, userId: user._id });
  if (!req) throw ApiError.notFound('Request not found');
  if (req.status === 'approved' && req.kind === 'leave' && req.from > istDay()) {
    await undoLeave(businessId, req);
  } else if (req.status !== 'pending') {
    throw ApiError.badRequest('Only pending requests or upcoming approved leave can be cancelled');
  }
  req.status = 'cancelled';
  await req.save();
  return req;
}

export async function addMessage(businessId, user, id, text, { asStaff = false } = {}) {
  const req = await HrRequest.findOne({ _id: id, businessId, ...(asStaff ? {} : { userId: user._id }) });
  if (!req) throw ApiError.notFound('Request not found');
  if (req.status === 'closed') throw ApiError.badRequest('This request is closed');
  req.messages.push({ byUserId: user._id, byName: user.name, text });
  await req.save();
  if (asStaff) {
    await notify({ businessId, userId: req.userId, type: NOTIFICATION_TYPES.HR_UPDATE, title: `Reply on "${req.subject || req.kind}"`, body: text, link: '/emp/more/requests' }).catch(() => null);
  } else {
    await tellApprovers(businessId, user, `${user.name} replied on "${req.subject || req.kind}"`, text);
  }
  return req;
}

export { PRESENT_LIKE };

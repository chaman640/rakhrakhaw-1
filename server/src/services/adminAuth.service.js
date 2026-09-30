import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { ADMIN_ROLES, ADMIN_PERMS, permsOfRole } from '../config/adminRoles.js';
import {
  newSecret, verifyCode, otpauthUrl, seal, unseal,
} from '../utils/totp.js';
import { PartnerAdmin } from '../models/index.js';
import { signAdminToken } from './partnerAdmin.service.js';
import { audit } from './platformAdmin.service.js';

/**
 * ADMIN LOGIN — dukaan wale login se alag aur zyada sakht:
 * 5 galat password pe 15 min rok, 2FA (authenticator app), backup code,
 * har login/logout register me, aur "sab jagah se logout".
 */

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const CHALLENGE_AUD = 'admin-2fa';
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

export function assertStrongPassword(pw) {
  const s = String(pw || '');
  if (s.length < 10 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) {
    throw ApiError.badRequest('Use at least 10 characters with both letters and numbers');
  }
}

export function adminView(a) {
  return {
    _id: a._id,
    email: a.email,
    name: a.name || '',
    role: a.role || 'super',
    roleLabel: ADMIN_ROLES[a.role || 'super']?.label,
    perms: permsOfRole(a.role || 'super'),
    active: a.active !== false,
    totpEnabled: Boolean(a.totpEnabled),
    require2fa: Boolean(a.require2fa),
    passwordChanged: Boolean(a.passwordChanged),
    lastLoginAt: a.lastLoginAt,
    lastLoginIp: a.lastLoginIp || '',
    createdAt: a.createdAt,
  };
}

/** Pehli baar `.env` se super admin ban jata hai */
async function ensureBootstrapAdmin() {
  const email = (env.partnerAdmin.email || '').toLowerCase().trim();
  if (!email || !env.partnerAdmin.password) return;
  if (await PartnerAdmin.exists({ email })) return;
  const a = new PartnerAdmin({ email, passwordHash: 'temp', role: 'super', name: 'Super Admin' });
  await a.setPassword(env.partnerAdmin.password);
  await a.save();
}

async function issue(admin, ctx) {
  admin.failedLogins = 0;
  admin.lockedUntil = null;
  admin.lastLoginAt = new Date();
  admin.lastLoginIp = ctx.ip || '';
  await admin.save();
  await audit({ adminId: admin._id, ip: ctx.ip }, { action: 'admin.login', targetType: 'PartnerAdmin', targetId: admin._id, targetLabel: admin.email });
  return {
    token: signAdminToken(admin),
    ...adminView(admin),
    mustSetup2fa: Boolean(admin.require2fa && !admin.totpEnabled),
  };
}

export async function login({ email, password }, ctx = {}) {
  await ensureBootstrapAdmin();
  const admin = await PartnerAdmin.findOne({ email: String(email || '').toLowerCase().trim() });
  const wrong = ApiError.unauthorized('Email or password is incorrect');
  if (!admin) throw wrong;
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const mins = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
    throw ApiError.forbidden(`Too many wrong attempts. Try again in ${mins} minute(s).`);
  }
  if (!(await admin.checkPassword(password))) {
    admin.failedLogins = (admin.failedLogins || 0) + 1;
    if (admin.failedLogins >= MAX_FAILS) {
      admin.lockedUntil = new Date(Date.now() + LOCK_MS);
      admin.failedLogins = 0;
      await audit({ adminId: admin._id, ip: ctx.ip }, { action: 'admin.locked', targetType: 'PartnerAdmin', targetId: admin._id, targetLabel: admin.email, note: `${MAX_FAILS} wrong passwords` });
    }
    await admin.save();
    throw wrong;
  }
  if (admin.active === false) throw ApiError.forbidden('This admin account is disabled');
  if (admin.totpEnabled) {
    const challenge = jwt.sign({ sub: String(admin._id), aud: CHALLENGE_AUD }, env.jwtSecret, { expiresIn: '5m' });
    return { twoFactor: true, challenge };
  }
  return issue(admin, ctx);
}

export async function loginSecondStep({ challenge, code }, ctx = {}) {
  let d;
  try { d = jwt.verify(challenge, env.jwtSecret); } catch { throw ApiError.unauthorized('Login session expired. Please sign in again.'); }
  if (d.aud !== CHALLENGE_AUD) throw ApiError.unauthorized();
  const admin = await PartnerAdmin.findById(d.sub).select('+totpSecret +backupCodes');
  if (!admin || admin.active === false || !admin.totpEnabled) throw ApiError.unauthorized();
  if (admin.lockedUntil && admin.lockedUntil > new Date()) throw ApiError.forbidden('Too many wrong attempts. Try again later.');

  const clean = String(code || '').replace(/[\s-]/g, '');
  let okCode = /^\d{6}$/.test(clean) && verifyCode(unseal(admin.totpSecret, env.jwtSecret), clean);
  if (!okCode && /^[a-z0-9]{10}$/i.test(clean)) {
    const i = admin.backupCodes.indexOf(hash(clean.toLowerCase()));
    if (i >= 0) {
      admin.backupCodes.splice(i, 1);
      okCode = true;
      await audit({ adminId: admin._id, ip: ctx.ip }, { action: 'admin.backup_code_used', targetType: 'PartnerAdmin', targetId: admin._id, targetLabel: admin.email, note: `${admin.backupCodes.length} left` });
    }
  }
  if (!okCode) {
    admin.failedLogins = (admin.failedLogins || 0) + 1;
    if (admin.failedLogins >= MAX_FAILS) { admin.lockedUntil = new Date(Date.now() + LOCK_MS); admin.failedLogins = 0; }
    await admin.save();
    throw ApiError.unauthorized('The code is incorrect');
  }
  return issue(admin, ctx);
}

export async function me(adminId) {
  const a = await PartnerAdmin.findById(adminId).lean();
  if (!a) throw ApiError.unauthorized();
  return { ...adminView(a), mustSetup2fa: Boolean(a.require2fa && !a.totpEnabled), allPerms: ADMIN_PERMS };
}

/* ─────────────────────────────── 2FA ─────────────────────────────── */

export async function start2fa(adminId) {
  const a = await PartnerAdmin.findById(adminId);
  if (!a) throw ApiError.unauthorized();
  if (a.totpEnabled) throw ApiError.badRequest('Two-step verification is already on');
  const secret = newSecret();
  a.totpPending = seal(secret, env.jwtSecret);
  await a.save();
  return { secret, otpauth: otpauthUrl(secret, a.email) };
}

export async function confirm2fa(adminId, { code }, ctx = {}) {
  const a = await PartnerAdmin.findById(adminId).select('+totpPending');
  if (!a?.totpPending) throw ApiError.badRequest('Start the setup again');
  const secret = unseal(a.totpPending, env.jwtSecret);
  if (!verifyCode(secret, code)) throw ApiError.badRequest('The code is incorrect. Check the time on your phone and try again.');
  const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
  a.totpSecret = seal(secret, env.jwtSecret);
  a.totpPending = '';
  a.totpEnabled = true;
  a.backupCodes = codes.map(hash);
  await a.save();
  await audit({ adminId, ip: ctx.ip }, { action: 'admin.2fa_on', targetType: 'PartnerAdmin', targetId: a._id, targetLabel: a.email });
  return { enabled: true, backupCodes: codes };
}

export async function disable2fa(adminId, { password, code }, ctx = {}) {
  const a = await PartnerAdmin.findById(adminId).select('+totpSecret');
  if (!a?.totpEnabled) throw ApiError.badRequest('Two-step verification is not on');
  if (a.require2fa) throw ApiError.forbidden('Two-step verification is required for your account');
  if (!(await a.checkPassword(password)) || !verifyCode(unseal(a.totpSecret, env.jwtSecret), code)) {
    throw ApiError.badRequest('Password or code is incorrect');
  }
  a.totpEnabled = false;
  a.totpSecret = '';
  a.backupCodes = [];
  await a.save();
  await audit({ adminId, ip: ctx.ip }, { action: 'admin.2fa_off', targetType: 'PartnerAdmin', targetId: a._id, targetLabel: a.email });
  return { enabled: false };
}

/* ─────────────────────────────── sessions & password ─────────────────────────────── */

export async function changePassword(adminId, { currentPassword, newPassword }, ctx = {}) {
  const a = await PartnerAdmin.findById(adminId);
  if (!a) throw ApiError.notFound('Admin not found');
  if (!(await a.checkPassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect');
  assertStrongPassword(newPassword);
  await a.setPassword(newPassword);
  a.passwordChanged = true;
  a.tokenSeq = (a.tokenSeq || 0) + 1;
  await a.save();
  await audit({ adminId, ip: ctx.ip }, { action: 'admin.password_changed', targetType: 'PartnerAdmin', targetId: a._id, targetLabel: a.email });
  return { ok: true, token: signAdminToken(a) };
}

export async function logout(adminId, { everywhere = false } = {}, ctx = {}) {
  if (everywhere) await PartnerAdmin.updateOne({ _id: adminId }, { $inc: { tokenSeq: 1 } });
  await audit({ adminId, ip: ctx.ip }, { action: everywhere ? 'admin.logout_all' : 'admin.logout', targetType: 'PartnerAdmin', targetId: adminId });
  return { ok: true };
}

/* ─────────────────────────────── admins (super admin) ─────────────────────────────── */

export async function listAdmins() {
  const rows = await PartnerAdmin.find().sort({ createdAt: 1 }).lean();
  return { admins: rows.map(adminView), roles: Object.entries(ADMIN_ROLES).map(([value, r]) => ({ value, label: r.label, perms: r.perms })), perms: ADMIN_PERMS };
}

export async function createAdmin(actorId, body, ctx = {}) {
  const email = body.email.toLowerCase().trim();
  if (await PartnerAdmin.exists({ email })) throw ApiError.conflict('An admin with this email already exists');
  assertStrongPassword(body.password);
  const a = new PartnerAdmin({ email, name: body.name, role: body.role, require2fa: Boolean(body.require2fa), createdBy: actorId, passwordHash: 'temp' });
  await a.setPassword(body.password);
  await a.save();
  await audit({ adminId: actorId, ip: ctx.ip }, { action: 'admin.created', targetType: 'PartnerAdmin', targetId: a._id, targetLabel: email, after: { role: a.role } });
  return adminView(a);
}

async function assertAnotherSuper(exceptId) {
  const n = await PartnerAdmin.countDocuments({ _id: { $ne: exceptId }, active: { $ne: false }, $or: [{ role: 'super' }, { role: { $exists: false } }] });
  if (!n) throw ApiError.badRequest('At least one active Super Admin must remain');
}

export async function updateAdmin(actorId, id, body, ctx = {}) {
  const a = await PartnerAdmin.findById(id);
  if (!a) throw ApiError.notFound('Admin not found');
  const before = adminView(a);
  const self = String(actorId) === String(id);
  if (self && (body.role && body.role !== a.role || body.active === false)) throw ApiError.badRequest('You cannot change your own role or disable yourself');
  if ((a.role || 'super') === 'super' && ((body.role && body.role !== 'super') || body.active === false)) await assertAnotherSuper(a._id);
  for (const k of ['name', 'role', 'active', 'require2fa']) if (body[k] !== undefined) a[k] = body[k];
  if (body.active === false || (body.role && body.role !== before.role)) a.tokenSeq = (a.tokenSeq || 0) + 1;
  await a.save();
  await audit({ adminId: actorId, ip: ctx.ip }, { action: 'admin.updated', targetType: 'PartnerAdmin', targetId: a._id, targetLabel: a.email, before: { role: before.role, active: before.active, require2fa: before.require2fa }, after: { role: a.role, active: a.active, require2fa: a.require2fa } });
  return adminView(a);
}

export async function resetAdmin(actorId, id, { password, reset2fa }, ctx = {}) {
  const a = await PartnerAdmin.findById(id);
  if (!a) throw ApiError.notFound('Admin not found');
  if (String(actorId) === String(id)) throw ApiError.badRequest('Use "Change password" for your own account');
  if (password) {
    assertStrongPassword(password);
    await a.setPassword(password);
    a.passwordChanged = false;
  }
  if (reset2fa) { a.totpEnabled = false; a.totpSecret = ''; a.backupCodes = []; }
  a.tokenSeq = (a.tokenSeq || 0) + 1;
  a.failedLogins = 0;
  a.lockedUntil = null;
  await a.save();
  await audit({ adminId: actorId, ip: ctx.ip }, { action: 'admin.reset', targetType: 'PartnerAdmin', targetId: a._id, targetLabel: a.email, note: [password && 'password', reset2fa && '2FA'].filter(Boolean).join(' + ') });
  return adminView(a);
}

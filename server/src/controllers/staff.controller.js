import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/staff.service.js';
import { logAction, diff } from '../services/audit.service.js';
import { clientOrigin } from '../config/origin.js';
import { signTokenFor, buildSession } from '../services/auth.service.js';

export const list = asyncHandler(async (req, res) =>
  ok(res, await service.listStaff(req.businessId)));

export const meta = asyncHandler(async (req, res) => ok(res, service.staffMeta()));

export const add = asyncHandler(async (req, res) => {
  const staff = await service.addStaff(req.businessId, req.body, req.user);

  await logAction(req, {
    action: 'staff.create',
    entityType: 'User', entityId: staff._id, entityLabel: staff.name,
    summary: `${staff.name} ko ${staff.staffRoleLabel} banaya`,
  });

  return created(res, staff, `${staff.name} ka login ban gaya`);
});

/**
 * Staff ki setting badalna — register me sabse zyada kaam ki entry.
 *
 * "Kisne kisko kaunsa haq diya" ka jawab yahin se milta hai, isliye purani
 * haalat pehle padh lete hain aur farak likh dete hain.
 */
const STAFF_FIELDS = {
  name: 'Naam',
  phone: 'Phone',
  staffRoleLabel: 'Role',
  scopeLabel: 'Data ki hadd',
  isActive: 'Chalu hai',
};

export const update = asyncHandler(async (req, res) => {
  const { staff: rows } = await service.listStaff(req.businessId);
  const before = rows.find((s) => String(s._id) === String(req.params.id)) || null;

  const staff = await service.updateStaff(req.businessId, req.params.id, req.body, req.user);

  const changes = diff(before, staff, STAFF_FIELDS);

  // Ijazat ki list lambi hoti hai — poori list likhne ke bajaye sirf ginti aur
  // kya juda / kya gaya, wahi kaam ka hai
  const was = new Set(before?.permissions || []);
  const now = new Set(staff.permissions || []);
  const added = [...now].filter((p) => !was.has(p));
  const removed = [...was].filter((p) => !now.has(p));
  if (added.length || removed.length) {
    changes.push({
      field: 'permissions',
      label: 'Ijazat',
      from: `${was.size} kaam`,
      to: `${now.size} kaam`,
    });
  }

  if (changes.length) {
    const bits = [];
    if (added.length) bits.push(`+${added.length} nayi ijazat`);
    if (removed.length) bits.push(`−${removed.length} ijazat wapas li`);

    await logAction(req, {
      action: 'staff.update',
      entityType: 'User', entityId: staff._id, entityLabel: staff.name,
      changes,
      summary: `${staff.name} ki setting badli${bits.length ? ` (${bits.join(', ')})` : ''}`,
    });
  }

  return ok(res, staff, 'Save ho gaya');
});

export const remove = asyncHandler(async (req, res) => {
  const { staff: rows } = await service.listStaff(req.businessId);
  const before = rows.find((s) => String(s._id) === String(req.params.id)) || null;

  const result = await service.removeStaff(req.businessId, req.params.id, req.user);

  await logAction(req, {
    action: 'staff.delete',
    entityType: 'User', entityId: req.params.id, entityLabel: before?.name || '',
    summary: `${before?.name || 'Staff'} (${before?.staffRoleLabel || ''}) ko hataya`,
  });

  return ok(res, result, result.message);
});

/** Ye har logged-in user ke liye — apna hi password badalta hai */
export const changeMyPassword = asyncHandler(async (req, res) =>
  ok(res, await service.changeOwnPassword(req.user._id, req.body), 'Password badal gaya'));

/* ─────────────────────────── invite link ─────────────────────────── */

export const listInvites = asyncHandler(async (req, res) =>
  ok(res, await service.listInvites(req.businessId)));

export const createInvite = asyncHandler(async (req, res) => {
  const invite = await service.createInvite(req.businessId, req.body, req.user, clientOrigin());

  await logAction(req, {
    action: 'staff.invite',
    entityType: 'StaffInvite', entityId: invite._id,
    entityLabel: invite.label || invite.staffRoleLabel,
    summary: `${invite.staffRoleLabel} ke liye invite link banayi`
      + (invite.label ? ` (${invite.label})` : ''),
  });

  return created(res, invite, 'Link ban gayi — abhi copy karke bhej dijiye');
});

export const cancelInvite = asyncHandler(async (req, res) => {
  const result = await service.cancelInvite(req.businessId, req.params.id);
  await logAction(req, {
    action: 'staff.inviteCancel',
    entityType: 'StaffInvite', entityId: req.params.id,
    summary: 'Invite link rad ki',
  });
  return ok(res, result, result.message);
});

/* ---- login se pehle wale do rasta ---- */

export const peekInvite = asyncHandler(async (req, res) =>
  ok(res, await service.peekInvite(req.params.token)));

/**
 * Link se account banate hi login bhi kara dete hain.
 *
 * Warna naya aadmi account banata, phir login page pe jata, phir wahi phone
 * aur password dobara likhta. Ek hi kaam do baar karwana bekaar hai.
 */
export const acceptInvite = asyncHandler(async (req, res) => {
  const { user } = await service.acceptInvite(req.params.token, req.body);

  const session = await buildSession(user);
  return created(res, { token: signTokenFor(user), ...session },
    `Aap ${session.business?.name || 'dukaan'} se jud gaye`);
});

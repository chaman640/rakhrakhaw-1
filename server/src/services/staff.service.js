import ApiError from '../utils/ApiError.js';
import { normalizePhone } from '../utils/phone.js';
import {
  ROLES, STAFF_ROLES, PERMISSIONS, ROLE_PERMISSIONS, STAFF_ROLE_LABEL,
} from '../config/constants.js';
import { User } from '../models/index.js';

/**
 * Ek dukaan, kai log.
 *
 * Signup karne wala OWNER hota hai. Owner apne staff bana sakta hai —
 * har staff ka apna phone + password, aur apni-apni ijazat.
 *
 * Owner ko koi delete/block nahi kar sakta, khud bhi nahi.
 */

const shape = (u) => ({
  _id: u._id,
  name: u.name,
  phone: u.phone,
  staffRole: u.staffRole || STAFF_ROLES.OWNER,
  staffRoleLabel: STAFF_ROLE_LABEL[u.staffRole || STAFF_ROLES.OWNER],
  isOwner: (u.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER,
  permissions: (u.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER
    ? Object.values(PERMISSIONS)
    : (u.permissions || []),
  isActive: u.isActive !== false,
  lastLoginAt: u.lastLoginAt || null,
  createdAt: u.createdAt,
});

export async function listStaff(businessId) {
  const users = await User.find({ businessId, role: ROLES.WHOLESALER })
    .sort({ staffRole: 1, createdAt: 1 })
    .select('name phone staffRole permissions isActive lastLoginAt createdAt')
    .lean();

  // Malik hamesha sabse upar
  const rows = users.map(shape).sort((a, b) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0));

  return {
    staff: rows,
    roles: Object.values(STAFF_ROLES).map((r) => ({
      value: r,
      label: STAFF_ROLE_LABEL[r],
      defaultPermissions: ROLE_PERMISSIONS[r],
    })),
    permissions: Object.values(PERMISSIONS),
  };
}

export async function addStaff(businessId, payload, ownerId) {
  if (payload.staffRole === STAFF_ROLES.OWNER) {
    throw ApiError.badRequest('Doosra malik nahi ban sakta — Manager bana dijiye');
  }

  const phone = normalizePhone(payload.phone);

  // Ek number, ek hi account — poore system me
  const exists = await User.findOne({ phone });
  if (exists) {
    throw ApiError.conflict(
      'Ye number pehle se kisi account me hai. Staff ke liye doosra number use karein.'
    );
  }

  const user = new User({
    name: payload.name,
    phone,
    role: ROLES.WHOLESALER,
    businessId,
    staffRole: payload.staffRole,
    // Kuch chuna hai to wahi, warna role ka default
    permissions: payload.permissions?.length
      ? payload.permissions
      : ROLE_PERMISSIONS[payload.staffRole],
    createdByUserId: ownerId,
  });
  await user.setPassword(payload.password);
  await user.save();

  return shape(user.toObject());
}

async function findStaff(businessId, id) {
  const user = await User.findOne({ _id: id, businessId, role: ROLES.WHOLESALER });
  if (!user) throw ApiError.notFound('Ye staff nahi mila');
  return user;
}

export async function updateStaff(businessId, id, payload) {
  const user = await findStaff(businessId, id);

  if ((user.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER) {
    throw ApiError.badRequest('Malik ki settings yahan se nahi badalti');
  }
  if (payload.staffRole === STAFF_ROLES.OWNER) {
    throw ApiError.badRequest('Kisi ko malik nahi bana sakte');
  }

  if (payload.name !== undefined) user.name = payload.name;
  if (payload.phone !== undefined) user.phone = normalizePhone(payload.phone);

  // Role badla aur permission nahi bheji to naye role ka default lag jayega
  if (payload.staffRole !== undefined && payload.staffRole !== user.staffRole) {
    user.staffRole = payload.staffRole;
    if (!payload.permissions) user.permissions = ROLE_PERMISSIONS[payload.staffRole];
  }
  if (payload.permissions !== undefined) user.permissions = payload.permissions;
  if (payload.isActive !== undefined) user.isActive = payload.isActive;
  if (payload.password) await user.setPassword(payload.password);

  await user.save();
  return shape(user.toObject());
}

export async function removeStaff(businessId, id, ownerId) {
  const user = await findStaff(businessId, id);

  if ((user.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER) {
    throw ApiError.badRequest('Malik ko hata nahi sakte');
  }
  if (String(user._id) === String(ownerId)) {
    throw ApiError.badRequest('Khud ko nahi hata sakte');
  }

  const name = user.name;
  await user.deleteOne();
  return { deleted: true, message: `${name} ko hata diya` };
}

/** Staff khud apna password badle — purana password poochh kar */
export async function changeOwnPassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User nahi mila');

  const okPass = await user.checkPassword(currentPassword);
  if (!okPass) throw ApiError.badRequest('Purana password galat hai');

  await user.setPassword(newPassword);
  await user.save();
  return { changed: true };
}

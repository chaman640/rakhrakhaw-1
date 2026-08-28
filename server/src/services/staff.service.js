import crypto from 'crypto';
import ApiError from '../utils/ApiError.js';
import { assertSeat } from './billing.service.js';
import { normalizePhone } from '../utils/phone.js';
import { ROLES } from '../config/constants.js';
import {
  STAFF_ROLES, STAFF_ROLE_LABEL, STAFF_ROLE_HINT, ROLE_PERMISSIONS,
  ALL_PERMISSIONS, MODULE_ACTIONS, MODULE_LABEL, ACTION_LABEL,
  SCOPES, SCOPE_LABEL, DEFAULT_LIMITS,
  permissionsForRole, scopeForRole, limitsForRole, isValidPermission,
} from '../config/permissions.js';
import { limitsSummary } from '../utils/limits.js';
import { User, StaffInvite, Party, Business } from '../models/index.js';

/**
 * EK DUKAAN, KAI LOG.
 *
 * Signup karne wala MALIK hai. Wo apne log jodta hai — har ek ka apna phone,
 * apna password, apni ijazat, aur apni hadd.
 *
 * Do niyam jo poore system ki jaan hain:
 *
 *   1. MALIK KO KOI CHHED NAHI SAKTA — na hata sakta, na uska role badal
 *      sakta, khud bhi nahi. Warna ek galti se dukaan ka koi malik hi na
 *      bachta aur kisi ke paas settings ka rasta hi na rehta.
 *
 *   2. SAH-MALIK SIRF MALIK BANA SAKTA HAI. Agar sah-malik doosre sah-malik
 *      bana/hata pata, to ek sah-malik baaki sabko nikaal kar poori dukaan pe
 *      kabza kar leta. Isliye us ek kaam pe hamesha malik chahiye.
 */

const isOwnerRole = (role) => (role || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER;

const shape = (u) => {
  const role = u.staffRole || STAFF_ROLES.OWNER;
  const owner = isOwnerRole(role);
  return {
    _id: u._id,
    name: u.name,
    phone: u.phone,
    staffRole: role,
    staffRoleLabel: STAFF_ROLE_LABEL[role] || role,
    isOwner: owner,
    // Malik ki list khali padi ho tab bhi uske paas sab kuch hai — dikhate
    // waqt bhi wahi sach dikhna chahiye
    permissions: owner ? ALL_PERMISSIONS : (u.permissions || []),
    scope: owner ? SCOPES.ALL : (u.scope || SCOPES.ALL),
    scopeLabel: SCOPE_LABEL[owner ? SCOPES.ALL : (u.scope || SCOPES.ALL)],
    limits: owner ? { ...DEFAULT_LIMITS } : { ...DEFAULT_LIMITS, ...(u.limits || {}) },
    limitsSummary: limitsSummary(u),
    isActive: u.isActive !== false,
    lastLoginAt: u.lastLoginAt || null,
    createdAt: u.createdAt,
  };
};

/** Dashboard ko kya kya chunna hai — role, module, kaam, sab ek jagah */
export function staffMeta() {
  return {
    roles: Object.values(STAFF_ROLES).map((r) => ({
      value: r,
      label: STAFF_ROLE_LABEL[r],
      hint: STAFF_ROLE_HINT[r],
      assignable: r !== STAFF_ROLES.OWNER,
      defaultPermissions: ROLE_PERMISSIONS[r] || [],
      defaultScope: scopeForRole(r),
      defaultLimits: limitsForRole(r),
    })),
    modules: Object.entries(MODULE_ACTIONS).map(([key, actions]) => ({
      key,
      label: MODULE_LABEL[key] || key,
      actions: actions.map((a) => ({ key: a, label: ACTION_LABEL[a] || a, permission: `${key}:${a}` })),
    })),
    scopes: Object.values(SCOPES).map((s) => ({ value: s, label: SCOPE_LABEL[s] })),
  };
}

export async function listStaff(businessId) {
  const users = await User.find({ businessId, role: ROLES.WHOLESALER })
    .sort({ createdAt: 1 })
    .select('name phone staffRole permissions scope limits isActive lastLoginAt createdAt')
    .lean();

  // Malik hamesha sabse upar, phir sah-malik, phir baaki
  const rank = (r) => (r === STAFF_ROLES.OWNER ? 0 : r === STAFF_ROLES.ADMIN ? 1 : 2);
  const rows = users
    .map(shape)
    .sort((a, b) => rank(a.staffRole) - rank(b.staffRole));

  return { staff: rows, ...staffMeta() };
}

/* ─────────────────────────── kaun kya kar sakta hai ─────────────────────────── */

/**
 * Ye kaam karne wala is aadmi ko chhu bhi sakta hai ya nahi.
 *
 * `actor` — jo kaam kar raha hai
 * `role`  — jis role pe kaam ho raha hai
 */
function assertCanManageRole(actor, role) {
  if (isOwnerRole(role)) {
    throw ApiError.badRequest('Malik ko yahan se nahi badal sakte');
  }
  if (role === STAFF_ROLES.ADMIN && !isOwnerRole(actor?.staffRole)) {
    throw ApiError.forbidden(
      'Sah-malik sirf malik hi bana ya hata sakta hai. '
      + 'Warna ek sah-malik baaki sabko nikaal kar akela reh jata.'
    );
  }
}

/** Ijazat ki list saaf karo — galat naam chupchaap na ghus jaye */
function cleanPermissions(list, role) {
  if (!list) return permissionsForRole(role);
  const clean = [...new Set(list.filter(isValidPermission))];
  return clean;
}

function applyLimits(target, limits, role) {
  const base = limitsForRole(role);
  const merged = { ...base, ...(limits || {}) };
  // eslint-disable-next-line no-param-reassign
  target.limits = {
    maxDiscountPercent: merged.maxDiscountPercent ?? null,
    maxInvoiceAmount: merged.maxInvoiceAmount ?? null,
    canSellOnCredit: merged.canSellOnCredit !== false,
  };
}

/* ─────────────────────────── jodo / badlo / hatao ─────────────────────────── */

export async function addStaff(businessId, payload, actor) {
  /*
    SEAT KI JAANCH SABSE PEHLE (Step 1).

    Yahan pehle karte hain — invite bhejne, user banane aur password hash
    karne se PEHLE. Baad me karte to aadha kaam ho chuka hota aur use ulta
    karna padta; aur `BILLING_MODE=free` me ye line ek `if` se aage badh jati
    hai, isliye aaj iski koi keemat nahi hai.
  */
  await assertSeat(businessId);

  assertCanManageRole(actor, payload.staffRole);

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
    permissions: cleanPermissions(payload.permissions, payload.staffRole),
    scope: payload.scope || scopeForRole(payload.staffRole),
    createdByUserId: actor?._id || null,
  });
  applyLimits(user, payload.limits, payload.staffRole);

  await user.setPassword(payload.password);
  await user.save();

  return shape(user.toObject());
}

async function findStaff(businessId, id) {
  const user = await User.findOne({ _id: id, businessId, role: ROLES.WHOLESALER });
  if (!user) throw ApiError.notFound('Ye staff nahi mila');
  return user;
}

export async function updateStaff(businessId, id, payload, actor) {
  const user = await findStaff(businessId, id);

  // Jis pe kaam ho raha hai uska abhi wala role, aur naya role — dono pe check.
  // Sirf naya role dekhte to sah-malik doosre sah-malik ko "manager" bana kar
  // hata deta, aur niyam ka koi matlab hi na rehta.
  assertCanManageRole(actor, user.staffRole);
  if (payload.staffRole) assertCanManageRole(actor, payload.staffRole);

  if (payload.name !== undefined) user.name = payload.name;
  if (payload.phone !== undefined) {
    const phone = normalizePhone(payload.phone);
    const clash = await User.findOne({ phone, _id: { $ne: user._id } });
    if (clash) throw ApiError.conflict('Ye number pehle se kisi account me hai');
    user.phone = phone;
  }

  // Role badla aur ijazat nahi bheji to naye role ka default lag jayega
  if (payload.staffRole !== undefined && payload.staffRole !== user.staffRole) {
    user.staffRole = payload.staffRole;
    if (!payload.permissions) user.permissions = permissionsForRole(payload.staffRole);
    if (payload.scope === undefined) user.scope = scopeForRole(payload.staffRole);
    if (payload.limits === undefined) applyLimits(user, null, payload.staffRole);
  }

  if (payload.permissions !== undefined) {
    user.permissions = cleanPermissions(payload.permissions, user.staffRole);
  }
  if (payload.scope !== undefined) user.scope = payload.scope;
  if (payload.limits !== undefined) applyLimits(user, payload.limits, user.staffRole);
  if (payload.isActive !== undefined) user.isActive = payload.isActive;
  if (payload.password) await user.setPassword(payload.password);

  await user.save();
  return shape(user.toObject());
}

export async function removeStaff(businessId, id, actor) {
  const user = await findStaff(businessId, id);

  assertCanManageRole(actor, user.staffRole);

  if (String(user._id) === String(actor?._id)) {
    throw ApiError.badRequest('Khud ko nahi hata sakte');
  }

  // Iske naam wale retailer anaath na ho jayein — warna wo kisi ko dikhte hi
  // nahi (hadd wale staff ko bhi nahi, kyunki naam kisi aur ka hai)
  const freed = await Party.updateMany(
    { businessId, assignedToUserId: user._id },
    { $set: { assignedToUserId: null } }
  );

  const name = user.name;
  await user.deleteOne();

  return {
    deleted: true,
    freedParties: freed.modifiedCount || 0,
    message: freed.modifiedCount
      ? `${name} ko hata diya — inke naam wale ${freed.modifiedCount} retailer ab sabke hain`
      : `${name} ko hata diya`,
  };
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

/* ══════════════════════════════ INVITE LINK ══════════════════════════════ */

/**
 * Token banane ka tarika — bilkul API key jaisa.
 *
 * Asli token SIRF EK BAAR dikhta hai (jab link banti hai). Database me uska
 * hash jata hai. Isliye database dekh lene wala kisi ka staff account nahi
 * bana sakta.
 */
const makeToken = () => crypto.randomBytes(24).toString('base64url');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const inviteShape = (inv, link = null) => ({
  _id: inv._id,
  label: inv.label,
  staffRole: inv.staffRole,
  staffRoleLabel: STAFF_ROLE_LABEL[inv.staffRole] || inv.staffRole,
  permissions: inv.permissions || [],
  scope: inv.scope,
  limits: inv.limits,
  phone: inv.phone || '',
  expiresAt: inv.expiresAt,
  usedAt: inv.usedAt,
  cancelledAt: inv.cancelledAt,
  createdAt: inv.createdAt,
  status: inv.usedAt ? 'used'
    : inv.cancelledAt ? 'cancelled'
      : new Date(inv.expiresAt) < new Date() ? 'expired' : 'active',
  ...(link ? { link } : {}),
});

export async function createInvite(businessId, payload, actor, baseUrl) {
  assertCanManageRole(actor, payload.staffRole);

  const token = makeToken();
  const expiresAt = new Date(Date.now() + (payload.validDays || 7) * 24 * 60 * 60 * 1000);

  const invite = new StaffInvite({
    businessId,
    tokenHash: hashToken(token),
    label: payload.label || '',
    staffRole: payload.staffRole,
    permissions: cleanPermissions(payload.permissions, payload.staffRole),
    scope: payload.scope || scopeForRole(payload.staffRole),
    phone: payload.phone ? normalizePhone(payload.phone) : '',
    expiresAt,
    createdByUserId: actor?._id || null,
  });
  applyLimits(invite, payload.limits, payload.staffRole);
  await invite.save();

  // Link YAHIN ek baar banti hai. Baad me kabhi nahi mil sakti — token ka
  // hash hi rakha hai. Isliye jawab me saaf likh dete hain.
  return {
    ...inviteShape(invite, `${baseUrl}/join-staff/${token}`),
    warning: 'Ye link ab dobara nahi dikhegi — abhi copy karke bhej dijiye',
  };
}

export async function listInvites(businessId) {
  const rows = await StaffInvite.find({ businessId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return rows.map((r) => inviteShape(r));
}

export async function cancelInvite(businessId, id) {
  const invite = await StaffInvite.findOne({ _id: id, businessId });
  if (!invite) throw ApiError.notFound('Ye link nahi mili');
  if (invite.usedAt) throw ApiError.badRequest('Ye link istemal ho chuki hai');

  invite.cancelledAt = new Date();
  await invite.save();
  return { cancelled: true, message: 'Link rad kar di — ab ye nahi chalegi' };
}

/**
 * Link kholne par: kis dukaan ki hai, kis role ki hai.
 *
 * Ye rasta LOGIN SE PEHLE ka hai, isliye yahan se sirf utna hi batate hain
 * jitna judne wale ko chahiye — dukaan ka naam aur role. Ijazat ki poori
 * list, limits, ya kisi aur staff ka naam yahan nahi jata.
 */
export async function peekInvite(token) {
  const invite = await StaffInvite.findOne({ tokenHash: hashToken(token) }).lean();
  if (!invite) throw ApiError.notFound('Ye link sahi nahi hai');

  const status = invite.usedAt ? 'used'
    : invite.cancelledAt ? 'cancelled'
      : new Date(invite.expiresAt) < new Date() ? 'expired' : 'active';

  if (status !== 'active') {
    const why = {
      used: 'Ye link pehle hi istemal ho chuki hai',
      cancelled: 'Ye link rad kar di gayi hai',
      expired: 'Is link ka waqt nikal gaya',
    };
    throw ApiError.badRequest(`${why[status]}. Malik se nayi link mangwayein.`);
  }

  // Dukaan alag se nikalte hain, `populate` se nahi. Populate ek chhupa hua
  // jod hai — ref ka naam badle to chupchaap khali aa jata hai aur user ko
  // "Dukaan" likha dikhta hai, bina kisi error ke.
  const business = await Business.findById(invite.businessId).select('name logoUrl').lean();

  return {
    businessName: business?.name || 'Dukaan',
    logoUrl: business?.logoUrl || '',
    staffRole: invite.staffRole,
    staffRoleLabel: STAFF_ROLE_LABEL[invite.staffRole] || invite.staffRole,
    roleHint: STAFF_ROLE_HINT[invite.staffRole] || '',
    // Number pehle se bandha hua ho to form me wahi dikhega (badla nahi ja sakta)
    lockedPhone: invite.phone || '',
  };
}

/**
 * Link se account banana.
 *
 * Ek zaroori baat: link ko PEHLE claim karte hain (`usedAt` atomically set),
 * uske baad user banate hain. Ulta karte to do log ek hi link ek saath khol
 * kar do account bana lete — aur dono ko wahi ijazat mil jati.
 */
export async function acceptInvite(token, payload) {
  const tokenHash = hashToken(token);

  const phone = normalizePhone(payload.phone);

  const invite = await StaffInvite.findOne({ tokenHash }).lean();
  if (!invite) throw ApiError.notFound('Ye link sahi nahi hai');

  const usable = !invite.usedAt && !invite.cancelledAt && new Date(invite.expiresAt) > new Date();
  if (!usable) {
    throw ApiError.badRequest('Ye link ab nahi chalti. Malik se nayi link mangwayein.');
  }

  if (invite.phone && invite.phone !== phone) {
    throw ApiError.badRequest(
      'Ye link doosre number ke liye bheji gayi thi. Wahi number daalein jo malik ne bataya.'
    );
  }

  const exists = await User.findOne({ phone });
  if (exists) {
    throw ApiError.conflict('Is number se ek account pehle se hai. Doosra number use karein ya login karein.');
  }

  // ---- link ko pakad lo (ek hi baar chalegi) ----
  const claimed = await StaffInvite.findOneAndUpdate(
    { _id: invite._id, usedAt: null, cancelledAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  if (!claimed) {
    throw ApiError.badRequest('Ye link abhi abhi istemal ho gayi. Malik se nayi link mangwayein.');
  }

  try {
    const user = new User({
      name: payload.name,
      phone,
      role: ROLES.WHOLESALER,
      businessId: claimed.businessId,
      staffRole: claimed.staffRole,
      permissions: claimed.permissions,
      scope: claimed.scope,
      limits: claimed.limits,
      createdByUserId: claimed.createdByUserId,
    });
    await user.setPassword(payload.password);
    await user.save();

    await StaffInvite.updateOne({ _id: claimed._id }, { $set: { usedByUserId: user._id } });

    return { user, staff: shape(user.toObject()) };
  } catch (err) {
    // Account nahi bana to link wapas khol do — warna aadmi ke paas na account
    // hai na chalne wali link, aur malik ko dobara banani padegi
    await StaffInvite.updateOne({ _id: claimed._id }, { $set: { usedAt: null } });
    throw err;
  }
}

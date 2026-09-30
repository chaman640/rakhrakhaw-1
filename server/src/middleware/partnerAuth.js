import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { readPartnerToken } from '../services/partner.service.js';
import { readAdminToken } from '../services/partnerAdmin.service.js';
import { Salesman } from '../models/index.js';
import { permsOfRole } from '../config/adminRoles.js';

/*
  Salesman aur admin ke apne pehre — dukaan wale `protect` se BILKUL alag.

  Ek hi pehra dono ke liye banane ka matlab hota har jagah "agar salesman hai
  to..." likhna, aur unme se ek din ek jagah chhoot jana. Alag pehra rakhne se
  wo galti ho hi nahi sakti: salesman ka token dukaan wale raste pe chalta hi
  nahi, aur dukaan wale ka token yahan.
*/

function readToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export const requireSalesman = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  const d = readPartnerToken(token);
  const sm = await Salesman.findById(d.sub).lean();
  if (!sm) throw ApiError.unauthorized();
  if (!sm.active) throw ApiError.forbidden('Aapka account band kar diya gaya hai');

  // Password badla ho to purani chaabi yahin ruk jati hai
  if ((d.ts || 0) !== (sm.tokenSeq || 0)) {
    throw ApiError.unauthorized('Dobara login karein');
  }

  req.salesman = sm;
  return next();
});

// Setup poora na hua ho tab bhi ye raste khule (2FA lagana, apni jaankari, logout)
const SETUP_OPEN = ['/admin/me', '/admin/2fa', '/admin/logout', '/admin/password'];

export const requirePartnerAdmin = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();
  let d;
  try { d = readAdminToken(token); } catch { throw ApiError.unauthorized('Please sign in again'); }
  const { PartnerAdmin } = await import('../models/index.js');
  const admin = await PartnerAdmin.findById(d.sub).select('tokenSeq role active require2fa totpEnabled email').lean();
  if (!admin || admin.active === false) throw ApiError.unauthorized('This admin account is disabled');
  if ((d.ts || 0) !== (admin.tokenSeq || 0)) throw ApiError.unauthorized('Please sign in again');
  const path = req.originalUrl.replace(/^\/api\/partner/, '').split('?')[0];
  if (admin.require2fa && !admin.totpEnabled && !SETUP_OPEN.some((p) => path.startsWith(p))) {
    throw ApiError.forbidden('Turn on two-step verification to continue', { reason: 'setup_2fa' });
  }
  req.adminId = d.sub;
  req.admin = { id: d.sub, role: admin.role || 'super', email: admin.email, perms: permsOfRole(admin.role || 'super') };
  return next();
});

/** Is admin ke role me ye kaam hai? Koi ek bhi mil jaye to chalega */
export const requireAdminPerm = (...perms) => (req, res, next) => {
  if (perms.some((p) => req.admin?.perms?.includes(p))) return next();
  return next(ApiError.forbidden('Your admin role does not allow this', { needed: perms }));
};

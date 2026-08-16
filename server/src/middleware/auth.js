import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.js';
import { ROLES } from '../config/constants.js';
import {
  STAFF_ROLES, MODULE_LABEL, ACTION_LABEL, userCan as permCheck,
} from '../config/permissions.js';

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

// Login zaroori — req.user set karta hai
export const protect = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  const decoded = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(decoded.sub).lean();

  if (!user) throw ApiError.unauthorized('User nahi mila');
  if (!user.isActive) throw ApiError.forbidden('Aapka account band kar diya gaya hai');

  req.user = user;
  next();
});

// Role check — protect ke baad lagana
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Ye page aapke role ke liye nahi hai'));
  }
  next();
};

/**
 * Staff ki ijazat ka check.
 *
 * `protect` .lean() use karta hai isliye model ka `.can()` yahan milta hi
 * nahi — isliye asli faisla `config/permissions.js` ke `userCan()` se hota
 * hai, jo plain object pe bhi chalta hai. Poore app me faisla lene ki jagah
 * wahi ek hai.
 */
export { userCan } from '../config/permissions.js';

/**
 * Ek kaam ki ijazat maango — `requirePermission('invoices:create')`.
 *
 * Do naam bhi de sakte hain, tab kisi EK ka hona kaafi hai:
 *   requirePermission('khata:create', 'khata:edit')
 *
 * Mana karte waqt error me saaf likha jata hai ki kis cheez ki ijazat nahi
 * mili — warna staff ko sirf "ijazat nahi hai" dikhta hai aur malik ko phone
 * karke pata hi nahi chalta ki kaunsa checkbox lagana hai.
 */
export const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());

  const allowed = permissions.some((p) => permCheck(req.user, p));
  if (!allowed) {
    const [first] = permissions;
    const [module, action] = String(first).split(':');
    const what = `${MODULE_LABEL[module] || module} — ${ACTION_LABEL[action] || action}`;
    return next(ApiError.forbidden(
      `Aapko is kaam ki ijazat nahi hai (${what}). Malik se kahiye ki Settings → Staff me de dein.`,
      { needed: permissions }
    ));
  }
  next();
};

/** Sirf malik — staff add karna, backup lena, business profile badalna */
export const requireOwner = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== ROLES.WHOLESALER
    || (req.user.staffRole || STAFF_ROLES.OWNER) !== STAFF_ROLES.OWNER) {
    return next(ApiError.forbidden('Ye sirf dukaan ke malik kar sakte hain'));
  }
  next();
};

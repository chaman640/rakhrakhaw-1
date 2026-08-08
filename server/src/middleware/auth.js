import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.js';
import { ROLES, STAFF_ROLES } from '../config/constants.js';

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
 * Staff ki permission check (Part 11).
 *
 * `protect` .lean() use karta hai isliye model ka .can() yahan nahi milta —
 * wahi logic plain object pe:
 *   - owner  -> hamesha haan
 *   - staff  -> uske permissions array me hona chahiye
 */
export function userCan(user, permission) {
  if (!user || user.role !== ROLES.WHOLESALER) return false;
  if ((user.staffRole || STAFF_ROLES.OWNER) === STAFF_ROLES.OWNER) return true;
  return (user.permissions || []).includes(permission);
}

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!userCan(req.user, permission)) {
    return next(ApiError.forbidden('Aapko is kaam ki ijazat nahi hai — malik se kahiye'));
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

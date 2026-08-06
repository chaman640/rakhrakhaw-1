import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.js';

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

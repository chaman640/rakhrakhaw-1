import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server error';
  let details = err.details || null;

  // Mongoose validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {}).join(', ');
    message = `Ye ${field} pehle se maujud hai`;
  }

  // Bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Galat ${err.path}: ${err.value}`;
  }

  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Session khatam ho gaya, dobara login karein'; }

  if (statusCode >= 500) console.error('[error]', err);

  res.status(statusCode).json({
    success: false,
    message,
    details,
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}

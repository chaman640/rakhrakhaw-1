import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export function notFoundHandler(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Duplicate key ki samajh me aane wali baat.
 *
 * Mongo sirf index ka naam batata hai. Wo naam seedha screen pe daal dein to
 * ajeeb messages aate hain — jaise "Ye email pehle se maujud hai" jabki app me
 * email maanga hi nahi gaya (aisa tab hota hai jab database me kisi purane
 * project ka index pada ho).
 */
const FIELD_NAMES = {
  phone: 'Ye phone number pehle se registered hai',
  gstin: 'Ye GST number pehle se juda hua hai',
  invoiceNo: 'Is number ka bill pehle se hai',
  purchaseNo: 'Is number ki purchase entry pehle se hai',
  orderNo: 'Is number ka order pehle se hai',
  paymentNo: 'Is number ki payment pehle se hai',
  returnNo: 'Is number ka return note pehle se hai',
  name: 'Ye naam pehle se maujud hai',
};

function duplicateMessage(fields) {
  // Ek hi kaam ka field ho to seedha uska message
  for (const f of fields) {
    if (FIELD_NAMES[f]) return FIELD_NAMES[f];
  }
  // Aisa field jo hamare app me hai hi nahi -> database me purana index pada hai
  return (
    'Database me kisi purane project ka index pada hua hai ' +
    `(${fields.join(', ') || 'unknown'}), isliye entry save nahi ho paayi. ` +
    'Server ek baar restart karein — wo khud saaf kar deta hai. ' +
    'Phir bhi rahe to MONGO_URI me database ka naam badal dein.'
  );
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
    const fields = Object.keys(err.keyPattern || {});
    message = duplicateMessage(fields);
    if (env.isProd) console.error('[dup]', err.message);   // asli index ka naam log me
  }

  // Bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Galat ${err.path}: ${err.value}`;
  }

  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid token'; }
  if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Session khatam ho gaya, dobara login karein'; }

  if (statusCode >= 500) console.error('[error]', err);

  // Stack sirf apne computer pe. NODE_ENV set karna bhool jayein tab bhi
  // internet pe khuli site se code ka andar bahar nahi jana chahiye.
  const host = String(req.get('host') || '');
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const showStack = !env.isProd && isLocal;

  res.status(statusCode).json({
    success: false,
    message,
    details,
    ...(showStack ? { stack: err.stack } : {}),
  });
}

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import IdempotencyKey from '../models/IdempotencyKey.js';

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const STALE_MS = 2 * 60 * 1000; // a "pending" row older than this belongs to a request that died

function userIdFrom(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.cookies?.token;
  if (!token) return null;
  try { return jwt.verify(token, env.jwtSecret).sub || null; } catch { return null; }
}

/**
 * Replays the saved answer when a write arrives again with the same `Idempotency-Key`.
 * Without the header (or without a valid login) the request passes through untouched.
 */
export async function idempotency(req, res, next) {
  const key = String(req.headers['idempotency-key'] || '').trim();
  if (!key || !WRITE.has(req.method) || key.length > 100) return next();
  const userId = userIdFrom(req);
  if (!userId) return next();

  const path = req.originalUrl.split('?')[0];
  try {
    await IdempotencyKey.create({ userId, key, method: req.method, path });
  } catch (err) {
    if (err?.code !== 11000) return next(err);
    const prev = await IdempotencyKey.findOne({ userId, key }).lean();
    if (prev && (prev.method !== req.method || prev.path !== path)) {
      return res.status(422).json({ success: false, message: 'Idempotency-Key was already used for a different request' });
    }
    if (prev?.status === 'done') {
      res.set('Idempotent-Replay', 'true');
      return res.status(prev.code).json(prev.body);
    }
    if (prev && Date.now() - new Date(prev.createdAt).getTime() < STALE_MS) {
      return res.status(409).json({ success: false, message: 'This entry is still being saved — please wait a moment', details: { reason: 'in_progress' } });
    }
    await IdempotencyKey.deleteOne({ userId, key });
    await IdempotencyKey.create({ userId, key, method: req.method, path });
  }

  let body;
  const json = res.json.bind(res);
  res.json = (b) => { body = b; return json(b); };
  res.on('finish', () => {
    // Server faults are not remembered, so the phone can try again later
    const p = res.statusCode >= 500
      ? IdempotencyKey.deleteOne({ userId, key })
      : IdempotencyKey.updateOne({ userId, key }, { $set: { status: 'done', code: res.statusCode, body: body ?? null } });
    p.catch(() => {});
  });
  next();
}

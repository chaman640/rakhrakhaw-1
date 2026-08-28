import crypto from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';

/**
 * Razorpay ka adapter — SIRF is file me Razorpay ka naam hai.
 *
 * billing.service.js ko provider ka pata nahi hona chahiye; provider badla to
 * sirf ye file badle.
 */

const API = 'https://api.razorpay.com/v1';

export const razorpayReady = () =>
  Boolean(env.razorpay.keyId && env.razorpay.keySecret);

function authHeader() {
  const raw = `${env.razorpay.keyId}:${env.razorpay.keySecret}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

async function call(path, { method = 'GET', body } = {}) {
  if (!razorpayReady()) throw ApiError.badRequest('Payment ki setting adhoori hai');

  // 15s ki hadd — bina iske ek atki hui request poore request ko latka deti hai
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      signal: ac.signal,
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw ApiError.badRequest(
        data?.error?.description || 'Payment shuru nahi ho paya, dobara koshish karein',
        { provider: 'razorpay', code: data?.error?.code || null },
      );
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw ApiError.badRequest('Payment company se jawab nahi aaya, dobara koshish karein');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** `receipt` hamara apna id hai — webhook aur verify dono isi se milte hain */
export function createOrder({ amountPaise, receipt, notes }) {
  return call('/orders', {
    method: 'POST',
    body: {
      amount: Math.round(amountPaise),
      currency: 'INR',
      receipt: String(receipt).slice(0, 40),
      payment_capture: 1,
      notes: notes || {},
    },
  });
}

export function fetchPayment(paymentId) {
  return call(`/payments/${paymentId}`);
}

/** Checkout ke baad browser jo bhejta hai — uska HMAC */
export function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expect = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expect, signature);
}

/** Webhook ka HMAC — RAW body chahiye, parse kiya hua nahi */
export function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpay.webhookSecret || !signature) return false;
  const expect = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expect, signature);
}

/**
 * Lambai barabar hone par hi `timingSafeEqual` chalta hai, warna wo khud
 * throw karta hai — aur wo throw bhi ek jawab hai jo hamla karne wale ko
 * kuch bata deta hai.
 */
function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

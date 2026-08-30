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


/* ═══════════════════ AUTOPAY (Razorpay Subscriptions) ═══════════════════

   Ek baar ka order aur autopay do alag cheezein hain:

     Order        — ek baar paisa liya, khatam.
     Subscription — grahak ek baar "mandate" deta hai (UPI Autopay / card),
                    aur uske baad Razorpay har mahine KHUD paisa kaatta hai.

   Isme humein har mahine kuch nahi karna. Paisa kata ya nahi kata — dono ki
   khabar webhook se aati hai, aur wahi asli sach hai.
   ═════════════════════════════════════════════════════════════════════════ */

/**
 * Razorpay ka apna "plan" — daam aur mahine ki ikai.
 *
 * Ye hamare plan se alag cheez hai. Hamara plan `config/billing.js` me hai;
 * ye uska Razorpay wala jodidaar hai, jiska id mandate banate waqt chahiye.
 * Ek baar ban jaye to wahi chalta rehta hai (mapping DB me rakhi jati hai).
 */
export function createPlan({ code, name, pricePaise }) {
  return call('/plans', {
    method: 'POST',
    body: {
      period: 'monthly',
      interval: 1,
      item: {
        name: `Rakh Rakhav — ${name}`,
        amount: Math.round(pricePaise),
        currency: 'INR',
        description: `${name} plan, har mahine`,
      },
      notes: { planCode: code },
    },
  });
}

/**
 * Mandate banao.
 *
 * `total_count` ka matlab "kitne mahine tak chalega". Razorpay isse anginat
 * nahi rakhne deta, isliye 120 (10 saal) rakha hai — itne me plan khud hi
 * kai baar badal chuka hoga.
 *
 * `customer_notify: 0` — khabar hum khud dete hain (app me), Razorpay ka
 * apna SMS/email nahi. Do jagah se do alag baatein aana grahak ko uljhata
 * hai, aur SMS ka bill bhi banta hai.
 */
export function createSubscription({ planId, notes, totalCount = 120 }) {
  return call('/subscriptions', {
    method: 'POST',
    body: {
      plan_id: planId,
      total_count: totalCount,
      quantity: 1,
      customer_notify: 0,
      notes: notes || {},
    },
  });
}

export function fetchSubscription(subId) {
  return call(`/subscriptions/${subId}`);
}

/**
 * Plan badalna — mandate wahi rehta hai, sirf daam badalta hai.
 *
 * `schedule_change_at`:
 *   'now'        -> abhi (bada plan lene par — grahak turant istemal karega)
 *   'cycle_end'  -> mahine ke aakhir me (chhota plan lene par — jo paisa de
 *                   chuke hain uska poora fayda milna chahiye)
 *
 * Isse grahak ko dobara mandate nahi dena padta — aur wahi sabse badi baat
 * hai, kyunki har baar mandate maangne pe aadha aadmi wahin chhod deta hai.
 */
export function updateSubscriptionPlan(subId, { planId, when = 'now' }) {
  return call(`/subscriptions/${subId}`, {
    method: 'PATCH',
    body: {
      plan_id: planId,
      quantity: 1,
      schedule_change_at: when === 'cycle_end' ? 'cycle_end' : 'now',
      customer_notify: 0,
    },
  });
}

/**
 * Rukka hua plan-badlav rad karo.
 *
 * Razorpay pe jab tak koi badlav "scheduled" pada hai, uspe doosra PATCH
 * chalta hi nahi — wo mana kar deta hai. Isliye "Rehne dein" ke liye seedha
 * ye API chahiye; pehle wahan doosra PATCH bheja jata tha jo hamesha fail
 * hota, aur downgrade phir bhi mahine ke aakhir me lag jata.
 */
export function cancelScheduledChange(subId) {
  return call(`/subscriptions/${subId}/cancel_scheduled_changes`, { method: 'POST' });
}

/** `atCycleEnd` = mahine ke aakhir tak sab chalta rahega, phir band */
export function cancelSubscriptionAt(subId, atCycleEnd = true) {
  return call(`/subscriptions/${subId}/cancel`, {
    method: 'POST',
    body: { cancel_at_cycle_end: atCycleEnd ? 1 : 0 },
  });
}

/**
 * Mandate ke baad browser jo bhejta hai — uska HMAC.
 *
 * Dhyan dijiye: order wale se kram ULTA hai. Order me `orderId|paymentId`
 * hota hai, subscription me `paymentId|subscriptionId`. Ye Razorpay ka apna
 * niyam hai, aur ise ulta likh dena wo bug hai jo har payment ko "galat
 * saboot" bata deta hai.
 */
export function verifySubscriptionSignature({ subscriptionId, paymentId, signature }) {
  if (!subscriptionId || !paymentId || !signature) return false;
  const expect = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return safeEqual(expect, signature);
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

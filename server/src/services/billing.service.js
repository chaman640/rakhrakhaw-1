import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { cacheGet, cacheSet } from '../utils/cache.js';
import {
  createOrder, verifyCheckoutSignature, verifyWebhookSignature,
} from './razorpay.service.js';
import { ROLES } from '../config/constants.js';
import {
  BILLING_MODES, PLANS, PAID_PLANS, PLAN_BY_CODE, FREE_PLAN,
  SUB_STATUS, seatsOf, seatsAllow, rupees,
} from '../config/billing.js';
import { Subscription, User, BillingOrder } from '../models/index.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * "IS DUKAAN KA PAISA CHUKTA HAI YA NAHI" — POORE APP ME EK HI JAWAB.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Poora billing sirf DO sawal pe khada hai:
 *
 *     1. is dukaan ki mohlat baaki hai?          ->  subscriptionOf()
 *     2. itne account is plan me aayenge?        ->  assertSeat()
 *
 * Baaki sab (Razorpay, webhook, renew) inhi do ke upar rakha jayega. Isliye
 * ye file jaan-boojh kar chhoti hai aur ismein kisi payment company ka naam
 * tak nahi hai — provider badalne pe ye file waisi ki waisi rehni chahiye.
 */

const isFreeMode = () => env.billing.mode === BILLING_MODES.FREE;

/* ─────────────────────────────────────────────── plan ki list (public) */

export function planCatalog() {
  const hit = cacheGet('plans');
  if (hit) return hit;
  return cacheSet('plans', {
    mode: env.billing.mode,
    /*
      Free mode me bhi POORI list jati hai, bas `chargingNow: false` ke saath.

      Wajah: pricing ka page tab bhi khulna chahiye. Razorpay merchant account
      ke liye daam ka page bina login ke dikhna zaroori hai — aur wo page tab
      banana padta hai jab abhi paisa liya hi nahi ja raha.
    */
    chargingNow: !isFreeMode(),
    graceDays: env.billing.graceDays,
    plans: PLANS.map((p) => ({
      ...p,
      priceRupees: rupees(p.pricePaise),
      // "jitne chahein" ko number me badal kar bhejna sabse aasan galti hai
      unlimited: p.seats === null,
    })),
  }, 3600000);
}

/* ─────────────────────────────────────────── ek dukaan ki haalat */

/**
 * Haalat TAREEKH se nikalti hai, kisi field se nahi.
 *
 * Ek `status` alag se rakh kar use cron se badalna — wahi hai jahan aise
 * system tootte hain. Cron ek din na chale to ya to sabki dukaan band ho jati
 * hai, ya kisi ki bhi band nahi hoti. Tareekh se nikala hua jawab kabhi purana
 * nahi hota, aur cron ki zarurat hi nahi padti.
 */
export function statusOf(sub, now = new Date()) {
  if (!sub || !sub.paidTill) return SUB_STATUS.EXPIRED;
  if (sub.cancelledAt && !sub.autoRenew && sub.paidTill < now) return SUB_STATUS.CANCELLED;

  if (sub.paidTill >= now) return SUB_STATUS.ACTIVE;

  const graceTill = new Date(sub.paidTill);
  graceTill.setDate(graceTill.getDate() + env.billing.graceDays);
  return graceTill >= now ? SUB_STATUS.GRACE : SUB_STATUS.EXPIRED;
}

/** Dukaan ka chalu hona — grace me bhi sab chalta hai, bas yaad dilaya jata hai */
export function isUsable(status) {
  return status === SUB_STATUS.ACTIVE || status === SUB_STATUS.GRACE;
}

export async function subscriptionOf(businessId) {
  const sub = await Subscription.findOne({ businessId }).lean();
  const status = statusOf(sub);
  const planCode = sub?.planCode || FREE_PLAN.code;
  const plan = PLAN_BY_CODE[planCode] || FREE_PLAN;

  return {
    sub,
    plan,
    planCode,
    status,
    /*
      FREE MODE ME SABKA JAWAB "HAAN" HAI.

      Ye ek line poore switch ka dil hai. Jab tak `BILLING_MODE=free` hai, is
      poore system ka koi asar nahi padta — na kisi ko rok, na kisi ko sandesh.
      Data phir bhi bilkul waise hi banta rehta hai, isliye jis din switch
      badlega us din kuch "shuru" nahi karna padega, sirf rok lagni shuru ho
      jayegi.
    */
    usable: isFreeMode() || isUsable(status),
    chargingNow: !isFreeMode(),
    seats: sub?.seats ?? seatsOf(planCode),
    paidTill: sub?.paidTill || null,
    daysLeft: sub?.paidTill
      ? Math.ceil((new Date(sub.paidTill) - Date.now()) / 86400000)
      : null,
  };
}

/* ───────────────────────────────────────────────── account ki ginti */

/**
 * Is dukaan me kitne LOGIN karne wale log hain — malik samet.
 *
 * Retailer yahan KABHI nahi aate, chahe hazaar hon. Wo dukaan ke apne log
 * nahi, graahak hain — aur unse paisa lena poore dhande ko hi maar deta hai
 * (poori wajah `config/billing.js` me).
 *
 * Band kiye hue staff bhi nahi ginte. Ek aadmi ke jaane ke baad bhi uski seat
 * ghere rakhna dukaandaar ke liye seedha jhooth hai.
 */
export async function seatsUsed(businessId) {
  return User.countDocuments({
    businessId,
    role: ROLES.WHOLESALER,
    isActive: true,
  });
}

/**
 * "Ek aur aadmi jodna hai" — aayega ya nahi.
 *
 * `extra` isliye ki bulane wale alag alag pal pe poochte hain: naya staff
 * jodte waqt (abhi wo bana nahi, isliye +1) aur band pade staff ko chalu karte
 * waqt (wo ginti me hai hi nahi, isliye bhi +1). Ek hi jagah se poochne ka
 * matlab hai ki dono jagah `<` aur `<=` ka jhagda nahi hoga.
 */
export async function assertSeat(businessId, { extra = 1 } = {}) {
  if (isFreeMode()) return;

  const { planCode, plan } = await subscriptionOf(businessId);
  const max = seatsOf(planCode);
  if (max === null) return;

  const used = await seatsUsed(businessId);
  if (seatsAllow(planCode, used + extra)) return;

  /*
    Error me AGLA PLAN bhi bhejte hain.

    "Limit poori ho gayi" ek band darwaza hai. Uske saath ye bhej dena ki
    "agla plan ₹100 ka hai aur usme 10 account aate hain" — us pal ko rukawat
    se faisle me badal deta hai. App wahin se seedha plan wale page pe le ja
    sakta hai.
  */
  const next = PAID_PLANS.find((p) => p.seats === null || p.seats > max);

  throw ApiError.badRequest(
    `Aapke "${plan.name}" plan me ${max} account aate hain, aur ${used} pehle se hain.`
    + (next
      ? ` "${next.name}" me ${next.seats === null ? 'jitne chahein' : `${next.seats} account`} — ₹${rupees(next.pricePaise)}/mahina.`
      : ''),
    {
      reason: 'seat_limit',
      planCode, used, max,
      nextPlan: next ? { code: next.code, name: next.name, seats: next.seats, priceRupees: rupees(next.pricePaise) } : null,
    },
  );
}

/* ────────────────────────────────────── bechne ka darwaza */

/**
 * "Ye dukaan bech sakti hai ya nahi."
 *
 * Kharidne wale hisse pe ye kabhi nahi lagta — wo hamesha free hai. Sirf
 * bechne wala hissa (apna stock, apna bill, apne retailer) isse guzarta hai.
 *
 * Jawab me `reason` aur `plans` dono jate hain, taaki app ek adha-adhoora
 * error dikhane ki jagah seedha wahi screen khol sake jahan se aadmi plan le
 * sakta hai. Rok tabhi kaam ki hai jab uske saath aage ka rasta bhi ho.
 */
export async function assertCanSell(businessId) {
  if (isFreeMode()) return;

  const state = await subscriptionOf(businessId);
  if (state.usable) return;

  throw ApiError.forbidden(
    state.status === SUB_STATUS.EXPIRED && state.paidTill
      ? 'Aapke plan ki mohlat khatam ho gayi hai. Bechne ka kaam chalu karne ke liye plan lein.'
      : 'Bechne ka kaam chalu karne ke liye plan lein. Kharidna hamesha free hai.',
    {
      reason: 'subscription_required',
      status: state.status,
      paidTill: state.paidTill,
      plans: PAID_PLANS.map((p) => ({
        code: p.code, name: p.name, seats: p.seats,
        priceRupees: rupees(p.pricePaise), tagline: p.tagline, popular: Boolean(p.popular),
      })),
    },
  );
}

/* ────────────────────────────────────── mohlat badhana */

/**
 * Paisa mila — mohlat aage badha do.
 *
 * Ye Razorpay ke baare me kuch nahi jaanta, aur ye jaan-boojh kar hai. Step 2
 * me webhook sirf itna karega: "sach me paisa aaya" ye pakka karke YAHI
 * function bulayega. Isliye provider badalne pe billing ka asli hisaab chhuta
 * bhi nahi.
 *
 * MOHLAT KAHAN SE GINI JATI HAI — ye chhota faisla bada farak laata hai:
 * agar mohlat abhi baaki hai to nayi mohlat USI DIN SE judti hai (aadmi ka
 * bacha hua din mara nahi jata), aur khatam ho chuki hai to AAJ se. Aaj se hi
 * ginte to jaldi renew karne wale ko saza milti — aur wahi aadmi sabse achha
 * graahak hai.
 */
export async function extendSubscription(businessId, {
  planCode, months = 1, payment = null, note = '',
}) {
  const plan = PLAN_BY_CODE[planCode];
  if (!plan || plan.pricePaise <= 0) throw ApiError.badRequest('Aisa koi plan nahi hai');

  const now = new Date();
  const existing = await Subscription.findOne({ businessId });

  const from = existing?.paidTill && existing.paidTill > now ? new Date(existing.paidTill) : now;
  const paidTill = new Date(from);
  paidTill.setMonth(paidTill.getMonth() + Number(months || 1));

  const patch = {
    planCode: plan.code,
    pricePaise: plan.pricePaise,
    seats: plan.seats,
    paidTill,
    autoRenew: true,
    cancelledAt: null,
    ...(note ? { note } : {}),
    ...(payment ? { lastPayment: { ...payment, at: new Date() } } : {}),
  };

  return Subscription.findOneAndUpdate(
    { businessId },
    { $set: patch, $setOnInsert: { businessId, startedAt: now } },
    { new: true, upsert: true },
  ).lean();
}

/** Malik ne aage renew band kiya — mohlat khatam hone tak sab chalta rahega */
export async function cancelSubscription(businessId) {
  const sub = await Subscription.findOneAndUpdate(
    { businessId },
    { $set: { autoRenew: false, cancelledAt: new Date() } },
    { new: true },
  ).lean();
  if (!sub) throw ApiError.notFound('Koi plan chalu nahi hai');
  return sub;
}

/** App ko dikhane ke liye poori halat — Settings ka billing wala hissa */
export async function billingSummary(businessId) {
  const state = await subscriptionOf(businessId);
  const used = await seatsUsed(businessId);

  return {
    mode: env.billing.mode,
    chargingNow: state.chargingNow,
    status: state.status,
    usable: state.usable,
    plan: {
      code: state.plan.code,
      name: state.plan.name,
      seats: state.plan.seats,
      unlimited: state.plan.seats === null,
      priceRupees: rupees(state.plan.pricePaise),
    },
    seatsUsed: used,
    seatsLeft: state.plan.seats === null ? null : Math.max(0, state.plan.seats - used),
    paidTill: state.paidTill,
    daysLeft: state.daysLeft,
    autoRenew: state.sub?.autoRenew ?? true,
    graceDays: env.billing.graceDays,
    lastPayment: state.sub?.lastPayment?.at ? state.sub.lastPayment : null,
  };
}

/* ═════════════════════════════ paisa lena (Step 2) ═════════════════════════ */

/**
 * Checkout shuru — order banao aur browser ko dene layak cheezein wapas do.
 *
 * Rakam SERVER pe tay hoti hai, client se aayi rakam kabhi nahi maani jati.
 */
export async function startCheckout(businessId, { planCode, months = 1 }, userId = null) {
  if (isFreeMode()) throw ApiError.badRequest('Abhi paisa liya hi nahi ja raha — poori app free hai');

  const plan = PLAN_BY_CODE[planCode];
  if (!plan || plan.pricePaise <= 0) throw ApiError.badRequest('Aisa koi plan nahi hai');

  const m = Math.max(1, Math.min(12, Number(months) || 1));
  const amountPaise = plan.pricePaise * m;

  const doc = await BillingOrder.create({
    businessId, planCode: plan.code, months: m, amountPaise, createdBy: userId,
  });

  try {
    const order = await createOrder({
      amountPaise,
      receipt: String(doc._id),
      notes: { businessId: String(businessId), planCode: plan.code, months: String(m) },
    });
    doc.providerOrderId = order.id;
    await doc.save();

    return {
      orderId: order.id,
      amountPaise,
      amountRupees: rupees(amountPaise),
      currency: 'INR',
      keyId: env.razorpay.keyId,          // public key — browser me jana hi hai
      planCode: plan.code,
      planName: plan.name,
      months: m,
      ourOrderId: String(doc._id),
    };
  } catch (err) {
    await BillingOrder.updateOne(
      { _id: doc._id },
      { $set: { status: 'failed', failReason: err.message?.slice(0, 200) || 'order nahi bana' } },
    );
    throw err;
  }
}

/**
 * Paisa chuka — plan chalu karo. Ek hi order pe DO baar nahi chalega.
 *
 * `status: 'created'` filter ke andar hai, isliye MongoDB do me se ek hi
 * request ko doc deta hai. Doosri ko `null` milta hai aur wo chup-chaap
 * "pehle se ho chuka" maan leti hai — verify aur webhook dono aksar saath
 * aate hain, aur ye us halat ka seedha jawab hai.
 */
async function activate(orderDoc, paymentId) {
  const claimed = await BillingOrder.findOneAndUpdate(
    { _id: orderDoc._id, status: 'created' },
    {
      $set: {
        status: 'paid',
        providerPaymentId: paymentId || '',
        paidAt: new Date(),
        receiptNo: `RR-${String(orderDoc._id).slice(-8).toUpperCase()}`,
      },
    },
    { new: true },
  );
  if (!claimed) return { alreadyDone: true };

  await extendSubscription(claimed.businessId, {
    planCode: claimed.planCode,
    months: claimed.months,
    payment: {
      provider: 'razorpay',
      orderId: claimed.providerOrderId,
      paymentId: paymentId || '',
      amountPaise: claimed.amountPaise,
    },
  });

  return { alreadyDone: false, order: claimed };
}

/** Browser checkout ke baad — signature theek hai to plan chalu */
export async function confirmCheckout(businessId, { orderId, paymentId, signature }) {
  if (!verifyCheckoutSignature({ orderId, paymentId, signature })) {
    throw ApiError.badRequest('Payment ka saboot theek nahi hai — paisa kata ho to hum khud dekh lenge');
  }

  const doc = await BillingOrder.findOne({ providerOrderId: orderId, businessId });
  if (!doc) throw ApiError.notFound('Ye payment hamare record me nahi hai');

  await activate(doc, paymentId);
  return billingSummary(businessId);
}

/**
 * Razorpay ka webhook — ASLI sach yahi hai.
 *
 * Browser wala rasta bharosemand nahi: net kat sakta hai, tab band ho sakta
 * hai, aadmi wapas aa hi na. Webhook har haal me aata hai, isliye plan chalu
 * karne ka asli zimma isi ka hai — browser wala rasta sirf turant dikhane ke
 * liye hai.
 */
export async function handleWebhook(rawBody, signature) {
  if (!verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.unauthorized('Webhook ka saboot theek nahi hai');
  }

  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw ApiError.badRequest('Webhook padha nahi gaya'); }

  const kind = event?.event || '';
  const payment = event?.payload?.payment?.entity;
  if (!payment) return { ignored: kind };

  const doc = await BillingOrder.findOne({ providerOrderId: payment.order_id });
  if (!doc) return { ignored: 'order nahi mila' };

  if (kind === 'payment.captured' || kind === 'order.paid') {
    const r = await activate(doc, payment.id);
    return { ok: true, alreadyDone: r.alreadyDone };
  }

  if (kind === 'payment.failed') {
    await BillingOrder.updateOne(
      { _id: doc._id, status: 'created' },
      { $set: { status: 'failed', failReason: payment.error_description?.slice(0, 200) || 'fail' } },
    );
    return { ok: true, failed: true };
  }

  return { ignored: kind };
}

/** Payment ki history — rasid ke liye */
export async function paymentHistory(businessId, { limit = 20 } = {}) {
  const rows = await BillingOrder.find({ businessId })
    .sort({ createdAt: -1 }).limit(Math.min(limit, 50))
    .select('planCode months amountPaise status paidAt receiptNo providerPaymentId createdAt')
    .lean();

  return rows.map((r) => ({
    ...r,
    amountRupees: rupees(r.amountPaise),
    planName: PLAN_BY_CODE[r.planCode]?.name || r.planCode,
  }));
}

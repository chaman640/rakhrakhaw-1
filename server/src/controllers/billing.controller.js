import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as service from '../services/billing.service.js';

/**
 * Plan ki list — BINA LOGIN ke.
 *
 * Ye jaan-boojh kar khula hai. Daam ka page bina login ke dikhna chahiye:
 * ek to naya aadmi bina account banaye daam dekh sake, aur doosra ye ki
 * payment gateway (Razorpay) merchant account manzoor karne se pehle khud
 * ye page kholta hai. Login ke peeche rakha page unke liye maujood hi nahi
 * hai — aur wahi ek cheez application ruk jane ki sabse aam wajah hai.
 */
export const plans = asyncHandler(async (req, res) => ok(res, service.planCatalog()));

/** Meri dukaan ka plan — Settings ka billing wala hissa */
export const mine = asyncHandler(async (req, res) =>
  ok(res, await service.billingSummary(req.businessId)));

/** Aage renew band — mohlat khatam hone tak sab chalta rahega */
export const cancel = asyncHandler(async (req, res) => {
  await service.cancelSubscription(req.businessId);
  return ok(
    res,
    await service.billingSummary(req.businessId),
    'Aage se renew nahi hoga. Jitni mohlat baaki hai, utne din sab chalta rahega.',
  );
});

/* ───────────────────────────── paisa lena (Step 2) ───────────────────────── */

export const checkout = asyncHandler(async (req, res) =>
  ok(res, await service.startCheckout(req.businessId, req.body, req.user._id)));

export const verify = asyncHandler(async (req, res) =>
  ok(res, await service.confirmCheckout(req.businessId, req.body), 'Plan chalu ho gaya'));

export const history = asyncHandler(async (req, res) =>
  ok(res, await service.paymentHistory(req.businessId)));


/* ── Autopay ── */

export const subscribe = asyncHandler(async (req, res) =>
  ok(res, await service.startAutopay(req.businessId, req.body)));

export const confirmSub = asyncHandler(async (req, res) =>
  ok(res, await service.confirmAutopay(req.businessId, req.body)));

export const changePlan = asyncHandler(async (req, res) =>
  ok(res, await service.changePlan(req.businessId, req.body)));

export const undoChange = asyncHandler(async (req, res) =>
  ok(res, await service.undoPendingChange(req.businessId)));

/**
 * Razorpay ka webhook.
 *
 * `protect` NAHI lagta — Razorpay ke paas hamara token hai hi nahi. Pehchan
 * signature se hoti hai, aur wahi asli pehra hai.
 *
 * Gadbad par bhi 200 bhejte hain: Razorpay non-200 pe ghanto tak dobara
 * bhejta rehta hai, aur agar galti hamari taraf ki ho (jaise order hi na
 * mile) to wo dobara bhejne se kabhi theek nahi hogi.
 */
export const webhook = asyncHandler(async (req, res) => {
  try {
    const out = await service.handleWebhook(req.body, req.get('x-razorpay-signature'));
    return res.status(200).json({ ok: true, ...out });
  } catch (err) {
    // Signature galat = 401. Ye dobara bhejne layak hai hi nahi, par 401
    // bhejna Razorpay ko saaf batata hai ki setting kahin galat hai.
    // ApiError me `statusCode` hota hai, `status` nahi — pehle ye branch
    // kabhi chalta hi nahi tha, aur galat webhook secret par sab kuch
    // chup-chaap 200 lautata tha (yaani Razorpay ko sab theek dikhta tha)
    if (err.statusCode === 401) return res.status(401).json({ ok: false });
    console.error('[billing] webhook:', err.message);
    return res.status(200).json({ ok: false });
  }
});

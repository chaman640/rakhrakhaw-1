/**
 * BILLING JAANCH — mahina/saal, ek payment ek hi baar, aur turant chalu.
 *
 *   MONGO_URI=... npm run billing:check --prefix server
 *
 * Razorpay ko asli me nahi bulata: webhook ka signature yahin banta hai aur
 * `fetch` nakli hai. Apna banaya sab data aakhir me mita deta hai (sirf
 * `plan_T_` wale Razorpay plan aur ek nayi businessId).
 */
process.env.BILLING_MODE = 'paid';
process.env.RAZORPAY_KEY_ID = 'rzp_test_x';
process.env.RAZORPAY_KEY_SECRET = 'secret_x';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_x';
const root = new URL('../src', import.meta.url).pathname;
const crypto = await import('crypto');
const mongoose = (await import('mongoose')).default;
const { connectDB } = await import(`${root}/config/db.js`);
const M = await import(`${root}/models/index.js`);
const billing = await import(`${root}/services/billing.service.js`);

let pass = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { pass++; console.log('  ✔', n); } else { fail++; console.log('  ✖', n, x); } };

await connectDB();
const bizId = new mongoose.Types.ObjectId();
const cleanup = async () => {
  await M.Subscription.deleteMany({ businessId: bizId });
  await M.BillingOrder.deleteMany({ businessId: bizId });
  await M.BillingCycle.deleteMany({ businessId: bizId }).catch(() => {});
  await M.RazorpayPlan.deleteMany({ planId: /^plan_T_/ });
};
await cleanup();

await M.RazorpayPlan.create({ code: 'BADHTI@Y', pricePaise: 120000, planId: 'plan_T_Y' });
await M.RazorpayPlan.create({ code: 'CHOTI', pricePaise: 5000, planId: 'plan_T_M' });

const sign = (raw) => crypto.createHmac('sha256', 'whsec_x').update(raw).digest('hex');
async function charged(subId, planId, payId, amount) {
  const raw = JSON.stringify({ event: 'subscription.charged', payload: {
    subscription: { entity: { id: subId, plan_id: planId } },
    payment: { entity: { id: payId, amount, status: 'captured' } } } });
  return billing.handleWebhook(Buffer.from(raw), sign(raw));
}

// yearly
await M.Subscription.create({ businessId: bizId, planCode: 'FREE', providerSubId: 'sub_T1', mandateStatus: 'created', mandatePlanCode: 'BADHTI', mandatePeriod: 'yearly', providerPlanId: 'plan_T_Y' });
const before = Date.now();
let r = await charged('sub_T1', 'plan_T_Y', 'pay_T1', 120000);
let sub = await M.Subscription.findOne({ businessId: bizId }).lean();
const days = (sub.paidTill - before) / 86400000;
check('saal ka paisa -> 365 din ke aas-paas', days > 360 && days < 370, `${days}`);
check('plan BADHTI, period yearly', sub.planCode === 'BADHTI' && sub.period === 'yearly', `${sub.planCode} ${sub.period}`);
check('mandatePeriod saaf', sub.mandatePeriod === '', sub.mandatePeriod);
await new Promise((res) => setTimeout(res, 300));
const bo = await M.BillingOrder.findOne({ providerPaymentId: 'pay_T1' }).lean();
check('rasid 12 mahine ki', bo?.months === 12 && bo?.amountPaise === 120000, JSON.stringify(bo));
r = await charged('sub_T1', 'plan_T_Y', 'pay_T1', 120000);
check('wahi payment dobara -> kuch nahi badla', r?.alreadyDone === true || r?.result?.alreadyDone === true || JSON.stringify(r).includes('alreadyDone'), JSON.stringify(r));
const sub2 = await M.Subscription.findOne({ businessId: bizId }).lean();
check('paidTill wahi raha', +sub2.paidTill === +sub.paidTill);

const summary = await billing.billingSummary(bizId);
check('summary me period yearly aur saal ka daam', summary.plan.period === 'yearly' && summary.plan.periodPriceRupees === 1200, JSON.stringify(summary.plan));

// monthly + immediate activation via confirmAutopay with fake fetch
await M.Subscription.deleteMany({ businessId: bizId });
await M.Subscription.create({ businessId: bizId, planCode: 'FREE', providerSubId: 'sub_T2', mandateStatus: 'created', mandatePlanCode: 'CHOTI', mandatePeriod: 'monthly', providerPlanId: 'plan_T_M' });
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/subscriptions/sub_T2') ? { id: 'sub_T2', plan_id: 'plan_T_M', status: 'active' }
    : u.includes('/payments/pay_T2') ? { id: 'pay_T2', amount: 5000, status: 'captured' } : {};
  return { ok: true, json: async () => body };
};
const sig = crypto.createHmac('sha256', 'secret_x').update('pay_T2|sub_T2').digest('hex');
const s2 = await billing.confirmAutopay(bizId, { subscriptionId: 'sub_T2', paymentId: 'pay_T2', signature: sig });
check('sub-verify pe plan TURANT chalu (webhook ke bina)', s2.plan.code === 'CHOTI' && s2.status === 'active', `${s2.plan.code} ${s2.status}`);
sub = await M.Subscription.findOne({ businessId: bizId }).lean();
const d2 = (sub.paidTill - Date.now()) / 86400000;
check('mahine ka paisa -> ~30 din', d2 > 27 && d2 < 32, `${d2}`);
r = await charged('sub_T2', 'plan_T_M', 'pay_T2', 5000);
const sub3 = await M.Subscription.findOne({ businessId: bizId }).lean();
check('baad me webhook aaya to dobara nahi chadha', +sub3.paidTill === +sub.paidTill, `${sub.paidTill} vs ${sub3.paidTill}`);

// startAutopay: stale "created" mandate that Razorpay says is active -> no new mandate
await M.Subscription.updateOne({ businessId: bizId }, { $set: { mandateStatus: 'created' } });
let created = 0;
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (opt?.method === 'POST') created++;
  const body = u.includes('/subscriptions/sub_T2') ? { id: 'sub_T2', plan_id: 'plan_T_M', status: 'active' } : {};
  return { ok: true, json: async () => body };
};
const s3 = await billing.startAutopay(bizId, { planCode: 'CHOTI', period: 'monthly' });
check('Razorpay pe pehle se chalu mandate -> naya nahi bana, parda nahi khula', s3.needsCheckout === false && created === 0, `${JSON.stringify({ n: s3.needsCheckout, created })}`);

// changePlan across period -> period_change
try {
  await billing.changePlan(bizId, { planCode: 'CHOTI', period: 'yearly' });
  check('mahine se saal -> naya mandate ka nishaan', false);
} catch (e) {
  check('mahine se saal -> naya mandate ka nishaan', e.details?.reason === 'period_change', e.message);
}
globalThis.fetch = realFetch;

await cleanup();
await mongoose.disconnect();
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

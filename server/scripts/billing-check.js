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

/* ── TRIAL aur FEATURE ── */
const platform = await import(`${root}/services/platform.service.js`);
const { requireFeature } = await import(`${root}/middleware/feature.js`);
const { PLAN_BY_CODE } = await import(`${root}/config/billing.js`);
await M.PlatformConfig.deleteMany({ key: 'main' });
await platform.loadPlatformConfig();

const tBiz = new mongoose.Types.ObjectId();
const t1 = await billing.startTrial(tBiz);
const tDays = (new Date(t1.paidTill) - Date.now()) / 86400000;
check('naye seller ka 15 din trial', t1.isTrial && tDays > 14.9 && tDays < 15.1 && t1.planCode === 'BADHTI', `${t1.planCode} ${tDays}`);
const t2 = await billing.startTrial(tBiz, 'ASEEM');
check('dobara trial nahi milta', t2.planCode === 'BADHTI' && +t2.paidTill === +t1.paidTill);
let ts = await billing.billingSummary(tBiz);
check('summary: trial chalu, din baaki', ts.trial.on && ts.trial.daysLeft === 15, JSON.stringify(ts.trial));
check('BADHTI me leads aur assign hai, smart nahi', ts.features.includes('crm_leads') && ts.features.includes('crm_assign') && !ts.features.includes('crm_smart'), JSON.stringify(ts.features));
check('band feature pe sabse sasta plan bataya', ts.locked.crm_smart?.plan?.code === 'BADI', JSON.stringify(ts.locked.crm_smart));

const runMw = (key) => new Promise((resolve) => requireFeature(key)({ businessId: tBiz }, {}, (err) => resolve(err || null)));
check('backend: crm_leads khula', (await runMw('crm_leads')) === null);
const blocked = await runMw('crm_smart');
check('backend: crm_smart band (feature_locked)', blocked?.details?.reason === 'feature_locked', blocked?.message);

await M.Subscription.updateOne({ businessId: tBiz }, { $set: { paidTill: new Date(Date.now() - 86400000) } });
ts = await billing.billingSummary(tBiz);
check('trial khatam -> seedha expired, mohlat nahi', ts.status === 'expired' && ts.trial.expired, `${ts.status}`);
let sellErr = null;
try { await billing.assertCanSell(tBiz); } catch (e) { sellErr = e; }
check('trial khatam -> bechna ruka', sellErr?.details?.reason === 'subscription_required');

// Admin setting: trial 30 din, crm_smart BADHTI me bhi, CHOTI ka daam ₹60
await platform.updatePlatformConfig({
  trialDays: 30,
  featurePlans: { crm_smart: ['BADHTI', 'BADI', 'ASEEM'] },
  plans: [{ code: 'CHOTI', pricePaise: 6000 }],
});
const t3biz = new mongoose.Types.ObjectId();
const t3 = await billing.startTrial(t3biz);
const d3 = (new Date(t3.paidTill) - Date.now()) / 86400000;
check('admin ne trial 30 din kiya -> naya trial 30 din', d3 > 29.9 && d3 < 30.1, `${d3}`);
check('admin ne feature BADHTI me khola', (await billing.billingSummary(t3biz)).features.includes('crm_smart'));
check('admin ne CHOTI ka daam badla -> poore app me', PLAN_BY_CODE.CHOTI.pricePaise === 6000);
check('pricing page (catalog) me naya daam', billing.planCatalog().plans.find((x) => x.code === 'CHOTI')?.priceRupees === 60,
  JSON.stringify(billing.planCatalog().plans.map((x) => [x.code, x.priceRupees])));
await M.PlatformConfig.deleteMany({ key: 'main' });
await platform.loadPlatformConfig();
check('setting hati -> daam wapas default', PLAN_BY_CODE.CHOTI.pricePaise === 5000);
await M.Subscription.deleteMany({ businessId: { $in: [tBiz, t3biz] } });

await cleanup();
await mongoose.disconnect();
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

/**
 * END-TO-END — poora RakhRakhav ek hi kahani me, PAID mode me.
 *
 *   MONGO_URI=... npm run e2e --prefix server
 *
 * Seller signup → 15 din trial → plan ke hisaab se feature → bechna → admin
 * dekhta hai → payment (autopay webhook) → trial se paid → plan khatam hone pe
 * rok → admin din badhata hai → suspend/chalu → soochna → staff ko lead/kaam →
 * retailer judta hai, wishlist → seller ko maang.
 *
 * Razorpay ko asli me nahi bulata (webhook ka signature yahin banta hai).
 * Test DB pe chalayein: admin ka register (AdminAudit) jaan-boojh kar mitaya
 * nahi ja sakta, isliye uski kuch lines reh jati hain. Production me chalne se
 * mana karta hai.
 */
process.env.BILLING_MODE = 'paid';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_e2e';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'e2e_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'e2e_webhook_secret';
process.env.PARTNER_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@rakhrakhav.test';
process.env.PARTNER_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-pass';
process.env.RATE_LIMIT_PER_MIN = '100000';

const crypto = await import('crypto');
const mongoose = (await import('mongoose')).default;
const jwt = (await import('jsonwebtoken')).default;
const { env } = await import('../src/config/env.js');

if (env.isProd) {
  console.error('e2e production me nahi chalta — test database pe chalayein');
  process.exit(1);
}

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { loadPlatformConfig } = await import('../src/services/platform.service.js');
const M = await import('../src/models/index.js');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`${G}  ✔${N} ${name}`); } else { failed++; console.log(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
};
const step = (s) => console.log(`\n${Y}${s}${N}`);

const PORT = 5988;
const BASE = `http://localhost:${PORT}/api`;
const PH = { seller: '9300000001', salesman: '9300000002', retailer: '9300000003' };
const otp = (phone) => jwt.sign({ phone, purpose: 'SIGNUP', otp: true }, env.jwtSecret, { expiresIn: '15m' });

async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* khali */ }
  return { status: res.status, ...json };
}
async function webhook(event) {
  const raw = JSON.stringify(event);
  const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
  const res = await fetch(`${BASE}/billing/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sig }, body: raw,
  });
  return res.status;
}

async function cleanup() {
  const users = await M.User.find({ phone: { $in: Object.values(PH) } }).select('businessId').lean();
  const bizIds = users.map((u) => u.businessId).filter(Boolean);
  await Promise.all([
    M.User.deleteMany({ phone: { $in: Object.values(PH) } }),
    M.Business.deleteMany({ _id: { $in: bizIds } }),
    M.Subscription.deleteMany({ businessId: { $in: bizIds } }),
    M.BillingOrder.deleteMany({ businessId: { $in: bizIds } }),
    M.BillingCycle.deleteMany({ businessId: { $in: bizIds } }),
    M.Party.deleteMany({ businessId: { $in: bizIds } }),
    M.Item.deleteMany({ businessId: { $in: bizIds } }),
    M.StockMovement.deleteMany({ businessId: { $in: bizIds } }),
    M.StockLot.deleteMany({ businessId: { $in: bizIds } }),
    M.Invoice.deleteMany({ businessId: { $in: bizIds } }),
    M.LedgerEntry.deleteMany({ businessId: { $in: bizIds } }),
    M.Counter.deleteMany({ businessId: { $in: bizIds } }),
    M.Membership.deleteMany({ businessId: { $in: bizIds } }),
    M.Notification.deleteMany({ businessId: { $in: bizIds } }),
    M.Wishlist.deleteMany({ businessId: { $in: bizIds } }),
    M.Lead.deleteMany({ businessId: { $in: bizIds } }),
    M.CrmTask.deleteMany({ businessId: { $in: bizIds } }),
    M.Announcement.deleteMany({ title: /^E2E/ }),
    M.RazorpayPlan.deleteMany({ planId: /^plan_e2e/ }),
  ]);
}

async function run() {
  await connectDB();
  await M.PlatformConfig.deleteMany({ key: 'main' });
  await loadPlatformConfig();
  await cleanup();
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    /* ─────────── 1. Seller aata hai — trial ─────────── */
    step('1. Seller signup → 15 din ka trial');
    let r = await call('GET', '/billing/plans');
    check('pricing me plan aur trial ke din', r.data?.chargingNow === true && r.data?.trialDays === 15 && r.data?.plans?.length >= 4,
      JSON.stringify({ c: r.data?.chargingNow, d: r.data?.trialDays }));

    r = await call('POST', '/auth/wholesaler/signup', {
      body: { name: 'E2E Malik', phone: PH.seller, password: 'e2e12345', businessName: 'E2E Traders', otpToken: otp(PH.seller), planCode: 'CHOTI' },
    });
    let sTok = r.data?.token;
    const bizId = r.data?.business?._id;
    const invite = r.data?.business?.inviteCode;
    check('seller ka account bana', r.status === 201 && Boolean(sTok), r.message);

    r = await call('GET', '/billing/me', { token: sTok });
    check('trial chalu, 15 din, chuna hua plan (CHOTI)', r.data?.trial?.on && r.data?.trial?.daysLeft === 15 && r.data?.plan?.code === 'CHOTI',
      JSON.stringify(r.data?.trial));
    check('CHOTI me retailer follow-up hai, leads nahi', r.data?.features?.includes('crm_basic') && !r.data?.features?.includes('crm_leads'),
      JSON.stringify(r.data?.features));

    /* ─────────── 2. Trial me bechna ─────────── */
    step('2. Trial me dukaan chalana');
    r = await call('POST', '/items', { token: sTok, body: { name: 'E2E Charger', purchasePrice: 100, salePrice: 150, openingStock: 50 } });
    const itemId = r.data?._id;
    check('item bana', r.status === 201, r.message);
    r = await call('POST', '/parties', { token: sTok, body: { type: 'retailer', name: 'E2E Walk-in', phone: '9300000099' } });
    const walkIn = r.data?._id;
    r = await call('POST', '/invoices', { token: sTok, body: { partyId: walkIn, items: [{ itemId, qty: 2, rate: 150 }], paidAmount: 300 } });
    check('trial me bill bana aur paisa mila', r.status === 201 && r.data?.paymentStatus === 'paid', r.message);

    r = await call('GET', '/crm/leads', { token: sTok });
    check('leads (₹100 wala feature) band — upgrade ka plan bataya', r.status === 403 && r.details?.reason === 'feature_locked'
      && r.details?.plan?.code === 'BADHTI', `${r.status} ${JSON.stringify(r.details)}`);
    r = await call('GET', '/crm/overview', { token: sTok });
    check('retailer follow-up (CHOTI me) khula', r.status === 200, `${r.status}`);

    /* ─────────── 3. Admin ─────────── */
    step('3. Admin panel');
    r = await call('POST', '/partner/admin/login', { body: { email: process.env.PARTNER_ADMIN_EMAIL, password: process.env.PARTNER_ADMIN_PASSWORD } });
    const aTok = r.data?.token;
    check('admin login (alag login, seller wala nahi)', Boolean(aTok), r.message);
    r = await call('GET', '/partner/admin/platform/dashboard', { token: sTok });
    check('seller ka token admin panel pe nahi chalta', r.status === 401 || r.status === 403, `${r.status}`);

    r = await call('GET', '/partner/admin/platform/dashboard?range=today', { token: aTok });
    check('dashboard me trial aur naya seller', r.data?.trials?.active >= 1 && r.data?.users?.newSellers >= 1, JSON.stringify(r.data?.trials));
    r = await call('GET', `/partner/admin/platform/businesses?q=E2E`, { token: aTok });
    const row = (r.data?.rows || []).find((b) => String(b._id) === String(bizId));
    check('dukaan list me, status "trial"', row?.subscription?.status === 'trial', JSON.stringify(row?.subscription));

    /* ─────────── 4. Payment — trial se paid ─────────── */
    step('4. Autopay ka paisa kata → trial se paid (bache din saath)');
    const subBefore = await M.Subscription.findOne({ businessId: bizId }).lean();
    await M.RazorpayPlan.create({ code: 'BADHTI', pricePaise: 10000, planId: 'plan_e2e_badhti' });
    await M.Subscription.updateOne({ businessId: bizId }, { $set: { providerSubId: 'sub_e2e_1', providerPlanId: 'plan_e2e_badhti', mandateStatus: 'created', mandatePlanCode: 'BADHTI', mandatePeriod: 'monthly' } });
    const st = await webhook({ event: 'subscription.charged', payload: {
      subscription: { entity: { id: 'sub_e2e_1', plan_id: 'plan_e2e_badhti' } },
      payment: { entity: { id: 'pay_e2e_1', amount: 10000, status: 'captured' } },
    } });
    check('webhook maana gaya', st === 200, `${st}`);
    r = await call('GET', '/billing/me', { token: sTok });
    const subAfter = await M.Subscription.findOne({ businessId: bizId }).lean();
    const extra = (new Date(subAfter.paidTill) - new Date(subBefore.paidTill)) / 86400000;
    check('ab paid BADHTI, trial khatam', r.data?.plan?.code === 'BADHTI' && !r.data?.trial?.on && !subAfter.isTrial, JSON.stringify(r.data?.trial));
    check('trial ke bache din nahi mare (paidTill = trial end + ~1 mahina)', extra > 27 && extra < 32, `${extra}`);
    r = await call('GET', '/crm/leads', { token: sTok });
    check('BADHTI pe leads khul gaye', r.status === 200, `${r.status}`);
    r = await call('GET', '/partner/admin/platform/payments?status=paid', { token: aTok });
    check('admin ko payment dikha', (r.data?.rows || []).some((p) => p.paymentId === 'pay_e2e_1' && p.amountRupees === 100), JSON.stringify(r.data?.rows?.[0]));
    r = await call('GET', '/partner/admin/platform/dashboard?range=today', { token: aTok });
    check('dashboard me aaj ki kamai', r.data?.revenue?.today?.rupees >= 100, JSON.stringify(r.data?.revenue?.today));

    /* ─────────── 5. Plan khatam, admin ki madad ─────────── */
    step('5. Plan khatam → rok → admin din badhata hai');
    await M.Subscription.updateOne({ businessId: bizId }, { $set: { paidTill: new Date(Date.now() - 30 * 86400000) } });
    r = await call('GET', '/items', { token: sTok });
    check('mohlat ke baad bechna ruka', r.status === 403 && r.details?.reason === 'subscription_required', `${r.status}`);
    r = await call('POST', `/partner/admin/platform/businesses/${bizId}/extend`, { token: aTok, body: { days: 10, note: 'E2E: shikayat pe' } });
    check('admin ne 10 din badhaye', r.status === 200, r.message);
    r = await call('GET', '/items', { token: sTok });
    check('bechna wapas chalu', r.status === 200, `${r.status}`);

    /* ─────────── 6. Suspend ─────────── */
    step('6. Suspend / chalu');
    await call('POST', `/partner/admin/platform/businesses/${bizId}/suspend`, { token: aTok, body: { suspended: true, reason: 'E2E jaanch' } });
    r = await call('GET', '/items', { token: sTok });
    check('suspend pe sab bechna band', r.status === 403 && r.details?.reason === 'suspended', `${r.status}`);
    await call('POST', `/partner/admin/platform/businesses/${bizId}/suspend`, { token: aTok, body: { suspended: false } });
    r = await call('GET', '/items', { token: sTok });
    check('chalu karte hi wapas', r.status === 200, `${r.status}`);

    /* ─────────── 7. Admin plan/feature badalta hai + soochna ─────────── */
    step('7. Admin: plan dena, soochna');
    r = await call('POST', `/partner/admin/platform/businesses/${bizId}/plan`, { token: aTok, body: { planCode: 'BADI', days: 0, note: 'E2E upgrade' } });
    check('admin ne BADI diya', r.data?.subscription?.planCode === 'BADI', r.message);
    r = await call('POST', '/partner/admin/platform/announcements', {
      token: aTok, body: { title: 'E2E: BADI walon ke liye', audience: 'sellers', planCodes: ['BADI'] },
    });
    r = await call('GET', '/announcements', { token: sTok });
    check('BADI seller ko soochna dikhi', (r.data || []).some((a) => a.title === 'E2E: BADI walon ke liye'), JSON.stringify(r.data));
    r = await call('GET', '/partner/admin/platform/audit', { token: aTok });
    const acts = (r.data?.rows || []).map((a) => a.action);
    check('register me har admin kaam', ['trial.extend', 'subscription.extend'].some((a) => acts.includes(a))
      && acts.includes('business.suspend') && acts.includes('plan.change') && acts.includes('announcement.create'), JSON.stringify(acts.slice(0, 10)));

    /* ─────────── 8. Staff ko kaam ─────────── */
    step('8. Staff: lead diya → Aaj ka kaam → poora');
    r = await call('POST', '/staff', { token: sTok, body: { name: 'E2E Salesman', phone: PH.salesman, password: 'sales123', staffRole: 'salesman' } });
    check('BADI me salesman juda', r.status === 201, r.message);
    r = await call('POST', '/auth/login', { body: { phone: PH.salesman, password: 'sales123' } });
    const smTok = r.data?.token;
    r = await call('GET', '/crm/staff', { token: sTok });
    const smId = (r.data || []).find((u) => u.phone === PH.salesman)?._id;
    r = await call('POST', '/crm/leads', { token: sTok, body: { name: 'E2E Lead', phone: '9300000088', assignedToUserId: smId, nextFollowUpAt: new Date().toISOString() } });
    const leadId = r.data?._id;
    check('lead salesman ko diya (BADI me assign chalu)', r.status === 201, r.message);
    r = await call('GET', '/crm/today', { token: smTok });
    const task = [...(r.data?.today || []), ...(r.data?.overdue || [])][0];
    check('salesman ke Aaj ka kaam me', Boolean(task), JSON.stringify(r.data?.today));
    r = await call('PUT', `/crm/tasks/${task?._id}`, { token: smTok, body: { status: 'done', doneNote: 'E2E: order dega' } });
    check('salesman ne poora kiya', r.data?.status === 'done', r.message);
    r = await call('POST', `/crm/leads/${leadId}/convert`, { token: sTok });
    check('lead jeeta → retailer', Boolean(r.data?.partyId), r.message);

    /* ─────────── 9. Retailer judta hai ─────────── */
    step('9. Retailer: invite link se juda → wishlist → seller ko maang');
    r = await call('POST', '/auth/retailer/signup', {
      body: { inviteCode: invite, name: 'E2E Retailer', shopName: 'E2E Mobile Shop', phone: PH.retailer, password: 'ret12345', otpToken: otp(PH.retailer) },
    });
    const rTok = r.data?.token;
    check('retailer juda (kharidna hamesha free)', r.status === 201 && Boolean(rTok), r.message);
    r = await call('GET', '/catalog', { token: rTok });
    check('retailer ko maal dikha', (r.data || []).some((i) => i.name === 'E2E Charger'), `${r.status}`);
    r = await call('POST', '/wishlist', { token: rTok, body: { itemId } });
    await call('POST', '/wishlist', { token: rTok, body: { text: 'E2E: Type-C cable 1m' } });
    check('wishlist me daala', r.status === 201, r.message);
    r = await call('GET', '/wishlist-demand', { token: sTok });
    check('seller ko maang dikhi (item + likha hua)', (r.data?.items || []).some((i) => String(i.itemId) === String(itemId))
      && (r.data?.asks || []).some((a) => a.text === 'E2E: Type-C cable 1m'), JSON.stringify(r.data));

    /* ─────────── 10. Admin ka poora hisaab ─────────── */
    step('10. Admin: dukaan ka poora hisaab');
    r = await call('GET', `/partner/admin/platform/businesses/${bizId}`, { token: aTok });
    check('dukaan detail: plan, payment, staff, upyog', r.data?.subscription?.planCode === 'BADI' && r.data?.payments?.length >= 1
      && r.data?.staffCount >= 1 && r.data?.usage?.invoices >= 1, JSON.stringify({ s: r.data?.subscription?.planCode, p: r.data?.payments?.length, st: r.data?.staffCount, u: r.data?.usage }));
    r = await call('GET', '/partner/admin/platform/users?type=buyer&q=E2E', { token: aTok });
    check('users me retailer', (r.data?.rows || []).some((u) => u.phone === PH.retailer), `${(r.data?.rows || []).length}`);
  } finally {
    await cleanup().catch(() => {});
    server.close();
    await mongoose.disconnect();
  }

  console.log(`\n${failed === 0 ? G : R}${passed} pass, ${failed} fail${N}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(`${R}E2E crash:${N}`, err);
  process.exit(1);
});

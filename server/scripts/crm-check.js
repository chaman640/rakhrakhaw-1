/**
 * CRM 360 + quotation → order → dispatch → bill checks.
 *
 *   MONGO_URI=... npm run crm:check --prefix server
 */
process.env.BILLING_MODE = 'paid';
process.env.RATE_LIMIT_PER_MIN = '100000';
process.env.RAZORPAY_KEY_ID ||= 'rzp_test_crm';
process.env.RAZORPAY_KEY_SECRET ||= 'crm_secret';
process.env.RAZORPAY_WEBHOOK_SECRET ||= 'crm_webhook';

const jwt = (await import('jsonwebtoken')).default;
const { env } = await import('../src/config/env.js');
if (env.isProd) { console.error('Not for production'); process.exit(1); }

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { loadPlatformConfig } = await import('../src/services/platform.service.js');
const { bustMetrics } = await import('../src/services/crmInsight.service.js');
const M = await import('../src/models/index.js');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`${G}  ✔${N} ${name}`); } else { failed++; console.log(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
};
const step = (s) => console.log(`\n${Y}${s}${N}`);

const PORT = 5991;
const BASE = `http://localhost:${PORT}/api`;
const PH = { owner: '9410000001', sales: '9410000002', small: '9410000003', sales2: '9410000004' };
const RET = ['9410000011', '9410000012', '9410000013', '9410000014'];
const otp = (phone) => jwt.sign({ phone, purpose: 'SIGNUP', otp: true }, env.jwtSecret, { expiresIn: '15m' });
const DAY = 86400000;

async function call(method, path, { body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, ...json };
}
const login = async (phone) => (await call('POST', '/auth/login', { body: { phone, password: 'crm12345' } })).data?.token;

async function cleanup() {
  const users = await M.User.find({ phone: { $in: Object.values(PH) } }).select('businessId').lean();
  const b = { businessId: { $in: users.map((u) => u.businessId).filter(Boolean) } };
  await Promise.all([
    M.User.deleteMany({ $or: [{ phone: { $in: Object.values(PH) } }, b] }),
    M.Business.deleteMany({ _id: b.businessId }),
    ...['Subscription', 'Counter', 'Notification', 'Employee', 'CrmTask', 'Party', 'Invoice', 'Item', 'Order', 'Lead', 'LedgerEntry', 'Payment',
      'StockLot', 'StockMovement', 'Complaint', 'CrmNote', 'CrmSettings', 'Quotation', 'Expense']
      .map((m) => M[m].deleteMany(b)),
  ]);
}

async function run() {
  await connectDB();
  await loadPlatformConfig();
  await cleanup();
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    step('1. Setup');
    let r = await call('POST', '/auth/wholesaler/signup', { body: { name: 'Crm Owner', phone: PH.owner, password: 'crm12345', businessName: 'Crm Traders', otpToken: otp(PH.owner), planCode: 'BADI' } });
    const tok = r.data?.token;
    const bizId = r.data?.business?._id;
    check('owner on BADI', Boolean(tok), r.message);
    r = await call('POST', '/staff', { token: tok, body: { name: 'Rahul Sales', phone: PH.sales, password: 'crm12345', staffRole: 'salesman' } });
    const salesId = r.data?._id || r.data?.user?._id;
    r = await call('POST', '/staff', { token: tok, body: { name: 'Amit Sales', phone: PH.sales2, password: 'crm12345', staffRole: 'salesman' } });
    const sales2Id = r.data?._id || r.data?.user?._id;
    await M.User.updateMany({ phone: { $in: [PH.sales, PH.sales2] } }, { $set: { mustChangePassword: false } });
    const sTok = await login(PH.sales);
    check('two salesmen created', Boolean(salesId && sales2Id && sTok), r.message);

    r = await call('POST', '/items', { token: tok, body: { name: 'Crm Charger', purchasePrice: 80, salePrice: 100, openingStock: 5000 } });
    const charger = r.data?._id;
    r = await call('POST', '/items', { token: tok, body: { name: 'Crm Cable', purchasePrice: 40, salePrice: 60, openingStock: 5000 } });
    const cable = r.data?._id;
    const parties = [];
    for (const [i, city] of ['Lucknow', 'Delhi', 'Lucknow', 'Noida'].entries()) {
      r = await call('POST', '/parties', { token: tok, body: { type: 'retailer', name: `Crm Shop ${i + 1}`, phone: RET[i], address: { city } } });
      parties.push(r.data?._id);
    }
    check('items + 4 retailers', Boolean(charger && cable && parties.every(Boolean)), r.message);

    step('2. Buying pattern → metrics, segments, score, re-order');
    // Shop 1 buys chargers every ~10 days; shop 2 bought long ago only
    const bills = [];
    for (const back of [40, 30, 20, 10]) {
      r = await call('POST', '/invoices', { token: tok, body: { partyId: parties[0], items: [{ itemId: charger, qty: 100, rate: 100 }, { itemId: cable, qty: 10, rate: 60 }], paidAmount: 10600, paymentMode: 'CASH' } });
      bills.push([r.data?._id, back]);
    }
    for (const back of [200, 170, 140]) {
      r = await call('POST', '/invoices', { token: tok, body: { partyId: parties[1], items: [{ itemId: cable, qty: 50, rate: 60 }] } });
      bills.push([r.data?._id, back]);
    }
    check('7 bills created', bills.every(([id]) => id), r.message);
    for (const [id, back] of bills) await M.Invoice.updateOne({ _id: id }, { $set: { invoiceDate: new Date(Date.now() - back * DAY) } });
    await M.Party.updateMany({ _id: { $in: parties } }, { $set: { createdAt: new Date(Date.now() - 300 * DAY) } });
    bustMetrics(bizId);

    r = await call('GET', '/crm/customers?sort=sale', { token: tok });
    const s1 = (r.data || []).find((c) => String(c._id) === String(parties[0]));
    const s2 = (r.data || []).find((c) => String(c._id) === String(parties[1]));
    check('customer list: total sale + last order', r.status === 200 && s1?.totalSale === 42400 && s1?.bills === 4 && s1?.daysSince === 10, JSON.stringify(s1 && { t: s1.totalSale, b: s1.bills, d: s1.daysSince }));
    check('shop 2: outstanding 9000, inactive + overdue', s2?.outstanding === 9000 && s2?.segments?.includes('inactive') && s2?.overdue === 9000, JSON.stringify(s2 && { o: s2.outstanding, s: s2.segments, od: s2.overdue }));
    check('shop 1 scored above shop 2', s1?.score > s2?.score && s1.score >= 50, `${s1?.score} vs ${s2?.score}`);
    check('meta: cities, segments, totals', r.meta?.cities?.includes('Lucknow') && r.meta?.segments?.inactive >= 1 && r.meta?.totals?.customers === 4, JSON.stringify(r.meta?.segments));
    r = await call('GET', '/crm/customers?city=Lucknow', { token: tok });
    check('city filter', r.data?.length === 2, `${r.data?.length}`);
    r = await call('GET', '/crm/customers?minSale=40000', { token: tok });
    check('₹40k+ buyers filter', r.data?.length === 1 && String(r.data[0]._id) === String(parties[0]), `${r.data?.length}`);
    r = await call('GET', '/crm/customers?inactiveDays=30', { token: tok });
    check('30+ days inactive filter', (r.data || []).some((c) => String(c._id) === String(parties[1])) && !(r.data || []).some((c) => String(c._id) === String(parties[0])), `${r.data?.length}`);
    r = await call('GET', '/crm/customers?overdue=1', { token: tok });
    check('payment overdue filter', r.data?.length === 1, `${r.data?.length}`);

    r = await call('GET', `/crm/customers/${parties[0]}`, { token: tok });
    check('profile: history + top items + timeline', r.status === 200 && r.data?.history?.length === 8 && r.data?.topItems?.[0]?.name === 'Crm Charger' && r.data?.timeline?.length >= 8, `${r.status} ${r.data?.history?.length} ${r.data?.timeline?.length}`);
    check('profile: avg gap 10 days + re-order due now', r.data?.avgGapDays === 10 && r.data?.reorder?.some((x) => x.name === 'Crm Charger' && x.due), JSON.stringify(r.data?.reorder?.[0]));

    r = await call('GET', '/crm/insights', { token: tok });
    check('insights: re-order due + recommended', r.data?.reorderDue?.some((x) => String(x._id) === String(parties[0])) && r.data?.recommended?.length >= 1, JSON.stringify(r.data?.reorderDue?.length));

    step('3. Tags, notes → task, assignment, scope');
    r = await call('PUT', `/crm/customers/${parties[0]}/tags`, { token: tok, body: { tags: ['VIP', 'VIP', 'Wholesale'] } });
    check('tags saved (deduped)', r.data?.tags?.length === 2, JSON.stringify(r.data));
    r = await call('GET', '/crm/customers?tag=VIP', { token: tok });
    check('tag filter', r.data?.length === 1, `${r.data?.length}`);
    r = await call('PUT', `/crm/customers/${parties[0]}/assign`, { token: tok, body: { userId: salesId } });
    check('customer assigned to salesman', r.status === 200, r.message);
    r = await call('POST', `/crm/customers/${parties[0]}/notes`, { token: tok, body: { kind: 'call', text: 'Needs 500 chargers at 95, confirms Friday', nextFollowUpAt: new Date(Date.now() + 2 * DAY).toISOString() } });
    check('call note creates follow-up task', r.status === 201 && r.data?.taskId, r.message);
    const task = await M.CrmTask.findById(r.data?.taskId).lean();
    check('task goes to assigned salesman', String(task?.assignedToUserId) === String(salesId), String(task?.assignedToUserId));
    r = await call('GET', '/crm/customers', { token: sTok });
    check('salesman sees only own customers', r.data?.length === 1 && String(r.data[0]._id) === String(parties[0]), `${r.data?.length}`);
    r = await call('GET', `/crm/customers/${parties[1]}`, { token: sTok });
    check('salesman blocked from others’ profile', r.status === 404, `${r.status}`);

    step('4. Complaints');
    r = await call('PUT', '/crm/settings', { token: tok, body: { complaintAssigneeUserId: sales2Id } });
    check('complaint desk set', r.status === 200, r.message);
    r = await call('POST', '/crm/complaints', { token: tok, body: { partyId: parties[0], invoiceId: bills[0][0], subject: '5 of 50 pieces damaged', category: 'damaged', priority: 'urgent' } });
    const cmp = r.data?._id;
    check('complaint auto-assigned + numbered', r.status === 201 && /^CMP\//.test(r.data?.complaintNo) && r.data?.status === 'assigned' && String(r.data?.assignedToUserId) === String(sales2Id), `${r.status} ${r.message} ${r.data?.complaintNo}`);
    r = await call('PUT', `/crm/complaints/${cmp}`, { token: tok, body: { status: 'resolved' } });
    check('resolve needs a resolution', r.status === 400, `${r.status}`);
    r = await call('PUT', `/crm/complaints/${cmp}`, { token: tok, body: { status: 'resolved', resolution: 'Replaced 5 pieces' } });
    check('complaint resolved with history', r.data?.status === 'resolved' && r.data?.history?.length === 2 && r.data?.resolvedAt, r.message);
    r = await call('GET', `/crm/customers/${parties[0]}`, { token: tok });
    check('complaint shows on profile', r.data?.complaints?.length === 1 && r.data.timeline.some((t) => t.kind === 'complaint'));

    step('5. Leads: routing, pipeline value, escalation');
    r = await call('PUT', '/crm/settings', { token: tok, body: { leadAssign: { mode: 'round_robin', userIds: [salesId, sales2Id] } } });
    check('round robin on (₹500 plan)', r.status === 200, r.message);
    r = await call('PUT', '/crm/settings', { token: tok, body: { leadAssign: { mode: 'rules', rules: [{ city: 'Lucknow', userId: salesId }] } } });
    check('city rules need ₹2000 plan', r.status === 403 && r.details?.feature === 'crm_pro', `${r.status}`);
    const got = [];
    for (const n of ['Lead A', 'Lead B']) {
      r = await call('POST', '/crm/leads', { token: tok, body: { name: n, city: 'Agra', expectedValue: 100000 } });
      got.push(String(r.data?.assignedToUserId));
    }
    check('leads alternate between salesmen', new Set(got).size === 2 && got.every((g) => [String(salesId), String(sales2Id)].includes(g)), got.join(','));
    const leadId = r.data?._id;
    check('lead probability from stage', r.data?.probability === 10, `${r.data?.probability}`);
    const first = await M.CrmTask.findOne({ leadId, autoKey: `lead:${leadId}` }).lean();
    check('auto first-call task next day', Boolean(first) && first.dueAt > new Date(), JSON.stringify(first?.dueAt));
    r = await call('GET', '/crm/pipeline', { token: tok });
    check('pipeline has weighted value', r.data?.find((s) => s.stage === 'new')?.weighted === 20000, JSON.stringify(r.data?.[0]));

    step('6. Quotation → order → dispatch → bill');
    r = await call('POST', '/quotations', { token: tok, body: { leadId, items: [{ itemId: charger, qty: 500, rate: 95 }, { itemId: cable, qty: 100, discountPct: 10 }], paymentTerms: '50% advance' } });
    const qid = r.data?._id;
    check('quotation for a lead', r.status === 201 && /^QT\//.test(r.data?.quoteNo) && r.data?.total === 52900 && r.data?.status === 'draft', `${r.status} ${r.message} ${r.data?.total}`);
    r = await call('POST', `/quotations/${qid}/convert`, { token: tok, body: {} });
    check('draft cannot become order', r.status === 400, `${r.status}`);
    r = await call('POST', `/quotations/${qid}/status`, { token: tok, body: { status: 'sent' } });
    check('quotation sent; lead → quotation stage', r.data?.status === 'sent' && (await M.Lead.findById(leadId).lean()).stage === 'quotation', r.message);
    await M.Quotation.updateOne({ _id: qid }, { $set: { sentAt: new Date(Date.now() - 5 * DAY) } });
    r = await call('POST', '/crm/auto-tasks', { token: tok });
    const reorderTask = await M.CrmTask.findOne({ partyId: parties[0], autoKey: /^reorder:/ }).lean();
    check('automation: pending quote task + re-order task (from earlier auto run)', r.status === 200 && r.data?.quotes === 1 && Boolean(reorderTask), JSON.stringify(r.data));
    const again = await call('POST', '/crm/auto-tasks', { token: tok });
    check('automation does not duplicate', again.data?.created === 0 && again.data?.quotes === 0, JSON.stringify(again.data));
    r = await call('POST', `/quotations/${qid}/revise`, { token: tok });
    const q2 = r.data?._id;
    check('revision created, old closed', r.status === 200 && r.data?.revisionOf === qid && (await M.Quotation.findById(qid).lean()).status === 'rejected', r.message);
    await call('POST', `/quotations/${q2}/status`, { token: tok, body: { status: 'sent' } });
    r = await call('POST', `/quotations/${q2}/convert`, { token: tok, body: {} });
    const orderId = r.data?.order?._id;
    check('quote → order; lead became customer', r.status === 200 && r.data?.order?.source === 'quotation' && r.data?.order?.itemsTotal === 55900 - 3000 && (await M.Lead.findById(leadId).lean()).stage === 'won', `${r.status} ${r.message} ${r.data?.order?.itemsTotal}`);
    r = await call('POST', `/quotations/${q2}/convert`, { token: tok, body: {} });
    check('cannot convert twice', r.status === 409, `${r.status}`);
    r = await call('PUT', `/orders/${orderId}/dispatch`, { token: tok, body: { vehicleNo: 'UP32AB1234', transporter: 'Fast Roadways', lrNo: 'LR99', packages: 12 } });
    check('dispatch saved with challan no', /^DC\//.test(r.data?.dispatch?.challanNo || '') && r.data?.dispatch?.packages === 12, r.message);
    const challan = r.data?.dispatch?.challanNo;
    r = await call('PUT', `/orders/${orderId}/dispatch`, { token: tok, body: { driverName: 'Ram' } });
    check('challan number stays the same', r.data?.dispatch?.challanNo === challan);
    for (const st of ['PACKED', 'READY']) r = await call('POST', `/orders/${orderId}/status`, { token: tok, body: { status: st } });
    check('order packed → dispatched', r.data?.status === 'READY' && r.data?.dispatch?.dispatchedAt, r.message);
    r = await call('POST', '/orders', { token: tok, body: { partyId: parties[2], items: [{ itemId: cable, qty: 5 }] } });
    check('seller books phone order at party rate', r.status === 201 && r.data?.source === 'seller' && r.data?.itemsTotal === 300, `${r.status} ${r.message}`);
    r = await call('GET', '/quotations?status=converted', { token: tok });
    check('quotation list by status', r.data?.length === 1 && r.meta?.counts?.converted?.count === 1, `${r.data?.length}`);

    step('7. Targets, performance, plan limits');
    r = await call('PUT', `/crm/targets/${salesId}`, { token: tok, body: { amount: 50000 } });
    check('target set', r.status === 200, r.message);
    r = await call('GET', '/crm/targets', { token: tok });
    const t1 = r.data?.rows?.find((x) => String(x.userId) === String(salesId));
    check('target progress = this month’s sales of assigned customers', t1?.target === 50000 && t1?.achieved === 21200 && t1?.pct === 42, JSON.stringify(t1));
    r = await call('GET', '/crm/performance', { token: tok });
    const p1 = r.data?.rows?.find((x) => String(x.userId) === String(salesId));
    check('salesman scorecard', r.status === 200 && p1?.leads >= 1 && typeof p1?.sales === 'number', JSON.stringify(p1));
    r = await call('GET', '/crm/performance', { token: sTok });
    check('salesman cannot see team scorecard', r.status === 403, `${r.status}`);

    r = await call('POST', '/auth/wholesaler/signup', { body: { name: 'Small Owner', phone: PH.small, password: 'crm12345', businessName: 'Small Shop', otpToken: otp(PH.small), planCode: 'CHOTI' } });
    const smallTok = r.data?.token;
    r = await call('GET', '/crm/customers', { token: smallTok });
    check('₹50 plan: basic customer list works', r.status === 200 && r.meta?.smart === false, `${r.status}`);
    r = await call('GET', '/crm/customers?segment=vip', { token: smallTok });
    check('₹50 plan: segments locked', r.status === 403, `${r.status}`);
    r = await call('GET', '/quotations', { token: smallTok });
    check('₹50 plan: quotations locked', r.status === 403, `${r.status}`);
  } finally {
    server.close();
    await cleanup();
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });

/**
 * Admin roles + 2FA + support tickets + tutorial content ki jaanch.
 *
 *   MONGO_URI=... npm run admin:check --prefix server
 */
process.env.BILLING_MODE = 'free';
process.env.RATE_LIMIT_PER_MIN = '100000';
process.env.ADMIN_LOGIN_LIMIT = '100000';
process.env.PARTNER_ADMIN_EMAIL = 'super@admcheck.test';
process.env.PARTNER_ADMIN_PASSWORD = 'Super12345x';

const mongoose = (await import('mongoose')).default;
const jwt = (await import('jsonwebtoken')).default;
const { env } = await import('../src/config/env.js');
if (env.isProd) { console.error('Not for production'); process.exit(1); }

const { default: app } = await import('../src/app.js');
const { connectDB } = await import('../src/config/db.js');
const { codeAt } = await import('../src/utils/totp.js');
const M = await import('../src/models/index.js');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', N = '\x1b[0m';
let passed = 0, failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) { passed++; console.log(`${G}  ✔${N} ${name}`); } else { failed++; console.log(`${R}  ✖${N} ${name} ${D}${extra}${N}`); }
};
const step = (s) => console.log(`\n${Y}${s}${N}`);

const PORT = 5991;
const BASE = `http://localhost:${PORT}/api`;
const SELLER = '9600000001';
const otp = (phone) => jwt.sign({ phone, purpose: 'SIGNUP', otp: true }, env.jwtSecret, { expiresIn: '15m' });
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
const A = (p) => `/partner/admin${p}`;
const P = (p) => `/partner/admin/platform${p}`;
const login = async (email, password) => (await call('POST', A('/login'), { body: { email, password } }));

async function cleanup() {
  const admins = await M.PartnerAdmin.find({ email: /@admcheck\.test$/ }).select('_id').lean();
  const users = await M.User.find({ phone: SELLER }).select('_id businessId').lean();
  await Promise.all([
    M.PartnerAdmin.deleteMany({ email: /@admcheck\.test$/ }),
    M.SupportTicket.deleteMany({ userId: { $in: users.map((u) => u._id) } }),
    M.TutorialVideo.deleteMany({ key: /^admcheck-/ }),
    M.User.deleteMany({ phone: SELLER }),
    M.Business.deleteMany({ _id: { $in: users.map((u) => u.businessId) } }),
    M.Subscription.deleteMany({ businessId: { $in: users.map((u) => u.businessId) } }),
    M.Notification.deleteMany({ userId: { $in: users.map((u) => u._id) } }),
    M.AdminAudit.collection.deleteMany({ adminId: { $in: admins.map((a) => a._id) } }).catch(() => {}),
  ]);
  await M.TutorialView.deleteMany({ viewer: /admcheck/ });
  await M.AdminNotification.deleteMany({});
  await M.Announcement.deleteMany({ title: /^Admcheck/ });
}

async function run() {
  await connectDB();
  await cleanup();
  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    step('1. Super admin, roles');
    let r = await login('super@admcheck.test', 'Super12345x');
    let sTok = r.data?.token;
    check('bootstrap super admin signs in', Boolean(sTok) && r.data?.role === 'super', r.message);
    r = await call('GET', A('/me'), { token: sTok });
    check('super has every permission', r.data?.perms?.includes('admins:manage') && r.data?.perms?.length === Object.keys(r.data?.allPerms || {}).length, JSON.stringify(r.data?.perms));
    r = await call('POST', A('/admins'), { token: sTok, body: { email: 'weak@admcheck.test', name: 'Weak', role: 'support', password: 'short1' } });
    check('weak password rejected', r.status === 400, `${r.status}`);
    const mk = async (email, role, extra = {}) => (await call('POST', A('/admins'), { token: sTok, body: { email, name: role, role, password: 'Strong12345', ...extra } })).data;
    const sup = await mk('support@admcheck.test', 'support');
    const con = await mk('content@admcheck.test', 'content');
    const fin = await mk('finance@admcheck.test', 'finance', { require2fa: true });
    check('support, content and finance admins created', Boolean(sup?._id && con?._id && fin?._id));
    const supTok = (await login('support@admcheck.test', 'Strong12345')).data?.token;
    const conTok = (await login('content@admcheck.test', 'Strong12345')).data?.token;

    r = await call('GET', P('/businesses'), { token: supTok });
    check('support admin can view businesses', r.status === 200, `${r.status}`);
    r = await call('GET', P('/dashboard'), { token: supTok });
    const r0 = await call('GET', P('/dashboard'), { token: sTok });
    check('revenue hidden from support admin, shown to super', r.status === 200 && r.data?.revenue === null && r0.data?.revenue?.total !== undefined, JSON.stringify(r.data?.revenue));
    r = await call('PUT', P('/plans'), { token: supTok, body: {} });
    check('support admin cannot change plans', r.status === 403, `${r.status}`);
    r = await call('GET', P('/content'), { token: supTok });
    check('support admin cannot manage content', r.status === 403, `${r.status}`);
    r = await call('GET', A('/admins'), { token: conTok });
    check('content admin cannot manage admins', r.status === 403, `${r.status}`);
    r = await call('GET', P('/payments'), { token: conTok });
    check('content admin cannot see payments', r.status === 403, `${r.status}`);
    r = await call('PUT', A(`/admins/${sup._id}`), { token: supTok, body: { role: 'super' } });
    check('support admin cannot promote itself', r.status === 403, `${r.status}`);

    step('2. Security: lockout, forced 2FA, disable');
    for (let i = 0; i < 5; i++) await login('content@admcheck.test', 'wrong-pass-1');
    r = await login('content@admcheck.test', 'Strong12345');
    check('5 wrong passwords lock the account', r.status === 403 && /Try again/.test(r.message || ''), `${r.status} ${r.message}`);
    await call('POST', A(`/admins/${con._id}/reset`), { token: sTok, body: {} });
    r = await login('content@admcheck.test', 'Strong12345');
    check('super admin can unlock', r.status === 200, `${r.status}`);
    const conTok2 = r.data?.token;
    r = await call('GET', P('/content'), { token: conTok });
    check('old token stops after reset', r.status === 401, `${r.status}`);

    r = await login('finance@admcheck.test', 'Strong12345');
    const finTok = r.data?.token;
    check('forced 2FA admin is told to set it up', r.data?.mustSetup2fa === true, JSON.stringify(r.data));
    r = await call('GET', P('/payments'), { token: finTok });
    check('nothing opens until 2FA is on', r.status === 403 && r.details?.reason === 'setup_2fa', `${r.status}`);
    r = await call('GET', A('/me'), { token: finTok });
    check('profile still opens during setup', r.status === 200, `${r.status}`);

    step('3. Two-step verification');
    r = await call('POST', A('/2fa/start'), { token: sTok });
    const secret = r.data?.secret;
    check('2FA setup gives secret + authenticator link', /^[A-Z2-7]{32}$/.test(secret || '') && /^otpauth:\/\/totp\//.test(r.data?.otpauth || ''), JSON.stringify(r.data));
    r = await call('POST', A('/2fa/confirm'), { token: sTok, body: { code: '000000' } });
    check('wrong code does not turn it on', r.status === 400, `${r.status}`);
    r = await call('POST', A('/2fa/confirm'), { token: sTok, body: { code: codeAt(secret) } });
    const backups = r.data?.backupCodes || [];
    check('2FA on, 8 backup codes shown once', r.status === 200 && backups.length === 8, r.message);
    r = await login('super@admcheck.test', 'Super12345x');
    check('password alone no longer signs in', r.data?.twoFactor === true && !r.data?.token, JSON.stringify(r.data));
    let r2 = await call('POST', A('/login/2fa'), { body: { challenge: r.data?.challenge, code: '123456' } });
    check('wrong code rejected', r2.status === 401, `${r2.status}`);
    r2 = await call('POST', A('/login/2fa'), { body: { challenge: r.data?.challenge, code: codeAt(secret) } });
    check('correct code signs in', Boolean(r2.data?.token), r2.message);
    sTok = r2.data?.token;
    r = await login('super@admcheck.test', 'Super12345x');
    r2 = await call('POST', A('/login/2fa'), { body: { challenge: r.data?.challenge, code: backups[0] } });
    check('backup code works once', Boolean(r2.data?.token), r2.message);
    r = await login('super@admcheck.test', 'Super12345x');
    r2 = await call('POST', A('/login/2fa'), { body: { challenge: r.data?.challenge, code: backups[0] } });
    check('same backup code rejected the second time', r2.status === 401, `${r2.status}`);

    r = await call('PUT', A(`/admins/${sup._id}`), { token: sTok, body: { active: false } });
    r2 = await call('GET', P('/businesses'), { token: supTok });
    check('disabled admin is signed out immediately', r.status === 200 && r2.status === 401, `${r2.status}`);
    await call('PUT', A(`/admins/${sup._id}`), { token: sTok, body: { active: true } });
    const supTok2 = (await login('support@admcheck.test', 'Strong12345')).data?.token;
    const me = (await call('GET', A('/me'), { token: sTok })).data;
    r = await call('PUT', A(`/admins/${me._id}`), { token: sTok, body: { role: 'admin' } });
    check('cannot change own role', r.status === 400, `${r.status}`);
    const audits = await M.AdminAudit.countDocuments({ action: { $in: ['admin.created', 'admin.updated', 'admin.2fa_on', 'admin.locked', 'admin.login'] } });
    check('admin actions are in the audit log', audits >= 6, `${audits}`);

    step('4. Tutorials & content');
    r = await call('POST', P('/content'), { token: conTok2, body: { kind: 'video', title: 'Admcheck No link', status: 'published', placements: ['seller_signup'] } });
    check('video cannot be published without a link', r.status === 400, `${r.status}`);
    const mkC = async (b) => (await call('POST', P('/content'), { token: conTok2, body: { status: 'published', placements: ['seller_signup'], ...b } })).data;
    const v1 = await mkC({ kind: 'video', title: 'Admcheck Create seller account', titleHi: 'सेलर अकाउंट बनाएं', videos: { en: 'https://youtu.be/abc123', hi: '' } });
    await M.TutorialVideo.updateOne({ _id: v1._id }, { $set: { key: 'admcheck-v1' } });
    const v2 = await mkC({ kind: 'video', title: 'Admcheck Buyers only', userTypes: ['buyer'], videos: { hi: 'https://youtu.be/xyz' } });
    const v3 = await mkC({ kind: 'video', title: 'Admcheck Draft', status: 'draft', videos: { en: 'https://youtu.be/d' } });
    const v4 = await mkC({ kind: 'video', title: 'Admcheck Later', publishAt: new Date(Date.now() + 86400000), videos: { en: 'https://youtu.be/l' } });
    const v5 = await mkC({ kind: 'faq', title: 'Admcheck How long is the trial?', body: '15 days, no card needed.', placements: ['help'] });
    for (const d of [v2, v3, v4, v5]) await M.TutorialVideo.updateOne({ _id: d._id }, { $set: { key: `admcheck-${d._id}` } });
    r = await call('GET', '/content?placement=seller_signup&lang=hi');
    const titles = (r.data || []).map((x) => x.title);
    check('signup page (no login): published only, draft & scheduled hidden', titles.includes('सेलर अकाउंट बनाएं') && !titles.some((x) => /Draft|Later/.test(x)), JSON.stringify(titles));
    const seen = (r.data || []).find((x) => x._id === v1._id);
    check('Hindi asked, only English video → English plays, Hindi title', seen?.url === 'https://youtu.be/abc123' && seen?.lang === 'en', JSON.stringify(seen));
    const sellerTok = (await call('POST', '/auth/wholesaler/signup', { body: { name: 'Adm Seller', phone: SELLER, password: 'seller123', businessName: 'Admcheck Shop', otpToken: otp(SELLER) } })).data?.token;
    r = await call('GET', '/content?placement=seller_signup', { token: sellerTok });
    check('buyer-only video hidden from a seller', !(r.data || []).some((x) => x._id === v2._id) && (r.data || []).some((x) => x._id === v1._id), JSON.stringify((r.data || []).map((x) => x.title)));
    r = await call('GET', '/content?placement=help&kind=faq');
    check('FAQ served to help centre', (r.data || []).some((x) => x.body === '15 days, no card needed.'), JSON.stringify(r.data));
    await call('POST', `/content/${v1._id}/view`, { body: { viewerKey: 'admcheck-anon-1', lang: 'en', platform: 'android', seconds: 40, completed: true } });
    await call('POST', `/content/${v1._id}/view`, { body: { viewerKey: 'admcheck-anon-1', lang: 'en', platform: 'android', seconds: 10 } });
    await call('POST', `/content/${v1._id}/view`, { token: sellerTok, body: { lang: 'hi', platform: 'web', seconds: 20 } });
    r = await call('GET', P('/content'), { token: conTok2 });
    const st = r.data?.rows?.find((x) => x._id === v1._id)?.stats;
    check('analytics: 3 views, 2 unique, 33% completed, by language & platform', st?.views === 3 && st?.uniqueViewers === 2 && st?.completionRate === 33 && st?.byPlatform?.android === 2 && st?.byLang?.hi === 1, JSON.stringify(st));
    r = await call('PUT', P('/content/order'), { token: conTok2, body: { ids: [v5._id, v1._id] } });
    const o = await M.TutorialVideo.find({ _id: { $in: [v5._id, v1._id] } }).select('order').lean();
    check('reorder saved', r.status === 200 && o.find((x) => String(x._id) === v5._id)?.order === 1, JSON.stringify(o));

    step('5. Support tickets');
    r = await call('POST', '/support', { token: sellerTok, body: { category: 'billing', subject: 'Autopay not working', description: 'My autopay failed twice this month.', priority: 'high' } });
    const tk = r.data;
    check('seller opens a ticket', r.status === 201 && /^SUP-\d{5}$/.test(tk?.ticketNo || ''), r.message);
    r = await call('GET', P('/support'), { token: supTok2 });
    check('support admin sees it, marked urgent-ish', (r.data?.rows || []).some((x) => x._id === tk._id && x.priority === 'high') && r.data?.counts?.urgent >= 1, JSON.stringify(r.data?.counts));
    r = await call('POST', P(`/support/${tk._id}/reply`), { token: supTok2, body: { text: 'Customer seems upset — check Razorpay logs', internal: true } });
    r = await call('POST', P(`/support/${tk._id}/reply`), { token: supTok2, body: { text: 'Please retry now, we fixed the mandate.' } });
    check('reply sets waiting for user and assigns to replier', r.data?.status === 'waiting_user' && String(r.data?.assignedAdminId) === String(sup._id), JSON.stringify({ s: r.data?.status, a: r.data?.assignedAdminId }));
    r = await call('GET', `/support/${tk._id}`, { token: sellerTok });
    check('user sees reply but not the internal note', r.data?.messages?.length === 2 && !r.data.messages.some((m) => /upset/.test(m.text)), JSON.stringify(r.data?.messages?.map((m) => m.text)));
    const note = await M.Notification.findOne({ type: 'SUPPORT_REPLY' }).sort({ createdAt: -1 }).lean();
    check('user gets a notification', note && /SUP-/.test(note.title), note?.title);
    r = await call('POST', `/support/${tk._id}/messages`, { token: sellerTok, body: { text: 'Still failing.' } });
    check('user reply re-opens the ticket', r.data?.status === 'open', r.data?.status);
    r = await call('PUT', P(`/support/${tk._id}`), { token: supTok2, body: { assignedAdminId: con._id } });
    check('cannot assign to an admin without support access', r.status === 400, `${r.status}`);
    r = await call('PUT', P(`/support/${tk._id}`), { token: supTok2, body: { status: 'resolved', priority: 'urgent' } });
    check('status and priority updated', r.data?.status === 'resolved' && r.data?.priority === 'urgent', r.message);
    r = await call('GET', '/support/abcdefabcdefabcdefabcdef', { token: sellerTok });
    check('other ticket ids are not visible', r.status === 404, `${r.status}`);

    step('6. System settings, maintenance, alerts, announcements');
    r = await call('GET', P('/settings'), { token: supTok2 });
    check('support admin cannot open system settings', r.status === 403, `${r.status}`);
    r = await call('PUT', P('/settings'), { token: sTok, body: { platformName: 'RakhRakhav Test', supportWhatsapp: '9999999999', defaultLanguage: 'en', notify: { content_issue: false } } });
    check('super admin saves settings', r.status === 200 && r.data?.platformName === 'RakhRakhav Test' && r.data?.notify?.content_issue === false, r.message);
    r = await call('PUT', P('/settings'), { token: sTok, body: { logoUrl: 'javascript:alert(1)' } });
    check('unsafe logo link rejected', r.status === 400, `${r.status}`);
    r = await call('GET', '/public/platform');
    check('public platform info', r.data?.name === 'RakhRakhav Test' && r.data?.maintenance?.enabled === false, JSON.stringify(r.data));
    await call('PUT', P('/settings'), { token: sTok, body: { maintenance: { enabled: true, message: 'Back at 6 pm' } } });
    r = await call('GET', '/auth/me', { token: sellerTok });
    const r3 = await call('GET', P('/settings'), { token: sTok });
    const r4 = await call('GET', '/public/platform');
    check('maintenance: users get 503 with message, admin and public info work', r.status === 503 && r.message === 'Back at 6 pm' && r.details?.reason === 'maintenance' && r3.status === 200 && r4.data?.maintenance?.enabled, `${r.status} ${r3.status}`);
    await call('PUT', P('/settings'), { token: sTok, body: { maintenance: { enabled: false } } });
    r = await call('GET', '/auth/me', { token: sellerTok });
    check('maintenance off: users back', r.status === 200, `${r.status}`);
    const mAudit = await M.AdminAudit.countDocuments({ action: { $in: ['maintenance.on', 'maintenance.off'] } });
    check('maintenance switches are audited', mAudit >= 2, `${mAudit}`);

    for (let i = 0; i < 5; i++) await call('POST', '/auth/login', { body: { phone: SELLER, password: 'wrong-pass' } });
    r = await call('GET', P('/alerts'), { token: sTok });
    const types = (r.data || []).map((a) => a.type);
    check('alerts: new seller, urgent ticket, suspicious login', ['new_seller', 'urgent_ticket', 'suspicious_login'].every((x) => types.includes(x)) && r.meta?.unread >= 3, JSON.stringify(types));
    r = await call('GET', P('/alerts'), { token: conTok2 });
    check('content admin does not see seller/ticket alerts', r.status === 200 && !(r.data || []).some((a) => ['urgent_ticket', 'new_seller', 'suspicious_login'].includes(a.type)), JSON.stringify((r.data || []).map((a) => a.type)));
    r = await call('POST', P('/alerts/read'), { token: sTok, body: {} });
    const r5 = await call('GET', P('/alerts?unread=1'), { token: sTok });
    check('mark all read', r.data?.updated >= 3 && r5.meta?.unread === 0, JSON.stringify(r5.meta));

    const bizId = (await M.User.findOne({ phone: SELLER }).lean()).businessId;
    r = await call('POST', P('/announcements'), { token: conTok2, body: { title: 'Admcheck for your shop', audience: 'specific', channels: ['banner', 'notification'] } });
    check('specific-business announcement needs a business', r.status === 400, `${r.status}`);
    r = await call('POST', P('/announcements'), { token: conTok2, body: { title: 'Admcheck for your shop', audience: 'specific', businessIds: [String(bizId)], channels: ['banner', 'notification'] } });
    const annId = r.data?._id;
    r = await call('GET', '/announcements', { token: sellerTok });
    const r6 = await M.Notification.findOne({ userId: (await M.User.findOne({ phone: SELLER }).lean())._id, type: 'ANNOUNCEMENT' }).lean();
    check('targeted announcement: banner + notification reach the shop', (r.data || []).some((a) => a._id === annId) && r6?.title === 'Admcheck for your shop', JSON.stringify(r.data?.map((a) => a.title)));
    r = await call('POST', P('/announcements'), { token: conTok2, body: { title: 'Admcheck employees only', audience: 'employees' } });
    const empAnn = r.data?._id;
    r = await call('GET', '/announcements', { token: sellerTok });
    check('employee-only announcement hidden from shop owner', !(r.data || []).some((a) => a._id === empAnn), JSON.stringify(r.data?.map((a) => a.title)));
    r = await call('PUT', P('/plans'), { token: sTok, body: { featureLimits: { crm_reminders: { CHOTI: 30, BADHTI: null } } } });
    const lim = r.data?.limits?.find((l) => l.key === 'crm_reminders');
    check('feature limit per plan saved', lim?.values?.CHOTI === 30 && lim?.values?.BADHTI === null, JSON.stringify(lim));
    await call('PUT', P('/plans'), { token: sTok, body: { featureLimits: { crm_reminders: { CHOTI: 20 } } } });
    await call('PUT', P('/settings'), { token: sTok, body: { platformName: 'RakhRakhav', supportWhatsapp: '', notify: { content_issue: true } } });
    await M.Announcement.deleteMany({ title: /^Admcheck/ });

    step('7. Sign out everywhere');
    r = await call('POST', A('/logout'), { token: supTok2, body: { everywhere: true } });
    r2 = await call('GET', P('/support'), { token: supTok2 });
    check('all sessions end', r.status === 200 && r2.status === 401, `${r2.status}`);
  } finally {
    await cleanup().catch((e) => console.error(e));
    server.close();
    await mongoose.disconnect();
  }
  console.log(`\n${failed === 0 ? G : R}${passed} pass, ${failed} fail${N}\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => { console.error(`${R}Admin check crash:${N}`, err); process.exit(1); });

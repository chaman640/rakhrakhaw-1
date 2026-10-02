import { ROLES, NOTIFICATION_TYPES } from '../config/constants.js';
import { STAFF_ROLES, userCan } from '../config/permissions.js';
import { Business, User, ReportDigest } from '../models/index.js';
import { profitLossReport, outstandingReport } from './report.service.js';
import { notify } from './notification.service.js';

/**
 * HAFTE AUR MAHINE KA HISAAB — malik ke phone pe notification.
 *
 * Har ghante ka sweep (index.js) dekhta hai: somvaar subah 9 baje (IST) ke
 * baad pichhle hafte (somvaar–ravivaar) ka, aur har mahine ki 1 tareekh 9 baje
 * ke baad pichhle mahine ka fayda-nuksan aur aaj ka kul udhaar bhejta hai.
 * Server band raha ho to agle sweep me chala jata hai; ek period ek hi baar.
 * Malik ko hamesha; setting chalu ho to manager/admin staff ko bhi (jinke paas
 * fayda-nuksan dekhne ki ijazat hai).
 */

const MANAGER_ROLES = [STAFF_ROLES.ADMIN, STAFF_ROLES.MANAGER];

const IST_MS = 5.5 * 3600000;
const SEND_HOUR = 9;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ymd = (d) => d.toISOString().slice(0, 10);
const dm = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const rs = (n) => `₹${Math.round(Math.abs(Number(n) || 0)).toLocaleString('en-IN')}`;

/** Abhi bhejne layak period — IST tareekhen UTC Date me (sirf din ke liye) */
export function duePeriods(now = new Date()) {
  const ist = new Date(now.getTime() + IST_MS);
  const today = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  const afterHour = ist.getUTCHours() >= SEND_HOUR;
  const out = [];

  // Pichhla poora hafta (somvaar–ravivaar); is hafte ke somvaar 9 baje ke baad
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  const thisMonday = new Date(today.getTime() - sinceMonday * 86400000);
  if (sinceMonday > 0 || afterHour) {
    const from = new Date(thisMonday.getTime() - 7 * 86400000);
    const to = new Date(thisMonday.getTime() - 86400000);
    out.push({ kind: 'week', key: `W:${ymd(from)}`, from: ymd(from), to: ymd(to), label: `${dm(from)} – ${dm(to)}` });
  }

  // Pichhla poora mahina; is mahine ki 1 tareekh 9 baje ke baad
  if (today.getUTCDate() > 1 || afterHour) {
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    out.push({ kind: 'month', key: `M:${ymd(from).slice(0, 7)}`, from: ymd(from), to: ymd(to), label: `${MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()}` });
  }
  return out;
}

/** Ek dukaan ka hisaab ka notification — kuch hua hi na ho to `null` (khaali sandesh nahi) */
export async function buildDigest(businessId, period) {
  const [pl, dues] = await Promise.all([
    profitLossReport(businessId, { from: period.from, to: period.to }),
    outstandingReport(businessId, {}),
  ]);
  const m = pl.meta || {};
  const dueTotal = (dues.rows || []).reduce((s, r) => s + (r.balance || 0), 0);
  if (!m.bills && !m.expenseCount && !m.returns && dueTotal <= 0) return null;

  const title = period.kind === 'week' ? `Hafte ka hisaab — ${period.label}` : `Mahine ka hisaab — ${period.label}`;
  const top = (dues.rows || []).slice(0, 3).map((r) => `${r.label} ${rs(r.balance)}`).join(', ');
  const body = `Bikri ${rs(m.netSale)} · ${m.netProfit < 0 ? 'Nuksan' : 'Fayda'} ${rs(m.netProfit)} · Udhaar ${rs(dueTotal)}${top ? ` — ${top}` : ''}`;
  return {
    title,
    body,
    link: `/reports?from=${period.from}&to=${period.to}`,
    data: {
      period: period.key, from: period.from, to: period.to,
      sale: m.netSale || 0, profit: m.netProfit || 0, expenses: m.expenses || 0, bills: m.bills || 0,
      due: Math.round(dueTotal * 100) / 100, dueParties: (dues.rows || []).length,
    },
  };
}

/** Malik + (setting chalu ho to) manager/admin jinhe fayda-nuksan dekhne ki ijazat hai */
async function recipientsOf(shop) {
  const ids = [String(shop.ownerUserId)];
  if (shop.digestToManagers) {
    const staff = await User.find({ businessId: shop._id, role: ROLES.WHOLESALER, isActive: { $ne: false }, staffRole: { $in: MANAGER_ROLES } })
      .select('_id role staffRole permissions').lean();
    for (const u of staff) if (userCan(u, 'reports:profit') && !ids.includes(String(u._id))) ids.push(String(u._id));
  }
  return ids;
}

/** Har ghante — jinko is period ka hisaab nahi gaya unhe bhejo */
export async function sweepReportDigests(now = new Date()) {
  const periods = duePeriods(now);
  if (!periods.length) return 0;

  const sellers = await User.find({ role: ROLES.WHOLESALER, isActive: { $ne: false } }).distinct('_id');
  const shops = await Business.find({ ownerUserId: { $in: sellers } }).select('_id ownerUserId digestToManagers').lean();
  let sent = 0;

  for (const period of periods) {
    const done = new Set((await ReportDigest.find({ period: period.key }).distinct('businessId')).map(String));
    for (const shop of shops) {
      if (done.has(String(shop._id))) continue;
      try {
        // Pehle "ho gaya" likhte hain — doosra server ya agla sweep dobara na bheje
        await ReportDigest.create({ businessId: shop._id, period: period.key });
      } catch (e) {
        if (e?.code === 11000) continue;
        throw e;
      }
      try {
        const msg = await buildDigest(shop._id, period);
        if (!msg) continue;
        for (const userId of await recipientsOf(shop)) {
          await notify({ businessId: shop._id, userId, type: NOTIFICATION_TYPES.REPORT_DIGEST, ...msg });
          sent += 1;
        }
      } catch (e) {
        console.warn('[digest]', String(shop._id), e.message);
      }
    }
  }
  return sent;
}

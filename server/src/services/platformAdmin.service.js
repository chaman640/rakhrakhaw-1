import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { cacheDel } from '../utils/cache.js';
import { ROLES } from '../config/constants.js';
import { PLANS, PLAN_BY_CODE, SUB_STATUS, rupees, periodPricePaise, PERIODS } from '../config/billing.js';
import {
  Business, User, Subscription, BillingOrder, BillingCycle, AdminAudit, Announcement, PartnerAdmin,
  TutorialVideo, Item, Invoice, SupportTicket,
} from '../models/index.js';
import { statusOf, cancelSubscription, isFreeMode } from './billing.service.js';
import { platformConfig, updatePlatformConfig, featureMatrix } from './platform.service.js';

/**
 * ADMIN PANEL — RakhRakhav ka apna control room.
 *
 * Ye dukaan ka ERP NAHI hai. Admin kisi seller ka bill, khata, stock ya GST
 * nahi chhoota — wo sirf platform sambhalta hai: kaun aaya, kiska plan kya
 * hai, kisne paisa diya, kaunsa feature kis plan me, sabko kya batana hai.
 * Saara data wahi hai jo app me pehle se hai (Business, Subscription,
 * BillingOrder) — koi doosri copy nahi banti.
 *
 * HAR BADLAV KA RECORD (AdminAudit) — purana aur naya, dono.
 */

const DAY = 86400000;
const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ─────────────────────────────── register ─────────────────────────────── */

export async function audit(ctx, { action, targetType = '', targetId = '', targetLabel = '', before = null, after = null, note = '' }) {
  try {
    const admin = ctx?.adminId ? await PartnerAdmin.findById(ctx.adminId).select('email').lean() : null;
    await AdminAudit.create({
      adminId: ctx?.adminId || null,
      adminEmail: admin?.email || '',
      action, targetType, targetId: String(targetId || ''), targetLabel, before, after, note,
      ip: ctx?.ip || '',
    });
  } catch (e) {
    // Register fail ho to kaam nahi rukta — par log me zaroor aaye
    console.warn('[admin-audit] likha nahi gaya:', e.message);
  }
}

export async function listAudit({ action = '', page = 1, limit = 30 } = {}) {
  const filter = action ? { action: new RegExp(`^${esc(action)}`) } : {};
  const [rows, total] = await Promise.all([
    AdminAudit.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AdminAudit.countDocuments(filter),
  ]);
  return { rows, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/* ─────────────────────────────── dashboard ─────────────────────────────── */

function rangeOf({ range = '30d', from, to } = {}) {
  const now = new Date();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  switch (range) {
    case 'today': return { from: startOfDay(now), to: now };
    case 'yesterday': {
      const y = startOfDay(new Date(now.getTime() - DAY));
      return { from: y, to: startOfDay(now) };
    }
    case '7d': return { from: new Date(now.getTime() - 7 * DAY), to: now };
    case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'lastmonth': return {
      from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      to: new Date(now.getFullYear(), now.getMonth(), 1),
    };
    case 'custom': return {
      from: from ? new Date(from) : new Date(now.getTime() - 30 * DAY),
      to: to ? new Date(new Date(to).getTime() + DAY - 1) : now,
    };
    default: return { from: new Date(now.getTime() - 30 * DAY), to: now };
  }
}

async function revenueBetween(from, to) {
  const [r] = await BillingOrder.aggregate([
    { $match: { status: 'paid', paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, paise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
  ]);
  return { rupees: rupees(r?.paise || 0), count: r?.count || 0 };
}

export async function dashboard(query = {}) {
  const { from, to } = rangeOf(query);
  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sellerOwners = { role: ROLES.WHOLESALER, $or: [{ staffRole: 'owner' }, { staffRole: null }, { staffRole: { $exists: false } }] };
  const staffFilter = { role: ROLES.WHOLESALER, staffRole: { $nin: ['owner', null] } };

  const [
    sellers, staff, buyers, newSellers, newBuyers, inactiveUsers,
    activeBiz, suspendedBiz,
    trialOn, trialEnding, trialExpired, trialConverted, paidActive, grace, expiredPaid, cancelling, renewSoon,
    byPlan, revToday, revMonth, revRange, revTotal, failedRange, refunded,
    recentBiz, recentAudit,
  ] = await Promise.all([
    User.countDocuments(sellerOwners),
    User.countDocuments(staffFilter),
    User.countDocuments({ role: ROLES.RETAILER }),
    User.countDocuments({ ...sellerOwners, createdAt: { $gte: from, $lt: to } }),
    User.countDocuments({ role: ROLES.RETAILER, createdAt: { $gte: from, $lt: to } }),
    User.countDocuments({ isActive: false }),
    Business.countDocuments({ isActive: { $ne: false } }),
    Business.countDocuments({ isActive: false }),

    Subscription.countDocuments({ isTrial: true, paidTill: { $gte: now } }),
    Subscription.countDocuments({ isTrial: true, paidTill: { $gte: now, $lt: new Date(now.getTime() + 3 * DAY) } }),
    Subscription.countDocuments({ isTrial: true, paidTill: { $lt: now } }),
    Subscription.countDocuments({ isTrial: false, trialEndsAt: { $ne: null } }),
    Subscription.countDocuments({ isTrial: { $ne: true }, paidTill: { $gte: now } }),
    Subscription.countDocuments({ isTrial: { $ne: true }, paidTill: { $lt: now, $gte: new Date(now.getTime() - 7 * DAY) } }),
    Subscription.countDocuments({ isTrial: { $ne: true }, paidTill: { $lt: new Date(now.getTime() - 7 * DAY) } }),
    Subscription.countDocuments({ autoRenew: false, paidTill: { $gte: now } }),
    Subscription.countDocuments({ isTrial: { $ne: true }, autoRenew: true, paidTill: { $gte: now, $lt: new Date(now.getTime() + 7 * DAY) } }),

    Subscription.aggregate([
      { $match: { paidTill: { $gte: now } } },
      { $group: { _id: { plan: '$planCode', trial: '$isTrial', period: '$period' }, count: { $sum: 1 } } },
    ]),
    revenueBetween(todayStart, new Date(now.getTime() + 1)),
    revenueBetween(monthStart, new Date(now.getTime() + 1)),
    revenueBetween(from, to),
    revenueBetween(new Date(0), new Date(now.getTime() + 1)),
    BillingCycle.countDocuments({ status: 'failed', chargedAt: { $gte: from, $lt: to } }),
    BillingOrder.countDocuments({ status: 'refunded' }),

    Business.find({}).sort({ createdAt: -1 }).limit(8).select('name phone createdAt isActive').lean(),
    AdminAudit.find({}).sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const planRows = PLANS.filter((p) => p.pricePaise > 0).map((p) => {
    const rows = byPlan.filter((r) => r._id.plan === p.code);
    const paid = rows.filter((r) => !r._id.trial);
    return {
      code: p.code, name: p.name, priceRupees: rupees(p.pricePaise),
      trial: rows.filter((r) => r._id.trial).reduce((s, r) => s + r.count, 0),
      paidMonthly: paid.filter((r) => r._id.period !== PERIODS.YEARLY).reduce((s, r) => s + r.count, 0),
      paidYearly: paid.filter((r) => r._id.period === PERIODS.YEARLY).reduce((s, r) => s + r.count, 0),
    };
  });

  const [videos, publishedVideos, supportAgg] = await Promise.all([
    TutorialVideo.countDocuments({ kind: { $in: ['video', null] } }),
    TutorialVideo.countDocuments({ kind: { $in: ['video', null] }, status: { $in: ['published', null] } }),
    SupportTicket.aggregate([
      { $match: { status: { $in: ['open', 'in_progress', 'waiting_user'] } } },
      { $group: { _id: null, open: { $sum: 1 }, urgent: { $sum: { $cond: [{ $in: ['$priority', ['high', 'urgent']] }, 1, 0] } }, unread: { $sum: { $cond: [{ $gt: ['$adminUnread', 0] }, 1, 0] } } } },
    ]),
  ]);

  return {
    range: { from, to },
    billingMode: isFreeMode() ? 'free' : 'paid',
    users: {
      sellers, staff, buyers, newSellers, newBuyers, inactive: inactiveUsers,
      total: sellers + staff + buyers,
    },
    businesses: { active: activeBiz, suspended: suspendedBiz },
    subscriptions: {
      paidActive, grace, expired: expiredPaid, cancelling, renewSoon,
      byPlan: planRows,
    },
    trials: {
      active: trialOn, endingSoon: trialEnding, expired: trialExpired, converted: trialConverted,
      conversionRate: (trialConverted + trialExpired) > 0
        ? Math.round((trialConverted / (trialConverted + trialExpired)) * 100) : null,
    },
    revenue: {
      today: revToday, month: revMonth, range: revRange, total: revTotal,
      failedInRange: failedRange, refunded,
    },
    content: { videos, publishedVideos, draftVideos: videos - publishedVideos },
    support: { open: supportAgg[0]?.open || 0, urgent: supportAgg[0]?.urgent || 0, unread: supportAgg[0]?.unread || 0 },
    recentBusinesses: recentBiz,
    recentAdminActions: recentAudit,
  };
}

/* ─────────────────────────────── dukaanein (sellers) ─────────────────────────────── */

function subView(sub, now = new Date()) {
  if (!sub) return { planCode: '', planName: 'Koi plan nahi', status: 'none', isTrial: false, paidTill: null };
  const status = statusOf(sub, now);
  return {
    planCode: sub.planCode,
    planName: PLAN_BY_CODE[sub.planCode]?.name || sub.planCode,
    period: sub.period || PERIODS.MONTHLY,
    status: sub.isTrial && status === SUB_STATUS.ACTIVE ? 'trial' : status,
    isTrial: Boolean(sub.isTrial),
    paidTill: sub.paidTill,
    trialEndsAt: sub.trialEndsAt,
    autoRenew: sub.autoRenew !== false,
    mandateStatus: sub.mandateStatus || '',
    lastPayment: sub.lastPayment?.at ? sub.lastPayment : null,
  };
}

/** Status filter -> Subscription ki query */
function subFilterFor(status, now = new Date()) {
  const graceFrom = new Date(now.getTime() - 7 * DAY);
  switch (status) {
    case 'trial': return { isTrial: true, paidTill: { $gte: now } };
    case 'trial_expired': return { isTrial: true, paidTill: { $lt: now } };
    case 'active': return { isTrial: { $ne: true }, paidTill: { $gte: now } };
    case 'grace': return { isTrial: { $ne: true }, paidTill: { $lt: now, $gte: graceFrom } };
    case 'expired': return { isTrial: { $ne: true }, paidTill: { $lt: graceFrom } };
    case 'cancelling': return { autoRenew: false, paidTill: { $gte: now } };
    default: return null;
  }
}

export async function listBusinesses({ q = '', status = '', plan = '', suspended = '', page = 1, limit = 25 } = {}) {
  const filter = {};
  if (suspended === 'yes') filter.isActive = false;
  if (suspended === 'no') filter.isActive = { $ne: false };

  if (q) {
    const rx = new RegExp(esc(q.trim()), 'i');
    const owners = await User.find({ $or: [{ phone: rx }, { name: rx }], role: ROLES.WHOLESALER })
      .select('businessId').limit(200).lean();
    const ors = [{ name: rx }, { phone: rx }, { _id: { $in: owners.map((o) => o.businessId).filter(Boolean) } }];
    if (mongoose.isValidObjectId(q.trim())) ors.push({ _id: q.trim() });
    filter.$or = ors;
  }

  const subQ = subFilterFor(status);
  if (subQ || plan) {
    const subs = await Subscription.find({ ...(subQ || {}), ...(plan ? { planCode: plan } : {}) })
      .select('businessId').lean();
    filter._id = filter._id || { $in: subs.map((s) => s.businessId) };
    if (filter.$or) {
      // _id wala `$or` ke andar bhi ho sakta hai — dono shart saath lagani hain
      filter.$and = [{ _id: { $in: subs.map((s) => s.businessId) } }];
      delete filter._id;
    }
  } else if (status === 'none') {
    const withSub = await Subscription.distinct('businessId');
    filter._id = { $nin: withSub };
  }

  const [rows, total] = await Promise.all([
    Business.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('name phone ownerUserId createdAt isActive suspendedAt address.city gstin gstEnabled').lean(),
    Business.countDocuments(filter),
  ]);

  const ids = rows.map((b) => b._id);
  const [subs, owners] = await Promise.all([
    Subscription.find({ businessId: { $in: ids } }).lean(),
    User.find({ _id: { $in: rows.map((b) => b.ownerUserId).filter(Boolean) } })
      .select('name phone lastLoginAt isActive').lean(),
  ]);
  const subMap = new Map(subs.map((s) => [String(s.businessId), s]));
  const ownerMap = new Map(owners.map((u) => [String(u._id), u]));

  return {
    rows: rows.map((b) => {
      const o = ownerMap.get(String(b.ownerUserId));
      return {
        _id: b._id,
        name: b.name,
        phone: b.phone,
        city: b.address?.city || '',
        ownerName: o?.name || '',
        ownerPhone: o?.phone || '',
        lastLoginAt: o?.lastLoginAt || null,
        createdAt: b.createdAt,
        suspended: b.isActive === false,
        subscription: subView(subMap.get(String(b._id))),
      };
    }),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function businessDetail(id) {
  const b = await Business.findById(id)
    .select('name phone email address gstin gstEnabled ownerUserId createdAt isActive suspendedAt suspendReason requireApproval inviteEnabled')
    .lean();
  if (!b) throw ApiError.notFound('Dukaan nahi mili');

  const [owner, staff, sub, payments, cycles, itemCount, invoiceCount, actions] = await Promise.all([
    User.findById(b.ownerUserId).select('name phone lastLoginAt isActive createdAt').lean(),
    User.find({ businessId: b._id, role: ROLES.WHOLESALER, staffRole: { $nin: ['owner', null] } })
      .select('name phone staffRole isActive lastLoginAt').lean(),
    Subscription.findOne({ businessId: b._id }).lean(),
    BillingOrder.find({ businessId: b._id }).sort({ createdAt: -1 }).limit(30)
      .select('planCode months amountPaise status paidAt receiptNo providerPaymentId createdAt').lean(),
    BillingCycle.find({ businessId: b._id }).sort({ chargedAt: -1 }).limit(12).lean(),
    Item.countDocuments({ businessId: b._id }),
    Invoice.countDocuments({ businessId: b._id }),
    AdminAudit.find({ targetType: 'Business', targetId: String(b._id) }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);

  const planCode = sub?.planCode || '';
  const { featuresOfPlan } = await import('./platform.service.js');

  return {
    business: { ...b, suspended: b.isActive === false },
    owner,
    staff,
    staffCount: staff.length,
    subscription: subView(sub),
    enabledFeatures: planCode ? featuresOfPlan(planCode) : [],
    payments: payments.map((p) => ({ ...p, amountRupees: rupees(p.amountPaise), planName: PLAN_BY_CODE[p.planCode]?.name || p.planCode })),
    cycles: cycles.map((c) => ({ ...c, amountRupees: rupees(c.amountPaise) })),
    usage: { items: itemCount, invoices: invoiceCount },
    adminActions: actions,
  };
}

/* ───── admin ke kaam (har ek register me) ───── */

async function loadBiz(id) {
  const b = await Business.findById(id).select('name isActive suspendReason').lean();
  if (!b) throw ApiError.notFound('Dukaan nahi mili');
  return b;
}

export async function setSuspended(ctx, id, { suspended, reason = '' }) {
  const b = await loadBiz(id);
  await Business.updateOne({ _id: id }, {
    $set: suspended
      ? { isActive: false, suspendedAt: new Date(), suspendReason: reason }
      : { isActive: true, suspendedAt: null, suspendReason: '' },
  });
  cacheDel(`biz-active:${id}`);
  await audit(ctx, {
    action: suspended ? 'business.suspend' : 'business.activate',
    targetType: 'Business', targetId: id, targetLabel: b.name,
    before: { active: b.isActive !== false }, after: { active: !suspended }, note: reason,
  });
  return businessDetail(id);
}

/** Trial ya plan ke din badhana — paisa nahi, admin ki marzi (register me) */
export async function extendDays(ctx, id, { days, note = '' }) {
  const b = await loadBiz(id);
  const n = Math.round(Number(days));
  if (!(n >= 1 && n <= 366)) throw ApiError.badRequest('1 se 366 din tak');

  const sub = await Subscription.findOne({ businessId: id });
  if (!sub) throw ApiError.badRequest('Is dukaan ka koi plan/trial nahi — pehle plan lagaiye');

  const now = new Date();
  const from = sub.paidTill && sub.paidTill > now ? sub.paidTill : now;
  const before = { paidTill: sub.paidTill, isTrial: sub.isTrial };
  sub.paidTill = new Date(from.getTime() + n * DAY);
  if (sub.isTrial) sub.trialEndsAt = sub.paidTill;
  sub.cancelledAt = null;
  await sub.save();

  await audit(ctx, {
    action: sub.isTrial ? 'trial.extend' : 'subscription.extend',
    targetType: 'Business', targetId: id, targetLabel: b.name,
    before, after: { paidTill: sub.paidTill, days: n }, note,
  });
  return businessDetail(id);
}

/**
 * Plan badalna — admin ki taraf se (jaise shikayat pe bada plan de dena).
 *
 * Razorpay ka mandate YAHAN NAHI badalta — agla paisa purane plan ka hi
 * katega. Isliye jawab me saaf chetavni jati hai; ye rasta "sudhaar" ke liye
 * hai, grahak ka roz ka plan badalna usi ke Profile se hota hai.
 */
export async function changePlanByAdmin(ctx, id, { planCode, days = 0, note = '' }) {
  const b = await loadBiz(id);
  const plan = PLAN_BY_CODE[planCode];
  if (!plan || plan.pricePaise <= 0) throw ApiError.badRequest('Aisa koi plan nahi hai');

  const now = new Date();
  const sub = await Subscription.findOne({ businessId: id });
  const before = sub ? { planCode: sub.planCode, paidTill: sub.paidTill } : null;
  const extra = Math.max(0, Math.round(Number(days) || 0));
  const base = sub?.paidTill && sub.paidTill > now ? sub.paidTill : now;

  await Subscription.findOneAndUpdate(
    { businessId: id },
    {
      $set: {
        planCode: plan.code,
        pricePaise: plan.pricePaise,
        seats: plan.seats,
        paidTill: extra ? new Date(base.getTime() + extra * DAY) : (sub?.paidTill || now),
        pendingPlanCode: '',
        pendingFrom: null,
      },
      $setOnInsert: { businessId: id, startedAt: now, isTrial: false },
    },
    { upsert: true },
  );

  await audit(ctx, {
    action: 'plan.change',
    targetType: 'Business', targetId: id, targetLabel: b.name,
    before, after: { planCode: plan.code, days: extra }, note,
  });
  const out = await businessDetail(id);
  return {
    ...out,
    warning: sub?.providerSubId && sub?.mandateStatus === 'active'
      ? 'Autopay mandate purane plan ka hai — agla paisa usi hisaab se katega. Grahak Profile se plan badle to mandate bhi badlega.'
      : '',
  };
}

export async function cancelByAdmin(ctx, id, { note = '' }) {
  const b = await loadBiz(id);
  const before = await Subscription.findOne({ businessId: id }).select('autoRenew paidTill mandateStatus').lean();
  if (!before) throw ApiError.badRequest('Koi plan chalu nahi hai');
  await cancelSubscription(id);
  await audit(ctx, {
    action: 'subscription.cancel',
    targetType: 'Business', targetId: id, targetLabel: b.name,
    before, after: { autoRenew: false }, note,
  });
  return businessDetail(id);
}

/* ─────────────────────────────── users (sab tarah ke) ─────────────────────────────── */

export async function listUsers({ type = 'all', q = '', active = '', page = 1, limit = 30 } = {}) {
  const filter = {};
  if (type === 'seller') { filter.role = ROLES.WHOLESALER; filter.staffRole = { $in: ['owner', null] }; }
  if (type === 'staff') { filter.role = ROLES.WHOLESALER; filter.staffRole = { $nin: ['owner', null] }; }
  if (type === 'buyer') filter.role = ROLES.RETAILER;
  if (active === 'yes') filter.isActive = { $ne: false };
  if (active === 'no') filter.isActive = false;
  if (q) {
    const rx = new RegExp(esc(q.trim()), 'i');
    filter.$or = [{ name: rx }, { phone: rx }];
  }

  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('name phone role staffRole businessId isActive lastLoginAt createdAt').lean(),
    User.countDocuments(filter),
  ]);
  const biz = await Business.find({ _id: { $in: rows.map((u) => u.businessId).filter(Boolean) } }).select('name').lean();
  const bizMap = new Map(biz.map((b) => [String(b._id), b.name]));

  return {
    rows: rows.map((u) => ({
      _id: u._id,
      name: u.name,
      phone: u.phone,
      type: u.role === ROLES.RETAILER ? 'buyer' : (!u.staffRole || u.staffRole === 'owner' ? 'seller' : 'staff'),
      staffRole: u.staffRole || '',
      businessId: u.businessId,
      businessName: bizMap.get(String(u.businessId)) || '',
      active: u.isActive !== false,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    })),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/* ─────────────────────────────── payments ─────────────────────────────── */

export async function listPayments({ status = '', q = '', page = 1, limit = 30 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(esc(q.trim()), 'i');
    const biz = await Business.find({ $or: [{ name: rx }, { phone: rx }] }).select('_id').limit(200).lean();
    filter.$or = [{ businessId: { $in: biz.map((b) => b._id) } }, { providerPaymentId: rx }, { receiptNo: rx }];
  }
  const [rows, total, sums] = await Promise.all([
    BillingOrder.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    BillingOrder.countDocuments(filter),
    BillingOrder.aggregate([{ $match: filter }, { $group: { _id: '$status', paise: { $sum: '$amountPaise' }, n: { $sum: 1 } } }]),
  ]);
  const biz = await Business.find({ _id: { $in: rows.map((r) => r.businessId) } }).select('name phone').lean();
  const bizMap = new Map(biz.map((b) => [String(b._id), b]));
  return {
    rows: rows.map((r) => ({
      _id: r._id,
      businessId: r.businessId,
      businessName: bizMap.get(String(r.businessId))?.name || '',
      businessPhone: bizMap.get(String(r.businessId))?.phone || '',
      planCode: r.planCode,
      planName: PLAN_BY_CODE[r.planCode]?.name || r.planCode,
      months: r.months,
      period: r.months >= 12 ? 'yearly' : 'monthly',
      amountRupees: rupees(r.amountPaise),
      status: r.status,
      paymentId: r.providerPaymentId || '',
      orderId: r.providerOrderId || '',
      receiptNo: r.receiptNo || '',
      paidAt: r.paidAt,
      createdAt: r.createdAt,
      failReason: r.failReason || '',
    })),
    totals: Object.fromEntries(sums.map((s) => [s._id, { rupees: rupees(s.paise), count: s.n }])),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/* ─────────────────────────────── plans & features ─────────────────────────────── */

export function getPlansAndFeatures() {
  const cfg = platformConfig();
  return {
    trialDays: cfg.trialDays,
    trialPlanCode: cfg.trialPlanCode,
    supportPhone: cfg.supportPhone,
    supportEmail: cfg.supportEmail,
    plans: PLANS.filter((p) => p.pricePaise > 0).map((p) => ({
      code: p.code,
      name: p.name,
      priceRupees: rupees(p.pricePaise),
      yearlyRupees: rupees(periodPricePaise(p, PERIODS.YEARLY)),
      seats: p.seats,
      unlimited: p.seats === null,
      tagline: p.tagline,
      features: p.features,
      active: p.active !== false,
    })),
    features: featureMatrix(),
    updatedAt: cfg.updatedAt || null,
  };
}

export async function savePlansAndFeatures(ctx, body) {
  const patch = {};
  if (body.trialDays !== undefined) patch.trialDays = Number(body.trialDays);
  if (body.trialPlanCode !== undefined) patch.trialPlanCode = body.trialPlanCode;
  if (body.supportPhone !== undefined) patch.supportPhone = body.supportPhone;
  if (body.supportEmail !== undefined) patch.supportEmail = body.supportEmail;
  if (Array.isArray(body.plans)) {
    patch.plans = body.plans.map((p) => ({
      code: p.code,
      name: p.name,
      pricePaise: Math.round(Number(p.priceRupees) * 100),
      seats: p.unlimited ? undefined : Number(p.seats),
      unlimited: Boolean(p.unlimited),
      tagline: p.tagline,
      features: Array.isArray(p.features) ? p.features.map((f) => String(f).trim()).filter(Boolean) : undefined,
      active: p.active !== false,
    }));
    for (const p of patch.plans) {
      if (!(p.pricePaise >= 100)) throw ApiError.badRequest(`${p.code}: daam kam se kam ₹1`);
    }
  }
  if (body.featurePlans) patch.featurePlans = body.featurePlans;
  if (Array.isArray(body.featureOff)) patch.featureOff = body.featureOff;

  const { before, after } = await updatePlatformConfig(patch, ctx?.adminId);
  await audit(ctx, {
    action: body.plans ? 'plans.update' : (body.featurePlans || body.featureOff ? 'features.update' : 'settings.update'),
    targetType: 'PlatformConfig', targetId: 'main', targetLabel: 'Plans & Features',
    before, after,
  });
  return getPlansAndFeatures();
}

/* ─────────────────────────────── announcements ─────────────────────────────── */

export async function listAnnouncements() {
  return Announcement.find({}).sort({ createdAt: -1 }).limit(100).lean();
}

export async function saveAnnouncement(ctx, id, body) {
  const data = {
    title: body.title,
    body: body.body || '',
    link: body.link || '',
    tone: body.tone || 'info',
    audience: body.audience || 'all',
    planCodes: Array.isArray(body.planCodes) ? body.planCodes.filter((c) => PLAN_BY_CODE[c]) : [],
    startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
    active: body.active !== false,
  };
  if (!data.title?.trim()) throw ApiError.badRequest('Title zaroori hai');

  let doc;
  let before = null;
  if (id) {
    doc = await Announcement.findById(id);
    if (!doc) throw ApiError.notFound('Soochna nahi mili');
    before = doc.toObject();
    Object.assign(doc, data);
    await doc.save();
  } else {
    doc = await Announcement.create({ ...data, createdByAdminId: ctx?.adminId || null });
  }
  await audit(ctx, {
    action: id ? 'announcement.update' : 'announcement.create',
    targetType: 'Announcement', targetId: doc._id, targetLabel: doc.title, before, after: data,
  });
  return doc.toObject();
}

export async function deleteAnnouncement(ctx, id) {
  const doc = await Announcement.findByIdAndDelete(id).lean();
  if (!doc) throw ApiError.notFound('Soochna nahi mili');
  await audit(ctx, {
    action: 'announcement.delete', targetType: 'Announcement', targetId: id, targetLabel: doc.title, before: doc,
  });
  return { deleted: true };
}

/**
 * App ke andar — is aadmi ko abhi kaunsi soochna dikhni chahiye.
 *
 * Seller ke plan ka pata chalta hai to plan wali soochna bhi sahi logon ko.
 */
export async function activeAnnouncementsFor(user) {
  const now = new Date();
  const isSeller = user?.role === ROLES.WHOLESALER;
  const rows = await Announcement.find({
    active: true,
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
    audience: { $in: ['all', isSeller ? 'sellers' : 'buyers'] },
  }).sort({ startsAt: -1 }).limit(5).lean();

  let planCode = '';
  if (isSeller && rows.some((r) => r.planCodes?.length)) {
    const sub = await Subscription.findOne({ businessId: user.businessId }).select('planCode').lean();
    planCode = sub?.planCode || '';
  }
  return rows
    .filter((r) => !r.planCodes?.length || (isSeller && r.planCodes.includes(planCode)))
    .map((r) => ({ _id: r._id, title: r.title, body: r.body, link: r.link, tone: r.tone, startsAt: r.startsAt }));
}

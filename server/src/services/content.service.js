import crypto from 'crypto';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/constants.js';
import { STAFF_ROLES } from '../config/permissions.js';
import {
  CONTENT_PLACEMENTS, CONTENT_CATEGORIES, CONTENT_USER_TYPES, CONTENT_PLATFORMS, CONTENT_STATUS,
} from '../config/contentOptions.js';
import { TutorialVideo, TutorialView } from '../models/index.js';
import { subscriptionOf } from './billing.service.js';
import { audit } from './platformAdmin.service.js';

const userTypeOf = (u) => (!u ? '' : u.role === ROLES.RETAILER ? 'buyer' : u.staffRole === STAFF_ROLES.EMPLOYEE ? 'employee' : 'seller');

/** Bhasha chuno; na mile to doosri — khali kabhi nahi */
function localise(doc, lang) {
  const other = lang === 'hi' ? 'en' : 'hi';
  const url = doc.videos?.[lang] || doc.videos?.[other] || '';
  const hi = lang === 'hi';
  return {
    _id: doc._id,
    key: doc.key,
    kind: doc.kind || 'video',
    title: (hi && doc.titleHi) || doc.title,
    description: doc.description || '',
    body: (hi && doc.bodyHi) || doc.body || '',
    thumbnailUrl: doc.thumbnailUrl || '',
    url,
    lang: doc.videos?.[lang] ? lang : (url ? other : lang),
    featured: Boolean(doc.featured),
    category: doc.category || '',
  };
}

/** Is page pe, is aadmi ko, is device pe kya dikhe */
export async function forPlacement(user, { placement, lang = 'en', platform = 'web', kind = '' }) {
  const now = new Date();
  const filter = {
    status: { $in: ['published', null] },
    $and: [{ $or: [{ publishAt: null }, { publishAt: { $lte: now } }] }],
  };
  if (placement) filter.placements = placement;
  if (kind) filter.kind = kind;
  const type = userTypeOf(user);
  let plan = '';
  if (user?.businessId && user.role === ROLES.WHOLESALER) {
    try { plan = (await subscriptionOf(user.businessId)).plan?.code || ''; } catch { plan = ''; }
  }
  const rows = await TutorialVideo.find(filter).sort({ featured: -1, order: 1, createdAt: 1 }).limit(50).lean();
  return rows
    .filter((r) => !r.userTypes?.length || !type || r.userTypes.includes(type))
    .filter((r) => !r.plans?.length || !plan || r.plans.includes(plan))
    .filter((r) => !r.platforms?.length || r.platforms.includes(platform))
    .map((r) => localise(r, lang === 'hi' ? 'hi' : 'en'))
    .filter((r) => r.kind !== 'video' || r.url);
}

export async function recordView(user, id, body) {
  if (!(await TutorialVideo.exists({ _id: id }))) throw ApiError.notFound('Not found');
  const viewer = user?._id ? `u:${user._id}` : `a:${crypto.createHash('sha1').update(String(body.viewerKey || '')).digest('hex').slice(0, 16)}`;
  await TutorialView.create({
    tutorialId: id, viewer, userId: user?._id || null,
    lang: body.lang || '', platform: body.platform || '', seconds: Math.min(body.seconds || 0, 36000), completed: Boolean(body.completed),
  });
  return { ok: true };
}

/* ─────────────────────────────── admin ─────────────────────────────── */

export function contentOptions() {
  return {
    placements: CONTENT_PLACEMENTS.map(([value, label]) => ({ value, label })),
    categories: CONTENT_CATEGORIES,
    userTypes: CONTENT_USER_TYPES,
    platforms: CONTENT_PLATFORMS,
    statuses: CONTENT_STATUS,
  };
}

export async function adminList({ kind = '', status = '', placement = '' } = {}) {
  const f = {};
  if (kind) f.kind = kind === 'video' ? { $in: ['video', null] } : kind;
  if (status) f.status = status;
  if (placement) f.placements = placement;
  const rows = await TutorialVideo.find(f).sort({ order: 1, createdAt: 1 }).lean();
  const stats = await TutorialView.aggregate([
    { $match: { tutorialId: { $in: rows.map((r) => r._id) } } },
    {
      $group: {
        _id: '$tutorialId', views: { $sum: 1 }, viewers: { $addToSet: '$viewer' }, completed: { $sum: { $cond: ['$completed', 1, 0] } },
        seconds: { $avg: '$seconds' }, last: { $max: '$createdAt' }, langs: { $push: '$lang' }, platforms: { $push: '$platform' },
      },
    },
  ]);
  const tally = (arr) => arr.filter(Boolean).reduce((m, x) => ({ ...m, [x]: (m[x] || 0) + 1 }), {});
  const sm = new Map(stats.map((s) => [String(s._id), {
    views: s.views, uniqueViewers: s.viewers.length, completionRate: s.views ? Math.round((s.completed / s.views) * 100) : 0,
    avgSeconds: Math.round(s.seconds || 0), lastViewedAt: s.last, byLang: tally(s.langs), byPlatform: tally(s.platforms),
  }]));
  const counts = await TutorialVideo.aggregate([{ $group: { _id: { k: '$kind', s: '$status' }, n: { $sum: 1 } } }]);
  return {
    rows: rows.map((r) => ({ ...r, kind: r.kind || 'video', status: r.status || 'published', stats: sm.get(String(r._id)) || { views: 0, uniqueViewers: 0, completionRate: 0, avgSeconds: 0, lastViewedAt: null, byLang: {}, byPlatform: {} } })),
    counts: counts.map((c) => ({ kind: c._id.k || 'video', status: c._id.s || 'published', n: c.n })),
    options: contentOptions(),
  };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export async function adminSave(ctx, id, body) {
  const placements = (body.placements || []).filter((p) => CONTENT_PLACEMENTS.some(([v]) => v === p));
  const data = { ...body, placements };
  if (data.kind === 'video' && data.status === 'published' && !data.videos?.hi && !data.videos?.en) {
    throw ApiError.badRequest('Add at least one video link (Hindi or English) before publishing');
  }
  let doc;
  if (id) {
    const before = await TutorialVideo.findById(id).lean();
    if (!before) throw ApiError.notFound('Not found');
    doc = await TutorialVideo.findByIdAndUpdate(id, { $set: data }, { new: true });
    const published = before.status !== 'published' && doc.status === 'published';
    await audit(ctx, { action: published ? 'content.published' : 'content.edited', targetType: 'TutorialVideo', targetId: id, targetLabel: doc.title, before: { status: before.status }, after: { status: doc.status } });
  } else {
    let key = body.key || slug(body.title) || `item-${Date.now()}`;
    if (await TutorialVideo.exists({ key })) key = `${key}-${Date.now().toString(36)}`;
    const last = await TutorialVideo.findOne().sort({ order: -1 }).select('order').lean();
    doc = await TutorialVideo.create({ ...data, key, order: (last?.order || 0) + 1 });
    await audit(ctx, { action: 'content.added', targetType: 'TutorialVideo', targetId: doc._id, targetLabel: doc.title, after: { kind: doc.kind, status: doc.status } });
  }
  return doc;
}

export async function adminReorder(ctx, ids) {
  await Promise.all(ids.map((id, i) => TutorialVideo.updateOne({ _id: id }, { $set: { order: i + 1 } })));
  await audit(ctx, { action: 'content.reordered', targetType: 'TutorialVideo', note: `${ids.length} items` });
  return { ok: true };
}

export async function adminDelete(ctx, id) {
  const doc = await TutorialVideo.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound('Not found');
  await TutorialView.deleteMany({ tutorialId: id });
  await audit(ctx, { action: 'content.deleted', targetType: 'TutorialVideo', targetId: id, targetLabel: doc.title });
  return { deleted: true };
}

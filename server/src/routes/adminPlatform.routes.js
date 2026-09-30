import { Router } from 'express';
import { z } from 'zod';
import { requirePartnerAdmin, requireAdminPerm as can } from '../middleware/partnerAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as svc from '../services/platformAdmin.service.js';
import * as support from '../services/support.service.js';
import * as content from '../services/content.service.js';
import { CONTENT_CATEGORIES, CONTENT_USER_TYPES, CONTENT_PLATFORMS, CONTENT_STATUS } from '../config/contentOptions.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { TICKET_STATUS, TICKET_PRIORITY } from '../models/SupportTicket.js';

/**
 * ADMIN PANEL KE RASTE — `/api/partner/admin/platform/*`.
 *
 * Wahi admin login (`requirePartnerAdmin`) jo salesman aur tutorial ke liye
 * pehle se hai — dukaan ka login yahan kabhi nahi chalta (token ka `aud`
 * alag hai). Koi public signup nahi; admin sirf `.env` se banta hai.
 */
const router = Router();
router.use(requirePartnerAdmin);

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const idParam = z.object({ id: objectId });
const page = z.coerce.number().int().min(1).max(10000).optional().default(1);
const ctxOf = (req) => ({ adminId: req.adminId, ip: req.ip });

router.get('/dashboard', can('dashboard'), validate({
  query: z.object({
    range: z.enum(['today', 'yesterday', '7d', '30d', 'month', 'lastmonth', 'custom']).optional().default('30d'),
    from: z.string().optional(), to: z.string().optional(),
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.dashboard(req.query))));

/* ── dukaanein ── */
router.get('/businesses', can('businesses:view'), validate({
  query: z.object({
    q: z.string().trim().max(60).optional().default(''),
    status: z.enum(['', 'trial', 'trial_expired', 'active', 'grace', 'expired', 'cancelling', 'none']).optional().default(''),
    plan: z.string().trim().max(20).optional().default(''),
    suspended: z.enum(['', 'yes', 'no']).optional().default(''),
    page,
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.listBusinesses(req.query))));

router.get('/businesses/:id', can('businesses:view'), validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await svc.businessDetail(req.params.id))));

router.post('/businesses/:id/suspend', can('businesses:manage'), validate({
  params: idParam,
  body: z.object({ suspended: z.boolean(), reason: z.string().trim().max(300).optional().default('') }),
}), asyncHandler(async (req, res) => {
  const out = await svc.setSuspended(ctxOf(req), req.params.id, req.body);
  return ok(res, out, req.body.suspended ? 'Dukaan band kar di' : 'Dukaan chalu kar di');
}));

router.post('/businesses/:id/extend', can('businesses:manage'), validate({
  params: idParam,
  body: z.object({ days: z.coerce.number().int().min(1).max(366), note: z.string().trim().max(300).optional().default('') }),
}), asyncHandler(async (req, res) => ok(res, await svc.extendDays(ctxOf(req), req.params.id, req.body), 'Din badha diye')));

router.post('/businesses/:id/plan', can('businesses:manage'), validate({
  params: idParam,
  body: z.object({
    planCode: z.string().trim().max(20),
    days: z.coerce.number().int().min(0).max(366).optional().default(0),
    note: z.string().trim().max(300).optional().default(''),
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.changePlanByAdmin(ctxOf(req), req.params.id, req.body), 'Plan badal diya')));

router.post('/businesses/:id/cancel', can('businesses:manage'), validate({
  params: idParam, body: z.object({ note: z.string().trim().max(300).optional().default('') }),
}), asyncHandler(async (req, res) => ok(res, await svc.cancelByAdmin(ctxOf(req), req.params.id, req.body), 'Renew band kar diya')));

/* ── users ── */
router.get('/users', can('businesses:view'), validate({
  query: z.object({
    type: z.enum(['all', 'seller', 'staff', 'buyer']).optional().default('all'),
    q: z.string().trim().max(60).optional().default(''),
    active: z.enum(['', 'yes', 'no']).optional().default(''),
    page,
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.listUsers(req.query))));

/* ── payments ── */
router.get('/payments', can('payments:view'), validate({
  query: z.object({
    status: z.enum(['', 'created', 'paid', 'failed', 'refunded']).optional().default(''),
    q: z.string().trim().max(60).optional().default(''),
    page,
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.listPayments(req.query))));

/* ── plans & features ── */
router.get('/plans', can('dashboard'), asyncHandler(async (req, res) => ok(res, svc.getPlansAndFeatures())));
router.put('/plans', can('plans:manage'), validate({
  body: z.object({
    trialDays: z.coerce.number().int().min(0).max(90).optional(),
    trialPlanCode: z.string().trim().max(20).optional(),
    supportPhone: z.string().trim().max(20).optional(),
    supportEmail: z.string().trim().max(120).optional(),
    plans: z.array(z.object({
      code: z.string().trim().max(20),
      name: z.string().trim().min(2).max(60),
      priceRupees: z.coerce.number().min(1).max(1000000),
      seats: z.coerce.number().int().min(1).max(100000).optional(),
      unlimited: z.boolean().optional().default(false),
      tagline: z.string().trim().max(120).optional().default(''),
      features: z.array(z.string().trim().max(120)).max(12).optional(),
      active: z.boolean().optional().default(true),
    })).max(10).optional(),
    featurePlans: z.record(z.array(z.string().trim().max(20)).max(10)).optional(),
    featureOff: z.array(z.string().trim().max(40)).max(50).optional(),
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.savePlansAndFeatures(ctxOf(req), req.body), 'Setting save ho gayi')));

/* ── soochna ── */
const annBody = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().max(1000).optional().default(''),
  link: z.string().trim().max(300).optional().default(''),
  tone: z.enum(['info', 'success', 'warning']).optional().default('info'),
  audience: z.enum(['all', 'sellers', 'buyers']).optional().default('all'),
  planCodes: z.array(z.string().trim().max(20)).max(10).optional().default([]),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});
router.get('/announcements', can('announcements:manage'), asyncHandler(async (req, res) => ok(res, await svc.listAnnouncements())));
router.post('/announcements', can('announcements:manage'), validate({ body: annBody }),
  asyncHandler(async (req, res) => created(res, await svc.saveAnnouncement(ctxOf(req), null, req.body), 'Soochna ban gayi')));
router.put('/announcements/:id', can('announcements:manage'), validate({ params: idParam, body: annBody }),
  asyncHandler(async (req, res) => ok(res, await svc.saveAnnouncement(ctxOf(req), req.params.id, req.body), 'Soochna badal di')));
router.delete('/announcements/:id', can('announcements:manage'), validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await svc.deleteAnnouncement(ctxOf(req), req.params.id), 'Soochna hata di')));

/* ── register ── */
router.get('/audit', can('audit:view'), validate({
  query: z.object({ action: z.string().trim().max(40).optional().default(''), page }),
}), asyncHandler(async (req, res) => ok(res, await svc.listAudit(req.query))));

/* ── content (tutorials, articles, FAQ) ── */
const cms = can('content:manage');
const url = z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), 'Use a full link starting with http(s)://').optional().default('');
const contentBody = z.object({
  kind: z.enum(['video', 'article', 'faq']),
  title: z.string().trim().min(3).max(160),
  titleHi: z.string().trim().max(160).optional().default(''),
  description: z.string().trim().max(500).optional().default(''),
  body: z.string().trim().max(10000).optional().default(''),
  bodyHi: z.string().trim().max(10000).optional().default(''),
  thumbnailUrl: url,
  videos: z.object({ hi: url, en: url }).optional().default({}),
  category: z.enum(['', ...CONTENT_CATEGORIES]).optional().default(''),
  placements: z.array(z.string().max(40)).max(30).optional().default([]),
  userTypes: z.array(z.enum(CONTENT_USER_TYPES)).optional().default([]),
  plans: z.array(z.string().trim().max(20)).max(10).optional().default([]),
  platforms: z.array(z.enum(CONTENT_PLATFORMS)).optional().default([]),
  status: z.enum(CONTENT_STATUS).optional().default('draft'),
  publishAt: z.coerce.date().nullable().optional().default(null),
  featured: z.boolean().optional().default(false),
  inOnboardingTour: z.boolean().optional().default(false),
});
router.get('/content', cms, validate({
  query: z.object({ kind: z.enum(['', 'video', 'article', 'faq']).optional().default(''), status: z.enum(['', ...CONTENT_STATUS]).optional().default(''), placement: z.string().max(40).optional().default('') }),
}), asyncHandler(async (req, res) => ok(res, await content.adminList(req.query))));
router.post('/content', cms, validate({ body: contentBody }), asyncHandler(async (req, res) => created(res, await content.adminSave(ctxOf(req), null, req.body), 'Saved')));
router.put('/content/order', cms, validate({ body: z.object({ ids: z.array(objectId).min(1).max(500) }) }), asyncHandler(async (req, res) => ok(res, await content.adminReorder(ctxOf(req), req.body.ids), 'Order saved')));
router.put('/content/:id', cms, validate({ params: idParam, body: contentBody }), asyncHandler(async (req, res) => ok(res, await content.adminSave(ctxOf(req), req.params.id, req.body), 'Saved')));
router.delete('/content/:id', cms, validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await content.adminDelete(ctxOf(req), req.params.id), 'Deleted')));

/* ── support ── */
const sup = can('support:manage');
router.get('/support', sup, validate({
  query: z.object({
    status: z.enum(['', 'active', ...TICKET_STATUS]).optional().default('active'),
    priority: z.enum(['', ...TICKET_PRIORITY]).optional().default(''),
    assigned: z.enum(['', 'me', 'none']).optional().default(''),
    q: z.string().trim().max(60).optional().default(''),
    page,
  }),
}), asyncHandler(async (req, res) => ok(res, await support.adminList(req.query, req.adminId))));
router.get('/support/admins', sup, asyncHandler(async (req, res) => ok(res, await support.supportAdmins())));
router.get('/support/:id', sup, validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await support.adminGet(req.params.id))));
router.post('/support/:id/reply', sup, validate({ params: idParam }), uploadImage.array('files', 3), handleUploadError, validate({
  body: z.object({
    text: z.string().trim().max(3000).optional().default(''),
    internal: z.preprocess((v) => v === true || v === 'true', z.boolean()).optional().default(false),
    status: z.enum(TICKET_STATUS).optional(),
  }),
}), asyncHandler(async (req, res) => ok(res, await support.adminReply(ctxOf(req), req.params.id, req.body, req.files), req.body.internal ? 'Note added' : 'Reply sent')));
router.put('/support/:id', sup, validate({
  params: idParam,
  body: z.object({ status: z.enum(TICKET_STATUS).optional(), priority: z.enum(TICKET_PRIORITY).optional(), assignedAdminId: objectId.nullable().optional() }),
}), asyncHandler(async (req, res) => ok(res, await support.adminUpdate(ctxOf(req), req.params.id, req.body), 'Ticket updated')));

export default router;

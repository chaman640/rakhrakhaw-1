import { Router } from 'express';
import { z } from 'zod';
import { requirePartnerAdmin } from '../middleware/partnerAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as svc from '../services/platformAdmin.service.js';

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

router.get('/dashboard', validate({
  query: z.object({
    range: z.enum(['today', 'yesterday', '7d', '30d', 'month', 'lastmonth', 'custom']).optional().default('30d'),
    from: z.string().optional(), to: z.string().optional(),
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.dashboard(req.query))));

/* ── dukaanein ── */
router.get('/businesses', validate({
  query: z.object({
    q: z.string().trim().max(60).optional().default(''),
    status: z.enum(['', 'trial', 'trial_expired', 'active', 'grace', 'expired', 'cancelling', 'none']).optional().default(''),
    plan: z.string().trim().max(20).optional().default(''),
    suspended: z.enum(['', 'yes', 'no']).optional().default(''),
    page,
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.listBusinesses(req.query))));

router.get('/businesses/:id', validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await svc.businessDetail(req.params.id))));

router.post('/businesses/:id/suspend', validate({
  params: idParam,
  body: z.object({ suspended: z.boolean(), reason: z.string().trim().max(300).optional().default('') }),
}), asyncHandler(async (req, res) => {
  const out = await svc.setSuspended(ctxOf(req), req.params.id, req.body);
  return ok(res, out, req.body.suspended ? 'Dukaan band kar di' : 'Dukaan chalu kar di');
}));

router.post('/businesses/:id/extend', validate({
  params: idParam,
  body: z.object({ days: z.coerce.number().int().min(1).max(366), note: z.string().trim().max(300).optional().default('') }),
}), asyncHandler(async (req, res) => ok(res, await svc.extendDays(ctxOf(req), req.params.id, req.body), 'Din badha diye')));

router.post('/businesses/:id/plan', validate({
  params: idParam,
  body: z.object({
    planCode: z.string().trim().max(20),
    days: z.coerce.number().int().min(0).max(366).optional().default(0),
    note: z.string().trim().max(300).optional().default(''),
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.changePlanByAdmin(ctxOf(req), req.params.id, req.body), 'Plan badal diya')));

router.post('/businesses/:id/cancel', validate({
  params: idParam, body: z.object({ note: z.string().trim().max(300).optional().default('') }),
}), asyncHandler(async (req, res) => ok(res, await svc.cancelByAdmin(ctxOf(req), req.params.id, req.body), 'Renew band kar diya')));

/* ── users ── */
router.get('/users', validate({
  query: z.object({
    type: z.enum(['all', 'seller', 'staff', 'buyer']).optional().default('all'),
    q: z.string().trim().max(60).optional().default(''),
    active: z.enum(['', 'yes', 'no']).optional().default(''),
    page,
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.listUsers(req.query))));

/* ── payments ── */
router.get('/payments', validate({
  query: z.object({
    status: z.enum(['', 'created', 'paid', 'failed', 'refunded']).optional().default(''),
    q: z.string().trim().max(60).optional().default(''),
    page,
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.listPayments(req.query))));

/* ── plans & features ── */
router.get('/plans', asyncHandler(async (req, res) => ok(res, svc.getPlansAndFeatures())));
router.put('/plans', validate({
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
router.get('/announcements', asyncHandler(async (req, res) => ok(res, await svc.listAnnouncements())));
router.post('/announcements', validate({ body: annBody }),
  asyncHandler(async (req, res) => created(res, await svc.saveAnnouncement(ctxOf(req), null, req.body), 'Soochna ban gayi')));
router.put('/announcements/:id', validate({ params: idParam, body: annBody }),
  asyncHandler(async (req, res) => ok(res, await svc.saveAnnouncement(ctxOf(req), req.params.id, req.body), 'Soochna badal di')));
router.delete('/announcements/:id', validate({ params: idParam }),
  asyncHandler(async (req, res) => ok(res, await svc.deleteAnnouncement(ctxOf(req), req.params.id), 'Soochna hata di')));

/* ── register ── */
router.get('/audit', validate({
  query: z.object({ action: z.string().trim().max(40).optional().default(''), page }),
}), asyncHandler(async (req, res) => ok(res, await svc.listAudit(req.query))));

export default router;

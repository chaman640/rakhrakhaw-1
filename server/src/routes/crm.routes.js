import { Router } from 'express';
import { z } from 'zod';
import { requireFeature } from '../middleware/feature.js';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import { LEAD_STAGES, LEAD_SOURCES } from '../models/Lead.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as ctrl from '../controllers/crm.controller.js';
import * as work from '../services/crmWork.service.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

// `parties:view` reuse kiya — CRM retailer data hi dikha raha hai, alag
// permission banane se sirf ek aur cheez ho jaati jo admin ko staff-role
// screen pe alag se on karni padti, bina kisi fayde ke.
router.get('/overview', requirePermission('parties:view'), requireFeature('crm_basic'), ctrl.overview);

/*
  LEADS, KAAM, AAJ KA KAAM, TEAM (crmWork.service.js). Plan ki rok service ke
  andar hai (kuch raste ek se zyada feature pe tike hain — jaise kaam dusre
  ko dena). Padhne ke liye `parties:view`, banane ke liye `parties:create`;
  apna kaam/lead badalne ki ijazat service khud dekhti hai (assignee/banane
  wala/malik).
*/
const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const idP = z.object({ id: oid });
const page = z.coerce.number().int().min(1).max(1000).optional().default(1);
const date = z.coerce.date().nullable().optional();
const h = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req)));
// List — app ke baaki list jaisa jawab: `data` me rows, `meta` alag (useListQuery isi ko padhta hai)
const list = (fn) => asyncHandler(async (req, res) => {
  const { rows, meta } = await fn(req);
  return res.json({ success: true, message: 'OK', data: rows, meta });
});

router.get('/staff', requirePermission('parties:view'), h((req) => work.assignableStaff(req.businessId)));
router.get('/today', h((req) => work.today(req.businessId, req.user)));

router.get('/pipeline', requirePermission('parties:view'), h((req) => work.pipeline(req.businessId, req.user)));
router.get('/leads', requirePermission('parties:view'), validate({
  query: z.object({
    stage: z.enum(['', 'open', ...LEAD_STAGES]).optional().default(''),
    q: z.string().trim().max(60).optional().default(''),
    assigned: z.string().trim().max(24).optional().default(''),
    page,
  }),
}), list((req) => work.listLeads(req.businessId, req.user, req.query)));

const leadBody = z.object({
  name: z.string().trim().min(2).max(120),
  shopName: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().max(20).optional().default(''),
  city: z.string().trim().max(60).optional().default(''),
  source: z.enum(LEAD_SOURCES).optional().default('other'),
  expectedValue: z.coerce.number().min(0).max(1e9).optional().default(0),
  assignedToUserId: oid.nullable().optional(),
  nextFollowUpAt: date,
  note: z.string().trim().max(1000).optional().default(''),
});
router.post('/leads', requirePermission('parties:create'), validate({ body: leadBody }),
  asyncHandler(async (req, res) => created(res, await work.createLead(req.businessId, req.user, req.body), 'Lead ban gaya')));
router.get('/leads/:id', requirePermission('parties:view'), validate({ params: idP }), h((req) => work.getLead(req.businessId, req.user, req.params.id)));
router.put('/leads/:id', requirePermission('parties:view'), validate({
  params: idP,
  body: leadBody.partial().extend({
    stage: z.enum(LEAD_STAGES).optional(),
    lostReason: z.string().trim().max(200).optional(),
  }),
}), h((req) => work.updateLead(req.businessId, req.user, req.params.id, req.body)));
router.post('/leads/:id/notes', requirePermission('parties:view'), validate({
  params: idP,
  body: z.object({
    text: z.string().trim().min(1).max(1000),
    kind: z.enum(['note', 'call', 'meeting', 'visit']).optional().default('note'),
    nextFollowUpAt: date,
  }),
}), h((req) => work.addLeadNote(req.businessId, req.user, req.params.id, req.body)));
router.post('/leads/:id/convert', requirePermission('parties:create'), validate({ params: idP }),
  h((req) => work.convertLead(req.businessId, req.user, req.params.id)));
router.delete('/leads/:id', requirePermission('parties:view'), validate({ params: idP }),
  h((req) => work.deleteLead(req.businessId, req.user, req.params.id)));

router.get('/tasks', requirePermission('parties:view'), validate({
  query: z.object({
    status: z.enum(['', 'open', 'pending', 'in_progress', 'done']).optional().default('open'),
    assigned: z.string().trim().max(24).optional().default(''),
    partyId: z.string().trim().max(24).optional().default(''),
    leadId: z.string().trim().max(24).optional().default(''),
    page,
  }),
}), list((req) => work.listTasks(req.businessId, req.user, req.query)));

const taskBody = z.object({
  title: z.string().trim().min(2).max(160),
  note: z.string().trim().max(1000).optional().default(''),
  kind: z.enum(['call', 'visit', 'followup', 'payment', 'delivery', 'other']).optional().default('followup'),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  dueAt: date,
  assignedToUserId: oid.nullable().optional(),
  partyId: oid.nullable().optional(),
  leadId: oid.nullable().optional(),
});
router.post('/tasks', requirePermission('parties:view'), validate({ body: taskBody }),
  asyncHandler(async (req, res) => created(res, await work.createTask(req.businessId, req.user, req.body), 'Kaam ban gaya')));
// Apna kaam poora karna — `parties:view` kaafi hai; kiska kaam hai, ye service dekhti hai
router.put('/tasks/:id', requirePermission('parties:view'), validate({
  params: idP,
  body: taskBody.partial().extend({
    status: z.enum(['pending', 'in_progress', 'done']).optional(),
    doneNote: z.string().trim().max(1000).optional(),
  }),
}), h((req) => work.updateTask(req.businessId, req.user, req.params.id, req.body)));
router.delete('/tasks/:id', requirePermission('parties:view'), validate({ params: idP }),
  h((req) => work.deleteTask(req.businessId, req.user, req.params.id)));

router.get('/team', requirePermission('parties:view'), validate({
  query: z.object({ days: z.coerce.number().int().min(1).max(365).optional().default(30) }),
}), h((req) => work.teamStats(req.businessId, req.user, req.query)));
router.post('/auto-tasks', requirePermission('parties:edit'),
  h((req) => work.generateFollowUpTasks(req.businessId, req.user)));

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import * as svc from '../services/content.service.js';

// Login/signup page pe bhi chahiye — isliye login zaroori nahi, ho to user type/plan ke hisaab se
const optionalAuth = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return protect(req, res, () => next());
};

const router = Router();
router.use(optionalAuth);

router.get('/', validate({
  query: z.object({
    placement: z.string().trim().max(120).optional().default(''),
    lang: z.enum(['hi', 'en', 'hinglish']).optional().default('en'),
    platform: z.enum(['android', 'web', 'desktop']).optional().default('web'),
    kind: z.enum(['', 'video', 'article', 'faq']).optional().default(''),
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.forPlacement(req.user, req.query))));

router.post('/:id/view', validate({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }),
  body: z.object({
    viewerKey: z.string().trim().max(64).optional().default(''),
    lang: z.string().trim().max(10).optional().default(''),
    platform: z.string().trim().max(10).optional().default(''),
    seconds: z.coerce.number().min(0).max(36000).optional().default(0),
    completed: z.boolean().optional().default(false),
  }),
}), asyncHandler(async (req, res) => ok(res, await svc.recordView(req.user, req.params.id, req.body))));

export default router;

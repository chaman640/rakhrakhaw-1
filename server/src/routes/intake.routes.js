import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/intake.controller.js';
import {
  idParamSchema, lineParamSchema, listIntakeQuerySchema,
  decideLineSchema, finishIntakeSchema,
} from '../validators/intake.validator.js';

/**
 * "Kharida hua maal apne stock me daalein".
 *
 * Ye APNI dukaan ka kaam hai, isliye purana `withTenant` — `withBuyerTenant`
 * NAHI. Ye farak samajh lena zaroori hai: maal doosri dukaan se aaya hai, par
 * jahan wo chadhega wo aapka apna stock, apni khep aur apna khata hai. Yahan
 * `X-Shop-Id` ka koi kaam nahi.
 *
 * Ijazat wahi hai jo kharid ki hai — `purchases`. Isse GODOWN INCHARGE ko ye
 * kaam apne aap mil jata hai, aur wahi theek bhi hai: maal andar karna uska hi
 * roz ka kaam hai.
 */
const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

router.get('/count', requirePermission('purchases:view'), ctrl.count);

router.get('/', requirePermission('purchases:view'),
  validate({ query: listIntakeQuerySchema }), ctrl.list);

router.get('/:id', requirePermission('purchases:view'),
  validate({ params: idParamSchema }), ctrl.detail);

router.get('/:id/lines/:index/matches', requirePermission('purchases:view'),
  validate({ params: lineParamSchema }), ctrl.matches);

router.post('/:id/lines/:index', requirePermission('purchases:create'),
  validate({ params: lineParamSchema, body: decideLineSchema }), ctrl.decide);

router.delete('/:id/lines/:index', requirePermission('purchases:create'),
  validate({ params: lineParamSchema }), ctrl.reset);

router.post('/:id/finish', requirePermission('purchases:create'),
  validate({ params: idParamSchema, body: finishIntakeSchema }), ctrl.finish);

export default router;

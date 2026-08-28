import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/payment.controller.js';
import {
  createPaymentSchema, listPaymentsQuerySchema, rejectSchema, idParamSchema, refundSchema,
} from '../validators/payment.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

router.get('/stats', requirePermission('khata:view'), ctrl.stats);

/*
  "Dena hai" — ulti taraf ki list.

  `/we-owe` ko `/:id` se PEHLE rakhna zaroori hai. Baad me rakhte to Express
  "we-owe" ko ek id samajh kar `/:id` pe bhej deta aur validator "Galat id"
  bol kar 400 de deta — aur wo error dhoondhne me ek ghanta jata hai.
*/
router.get('/we-owe', requirePermission('khata:view'), ctrl.weOwe);

// Wapasi ka paisa wapas karna (item 18) — `khata:create` wahi hadd hai jo
// aam payment pe lagti hai; paisa dono taraf paisa hi hai.
router.get('/refund/:id', requirePermission('khata:view'), validate({ params: idParamSchema }), ctrl.refundInfo);
router.post('/refund/:id', requirePermission('khata:create'), validate({ params: idParamSchema, body: refundSchema }), ctrl.refund);

router.get('/', requirePermission('khata:view'), validate({ query: listPaymentsQuerySchema }), ctrl.list);
router.post('/', requirePermission('khata:create'), validate({ body: createPaymentSchema }), ctrl.create);

router.get('/:id', requirePermission('khata:view'), validate({ params: idParamSchema }), ctrl.detail);
router.post('/:id/confirm', requirePermission('khata:approve'), validate({ params: idParamSchema }), ctrl.confirm);
router.post('/:id/reject', requirePermission('khata:approve'), validate({ params: idParamSchema, body: rejectSchema }), ctrl.reject);
router.delete('/:id', requirePermission('khata:delete'), validate({ params: idParamSchema }), ctrl.remove);

export default router;

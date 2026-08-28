import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/khata.controller.js';
import {
  khataQuerySchema, dueQuerySchema, ledgerQuerySchema, partyIdParamSchema,
} from '../validators/payment.validator.js';
import { reminderSchema } from '../validators/report.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

// NOTE: /summary aur /due ko /:partyId se PEHLE rakhna zaroori hai, warna
// "summary" ko party id samajh liya jayega.
router.get('/summary', requirePermission('khata:view'), ctrl.summary);
router.get('/due', requirePermission('khata:view'), validate({ query: dueQuerySchema }), ctrl.due);
router.get('/', requirePermission('khata:view'), validate({ query: khataQuerySchema }), ctrl.list);
router.get('/:partyId', requirePermission('khata:view'), validate({ params: partyIdParamSchema, query: ledgerQuerySchema }), ctrl.partyLedger);
router.post('/:partyId/remind', requirePermission('khata:edit'), validate({ params: partyIdParamSchema, body: reminderSchema }), ctrl.remind);

export default router;

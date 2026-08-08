import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
import * as ctrl from '../controllers/khata.controller.js';
import {
  khataQuerySchema, ledgerQuerySchema, partyIdParamSchema,
} from '../validators/payment.validator.js';
import { reminderSchema } from '../validators/report.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePermission(PERMISSIONS.KHATA));

// NOTE: /summary ko /:partyId se PEHLE rakhna zaroori hai, warna "summary"
// ko party id samajh liya jayega.
router.get('/summary', ctrl.summary);
router.get('/', validate({ query: khataQuerySchema }), ctrl.list);
router.get('/:partyId', validate({ params: partyIdParamSchema, query: ledgerQuerySchema }), ctrl.partyLedger);
router.post('/:partyId/remind', validate({ params: partyIdParamSchema, body: reminderSchema }), ctrl.remind);

export default router;

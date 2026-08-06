import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/khata.controller.js';
import {
  khataQuerySchema, ledgerQuerySchema, partyIdParamSchema,
} from '../validators/payment.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

// NOTE: /summary ko /:partyId se PEHLE rakhna zaroori hai, warna "summary"
// ko party id samajh liya jayega.
router.get('/summary', ctrl.summary);
router.get('/', validate({ query: khataQuerySchema }), ctrl.list);
router.get('/:partyId', validate({ params: partyIdParamSchema, query: ledgerQuerySchema }), ctrl.partyLedger);

export default router;

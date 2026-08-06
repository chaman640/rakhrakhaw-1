import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { withTenant, requireActiveParty } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as khataCtrl from '../controllers/khata.controller.js';
import * as payCtrl from '../controllers/payment.controller.js';
import {
  ledgerQuerySchema, listPaymentsQuerySchema, claimPaymentSchema, idParamSchema,
} from '../validators/payment.validator.js';

/**
 * Retailer ka apna khata + UPI se paisa bhejne ka claim.
 * Yahan sab kuch req.partyId se lock hai — dusre ki entry chhu bhi nahi sakta.
 */
const router = Router();
router.use(protect, requireRole(ROLES.RETAILER), withTenant, requireActiveParty);

router.get('/khata', validate({ query: ledgerQuerySchema }), khataCtrl.myKhata);

router.get('/payments', validate({ query: listPaymentsQuerySchema }), payCtrl.myList);
router.post('/payments', validate({ body: claimPaymentSchema }), payCtrl.myClaim);
router.get('/payments/:id', validate({ params: idParamSchema }), payCtrl.myDetail);

export default router;

import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { withTenant, requireActiveParty } from '../middleware/tenant.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/report.controller.js';

const router = Router();
router.use(protect, withTenant);

/**
 * Ek hi path, do jawab — role ke hisaab se.
 * Client ko yaad rakhne ki zarurat nahi ki kaun sa endpoint maarna hai.
 */
router.get('/', (req, res, next) => {
  if (req.user.role === ROLES.RETAILER) {
    return requireActiveParty(req, res, (err) => (err ? next(err) : ctrl.retailerHome(req, res, next)));
  }
  return requireRole(ROLES.WHOLESALER)(req, res, (err) =>
    (err ? next(err) : ctrl.wholesalerHome(req, res, next)));
});

export default router;

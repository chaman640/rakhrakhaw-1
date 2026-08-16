import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/audit.controller.js';
import { auditQuerySchema, entityParamSchema } from '../validators/audit.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

/**
 * "Kisne kya kiya" ka register.
 *
 * Iske liye `staff:view` chahiye — kyunki isme har staff ka kaam khula pada
 * hai. Jise staff ki list dekhne ka haq nahi, use ye bhi nahi.
 *
 * Ek chhoot: jispe "sirf apna kaam" wali hadd hai, use apna kiya hua dikh
 * jata hai (service khud filter laga deti hai) — apna kaam dekhna kabhi
 * gadbad nahi hai.
 */
router.get('/', requirePermission('staff:view'),
  validate({ query: auditQuerySchema }), ctrl.list);

// Ek hi cheez ka itihaas — "is bill pe kya kya hua"
router.get('/:entityType/:entityId', requirePermission('staff:view'),
  validate({ params: entityParamSchema }), ctrl.history);

export default router;

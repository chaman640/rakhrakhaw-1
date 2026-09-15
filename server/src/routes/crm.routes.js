import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/crm.controller.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

// `parties:view` reuse kiya — CRM retailer data hi dikha raha hai, alag
// permission banane se sirf ek aur cheez ho jaati jo admin ko staff-role
// screen pe alag se on karni padti, bina kisi fayde ke.
router.get('/overview', requirePermission('parties:view'), ctrl.overview);

export default router;

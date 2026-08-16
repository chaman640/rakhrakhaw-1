import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/backup.controller.js';

const router = Router();

// Poora data nikalna = dukaan ki har cheez ek file me. Isliye iske liye
// `settings:edit` chahiye — yaani malik, sah-malik, ya jise malik ne khud ye
// haq diya ho. Manager ko bas ek report chahiye to `reports:export` alag hai.
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePermission('settings:edit'));

router.get('/summary', ctrl.summary);
router.get('/download', ctrl.download);
router.get('/csv/:kind', ctrl.csv);

export default router;

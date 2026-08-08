import { Router } from 'express';
import { protect, requireRole, requireOwner } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/backup.controller.js';

const router = Router();

// Apna poora data sirf malik nikaal sakta hai — staff nahi
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requireOwner);

router.get('/summary', ctrl.summary);
router.get('/download', ctrl.download);
router.get('/csv/:kind', ctrl.csv);

export default router;

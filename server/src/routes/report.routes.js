import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/report.controller.js';
import { reportNameParamSchema, reportQuerySchema } from '../validators/report.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

// NOTE: /:name/csv ko /:name se pehle likhna zaroori nahi (path alag hai),
// par saaf rakhne ke liye upar hi rakha hai.
router.get('/:name/csv', requirePermission('reports:export'), validate({ params: reportNameParamSchema, query: reportQuerySchema }), ctrl.download);
router.get('/:name', requirePermission('reports:view'), validate({ params: reportNameParamSchema, query: reportQuerySchema }), ctrl.run);

export default router;

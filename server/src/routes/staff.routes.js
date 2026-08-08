import { Router } from 'express';
import { protect, requireRole, requireOwner } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/staff.controller.js';
import {
  addStaffSchema, updateStaffSchema, changePasswordSchema, idParamSchema,
} from '../validators/staff.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

// Apna password har koi badal sakta hai — isliye requireOwner se PEHLE
router.post('/change-password', validate({ body: changePasswordSchema }), ctrl.changeMyPassword);

// Baaki sab sirf malik
router.use(requireOwner);

router.get('/', ctrl.list);
router.post('/', validate({ body: addStaffSchema }), ctrl.add);
router.put('/:id', validate({ params: idParamSchema, body: updateStaffSchema }), ctrl.update);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

export default router;

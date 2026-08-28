import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/staff.controller.js';
import {
  addStaffSchema, updateStaffSchema, changePasswordSchema, idParamSchema,
  createInviteSchema, inviteTokenParamSchema, acceptInviteSchema,
} from '../validators/staff.validator.js';

const router = Router();

/**
 * Invite link se judne wale do rasta LOGIN SE PEHLE hain — nayi joining wale
 * ke paas abhi account hai hi nahi.
 */
router.get('/invites/:token', validate({ params: inviteTokenParamSchema }), ctrl.peekInvite);
router.post('/invites/:token/accept',
  validate({ params: inviteTokenParamSchema, body: acceptInviteSchema }), ctrl.acceptInvite);

router.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);

// Apna password har koi badal sakta hai — isliye ijazat wale check se PEHLE
router.post('/change-password', validate({ body: changePasswordSchema }), ctrl.changeMyPassword);

// Kaunse role aur ijazat mumkin hain — ye sirf list hai, isliye `staff:view`
router.get('/meta', requirePermission('staff:view'), ctrl.meta);

router.get('/', requirePermission('staff:view'), ctrl.list);
router.post('/', requirePermission('staff:create'), validate({ body: addStaffSchema }), ctrl.add);
router.put('/:id', requirePermission('staff:edit'),
  validate({ params: idParamSchema, body: updateStaffSchema }), ctrl.update);
router.delete('/:id', requirePermission('staff:delete'),
  validate({ params: idParamSchema }), ctrl.remove);

// ---- invite link ----
router.get('/invites', requirePermission('staff:view'), ctrl.listInvites);
router.post('/invites', requirePermission('staff:create'),
  validate({ body: createInviteSchema }), ctrl.createInvite);
router.delete('/invites/:id', requirePermission('staff:create'),
  validate({ params: idParamSchema }), ctrl.cancelInvite);

export default router;

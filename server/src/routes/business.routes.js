import { Router } from 'express';
import { protect, requireRole, requireOwner } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/business.controller.js';
import {
  updateBusinessSchema, partyIdParamSchema, retailerListQuerySchema,
} from '../validators/business.validator.js';

const router = Router();

// States list public hai — signup form me chahiye
router.get('/states', ctrl.listStates);

// Baaki sab sirf wholesaler ke liye
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/me', ctrl.getMyBusiness);
router.put('/me', requireOwner, validate({ body: updateBusinessSchema }), ctrl.updateMyBusiness);

router.post('/logo', requireOwner, uploadImage.single('logo'), handleUploadError, ctrl.uploadLogo);
router.delete('/logo', requireOwner, ctrl.deleteLogo);

router.post('/invite/regenerate', requireOwner, ctrl.regenerateInvite);

router.get('/retailers', validate({ query: retailerListQuerySchema }), ctrl.listRetailers);
router.post('/retailers/:id/approve', validate({ params: partyIdParamSchema }), ctrl.approveRetailer);
router.post('/retailers/:id/block', validate({ params: partyIdParamSchema }), ctrl.blockRetailer);

export default router;

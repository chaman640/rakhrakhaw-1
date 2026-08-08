import { Router } from 'express';
import { protect, requireRole, requireOwner, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { ROLES, PERMISSIONS } from '../config/constants.js';
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

// Ye teeno wahi kaam karte hain jo /parties karta hai — retailer ka data padhna
// aur badalna — isliye ijazat bhi wahi chahiye.
//
// Pehle yahan kuch nahi laga tha. Matlab salesman, jiske paas sirf items/orders/
// invoices hai aur jo /parties ke paas bhi nahi phatak sakta, wo is doosre
// darwaze se kisi bhi retailer ka login BAND kar sakta tha (block karne pe uska
// User.isActive false ho jata hai) — aur sabka balance/credit limit bhi dekh leta tha.
router.get('/retailers', requirePermission(PERMISSIONS.PARTIES),
  validate({ query: retailerListQuerySchema }), ctrl.listRetailers);
router.post('/retailers/:id/approve', requirePermission(PERMISSIONS.PARTIES),
  validate({ params: partyIdParamSchema }), ctrl.approveRetailer);
router.post('/retailers/:id/block', requirePermission(PERMISSIONS.PARTIES),
  validate({ params: partyIdParamSchema }), ctrl.blockRetailer);

export default router;

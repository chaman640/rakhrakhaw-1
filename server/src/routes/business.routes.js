import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
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
router.put('/me', requirePermission('settings:edit'), validate({ body: updateBusinessSchema }), ctrl.updateMyBusiness);

router.post('/logo', requirePermission('settings:edit'), uploadImage.single('logo'), handleUploadError, ctrl.uploadLogo);
router.delete('/logo', requirePermission('settings:edit'), ctrl.deleteLogo);

router.post('/invite/regenerate', requirePermission('settings:edit'), ctrl.regenerateInvite);

// Pehle ye sab sirf malik kar sakta tha (`requireOwner`). Ab `settings:edit`
// chahiye — isse sah-malik bhi dukaan ki setting badal sakta hai, aur malik
// chahe to kisi manager ko bhi ye ek haq de sakta hai bina baaki sab diye.

// Ye teeno wahi kaam karte hain jo /parties karta hai — retailer ka data padhna
// aur badalna — isliye ijazat bhi wahi chahiye.
//
// Pehle yahan kuch nahi laga tha. Matlab salesman, jiske paas sirf items/orders/
// invoices hai aur jo /parties ke paas bhi nahi phatak sakta, wo is doosre
// darwaze se kisi bhi retailer ka login BAND kar sakta tha (block karne pe uska
// User.isActive false ho jata hai) — aur sabka balance/credit limit bhi dekh leta tha.
router.get('/retailers', requirePermission('parties:view'),
  validate({ query: retailerListQuerySchema }), ctrl.listRetailers);
router.post('/retailers/:id/approve', requirePermission('parties:approve'),
  validate({ params: partyIdParamSchema }), ctrl.approveRetailer);
router.post('/retailers/:id/block', requirePermission('parties:approve'),
  validate({ params: partyIdParamSchema }), ctrl.blockRetailer);

export default router;

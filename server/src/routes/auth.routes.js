import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import * as ctrl from '../controllers/auth.controller.js';
import {
  wholesalerSignupSchema, loginSchema, retailerSignupSchema,
  changePasswordSchema, inviteCodeParamSchema, updateProfileSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Public
router.post('/wholesaler/signup', validate({ body: wholesalerSignupSchema }), ctrl.signupWholesaler);
router.post('/login', validate({ body: loginSchema }), ctrl.login);
router.get('/invite/:code', validate({ params: inviteCodeParamSchema }), ctrl.inviteInfo);
router.post('/retailer/signup', validate({ body: retailerSignupSchema }), ctrl.signupRetailer);

// Logged in
router.get('/me', protect, ctrl.me);
router.put('/profile', protect, validate({ body: updateProfileSchema }), ctrl.updateProfile);
router.post('/change-password', protect, validate({ body: changePasswordSchema }), ctrl.changePassword);
router.post('/logout', protect, ctrl.logout);

export default router;

import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/chat.controller.js';
import {
  partyIdParamSchema, sendMessageSchema, chatSearchQuerySchema,
} from '../validators/chat.validator.js';

/*
 * Client HAMESHA multipart/form-data bhejta hai — text message ho ya photo,
 * dono. Isse server ki taraf ek hi raasta rehta hai: multer pehle chalta hai
 * (photo ho ya na ho, koi fark nahi padta), phir zod body ko jaanchta hai.
 */
const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/conversations', ctrl.listConversations);
router.get('/search', validate({ query: chatSearchQuerySchema }), ctrl.search);

router.get('/:partyId/messages', validate({ params: partyIdParamSchema }), ctrl.getMessages);
router.post(
  '/:partyId/messages',
  validate({ params: partyIdParamSchema }),
  uploadImage.single('photo'),
  handleUploadError,
  validate({ body: sendMessageSchema }),
  ctrl.sendMessage,
);

export default router;

import { Router } from 'express';
import { protect, requireBuyer } from '../middleware/auth.js';
import { withBuyerTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import * as ctrl from '../controllers/myChat.controller.js';
import { sendMessageSchema, chatSearchQuerySchema } from '../validators/chat.validator.js';

/**
 * Yahan `withBuyerTenant` POORE router pe nahi lagta (shop.routes.js jaisa hi
 * karan) — conversations/search SAARI dukaanon me se dikhte hain, ek chuni
 * hui dukaan ka sawal hi nahi. Messages padhne/bhejne ke liye alag se lagta
 * hai, kyunki wahan "abhi kis dukaan me ho" (X-Shop-Id) chahiye hi hota hai.
 */
const router = Router();
router.use(protect, requireBuyer);

router.get('/conversations', ctrl.listConversations);
router.get('/search', validate({ query: chatSearchQuerySchema }), ctrl.search);

router.get('/messages', withBuyerTenant, ctrl.getMessages);
router.post(
  '/messages',
  withBuyerTenant,
  uploadImage.single('photo'),
  handleUploadError,
  validate({ body: sendMessageSchema }),
  ctrl.sendMessage,
);

export default router;

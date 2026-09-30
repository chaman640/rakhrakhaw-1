import { Router } from 'express';
import { z } from 'zod';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { TICKET_CATEGORIES } from '../models/SupportTicket.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as svc from '../services/support.service.js';

// App ki support — seller, retailer aur employee sab ke liye
const router = Router();
router.use(protect);

const files = [uploadImage.array('files', 3), handleUploadError];
const idP = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });

router.get('/', asyncHandler(async (req, res) => ok(res, await svc.myTickets(req.user))));
router.get('/unread', asyncHandler(async (req, res) => ok(res, await svc.unreadCount(req.user))));
router.post('/', ...files, validate({
  body: z.object({
    category: z.enum(TICKET_CATEGORIES).optional().default('other'),
    subject: z.string().trim().min(4, 'Write a short subject').max(160),
    description: z.string().trim().min(10, 'Please describe the problem in a little more detail').max(3000),
    priority: z.enum(['normal', 'high']).optional().default('normal'),
  }),
}), asyncHandler(async (req, res) => created(res, await svc.createTicket(req.user, req.body, req.files), 'Ticket created. Our team will reply soon.')));
router.get('/:id', validate({ params: idP }), asyncHandler(async (req, res) => ok(res, await svc.getMyTicket(req.user, req.params.id))));
router.post('/:id/messages', validate({ params: idP }), ...files, validate({ body: z.object({ text: z.string().trim().max(3000).optional().default('') }) }),
  asyncHandler(async (req, res) => ok(res, await svc.userReply(req.user, req.params.id, req.body, req.files), 'Message sent')));
router.post('/:id/close', validate({ params: idP }), asyncHandler(async (req, res) => ok(res, await svc.userClose(req.user, req.params.id), 'Ticket closed')));

export default router;

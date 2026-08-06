import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/order.controller.js';
import { idParamSchema, notificationQuerySchema } from '../validators/order.validator.js';

const router = Router();

// Dono roles ke liye — har user apni hi notifications dekhta hai
router.use(protect);

router.get('/', validate({ query: notificationQuerySchema }), ctrl.listNotifications);
router.get('/unread-count', ctrl.unreadCount);
router.post('/read-all', ctrl.markAllRead);
router.post('/:id/read', validate({ params: idParamSchema }), ctrl.markRead);

export default router;

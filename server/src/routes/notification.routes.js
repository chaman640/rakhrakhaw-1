import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/notification.controller.js';
import { idParamSchema, notificationQuerySchema } from '../validators/order.validator.js';

const router = Router();

// Dono roles ke liye — har user apni hi notifications dekhta hai
router.use(protect);

router.get('/', validate({ query: notificationQuerySchema }), ctrl.list);
router.get('/counts', ctrl.counts);
router.get('/unread-count', ctrl.unreadCount);
router.post('/read-all', ctrl.markAllRead);

// NOTE: /clear-read ko /:id se PEHLE rakhna zaroori hai
router.delete('/clear-read', ctrl.clearRead);

router.post('/:id/read', validate({ params: idParamSchema }), ctrl.markRead);
router.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

export default router;

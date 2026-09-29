import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { activeAnnouncementsFor } from '../services/platformAdmin.service.js';

// App ke andar — is user ko abhi kaunsi platform soochna dikhe
const router = Router();
router.get('/', protect, asyncHandler(async (req, res) => ok(res, await activeAnnouncementsFor(req.user))));
export default router;

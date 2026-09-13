import { Router } from 'express';
import { protect, requireRole, requirePermission } from '../middleware/auth.js';
import { withTenant } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { uploadImage, handleUploadError } from '../middleware/uploadImage.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/story.controller.js';
import { storyIdParamSchema, createStorySchema } from '../validators/story.validator.js';

const router = Router();
router.use(protect, requireRole(ROLES.WHOLESALER), withTenant);

router.get('/', ctrl.listMyStories);
router.post(
  '/',
  requirePermission('settings:edit'),
  uploadImage.single('photo'),
  handleUploadError,
  validate({ body: createStorySchema }),
  ctrl.createStory,
);
router.delete('/:id', requirePermission('settings:edit'), validate({ params: storyIdParamSchema }), ctrl.deleteStory);

export default router;

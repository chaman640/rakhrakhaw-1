import { Router } from 'express';
import { protect, requireBuyer } from '../middleware/auth.js';
import { withBuyerTenant, requireActiveParty } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/invoice.controller.js';
import { listInvoicesQuerySchema, idParamSchema } from '../validators/invoice.validator.js';

const router = Router();
router.use(protect, requireBuyer, withBuyerTenant, requireActiveParty);

router.get('/', validate({ query: listInvoicesQuerySchema }), ctrl.myList);
router.get('/:id', validate({ params: idParamSchema }), ctrl.myDetail);

export default router;

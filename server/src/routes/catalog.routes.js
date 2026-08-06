import { Router } from 'express';
import { protect, requireRole } from '../middleware/auth.js';
import { withTenant, requireActiveParty } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/catalog.controller.js';
import {
  catalogQuerySchema, cartItemSchema, cartQtySchema, itemIdParamSchema,
  placeOrderSchema, idParamSchema, myOrdersQuerySchema,
} from '../validators/catalog.validator.js';

const router = Router();

// Sab kuch sirf approved retailer ke liye
router.use(protect, requireRole(ROLES.RETAILER), withTenant, requireActiveParty);

// Catalog
router.get('/shop', ctrl.shop);
router.get('/categories', ctrl.categories);
router.get('/', validate({ query: catalogQuerySchema }), ctrl.list);
router.get('/item/:id', validate({ params: idParamSchema }), ctrl.detail);

export default router;

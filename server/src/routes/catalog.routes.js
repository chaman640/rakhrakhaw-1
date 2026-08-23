import { Router } from 'express';
import { protect, requireBuyer } from '../middleware/auth.js';
import { withBuyerTenant, requireActiveParty } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import * as ctrl from '../controllers/catalog.controller.js';
import {
  catalogQuerySchema, cartItemSchema, cartQtySchema, itemIdParamSchema,
  placeOrderSchema, idParamSchema, myOrdersQuerySchema,
} from '../validators/catalog.validator.js';

const router = Router();

/*
  Sab kuch sirf APPROVED KHARIDAAR ke liye — chahe wo retailer ho ya khud koi
  wholesaler jo doosri dukaan se maal mangwa raha hai.

  `X-Shop-Id` header se tay hota hai ki kis dukaan ka catalog khul raha hai.
  Header na aaye to retailer ke liye bilkul purana wala hi rasta chalta hai.
*/
router.use(protect, requireBuyer, withBuyerTenant, requireActiveParty);

// Catalog
router.get('/shop', ctrl.shop);
router.get('/categories', ctrl.categories);
router.get('/', validate({ query: catalogQuerySchema }), ctrl.list);
router.get('/item/:id', validate({ params: idParamSchema }), ctrl.detail);

export default router;

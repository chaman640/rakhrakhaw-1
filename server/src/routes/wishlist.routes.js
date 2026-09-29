import { Router } from 'express';
import { protect, requireBuyer, requireRole, requirePermission } from '../middleware/auth.js';
import { withBuyerTenant, requireActiveParty, withTenant, requirePaidSeller } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/wishlist.controller.js';
import { requireFeature } from '../middleware/feature.js';
import { addWishSchema, idParamSchema, itemIdParamSchema } from '../validators/wishlist.validator.js';

/* Kharidaar ki wishlist — cart jaisa hi pehra (dukaan chuni ho, party active ho) */
export const buyerWishlist = Router();
buyerWishlist.use(protect, requireBuyer, withBuyerTenant, requireActiveParty);
buyerWishlist.get('/', ctrl.list);
buyerWishlist.get('/ids', ctrl.ids);
buyerWishlist.post('/', validate({ body: addWishSchema }), ctrl.add);
buyerWishlist.delete('/item/:itemId', validate({ params: itemIdParamSchema }), ctrl.removeItem);
buyerWishlist.delete('/:id', validate({ params: idParamSchema }), ctrl.remove);

/* Malik/staff — "log kya maang rahe hain". Maal dekhne ki ijazat kaafi hai */
export const sellerDemand = Router();
sellerDemand.use(protect, requireRole(ROLES.WHOLESALER), withTenant, requirePaidSeller);
sellerDemand.get('/', requirePermission('items:view'), requireFeature('demand'), ctrl.demand);

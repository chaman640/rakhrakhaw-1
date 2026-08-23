import { Router } from 'express';
import { protect, requireRole, requireBuyer } from '../middleware/auth.js';
import { withTenant, withBuyerTenant, requireActiveParty } from '../middleware/tenant.js';
import { ROLES } from '../config/constants.js';
import * as ctrl from '../controllers/report.controller.js';

const router = Router();
router.use(protect);

/**
 * Ek middleware ki lambi katar ko haath se chalana.
 *
 * Express khud ye kaam karta hai jab katar route pe likhi ho. Yahan katar
 * REQUEST DEKH KAR chuni jati hai, isliye chalana bhi haath se padta hai.
 *
 * Pehle yahan seedha nested callback likhe the (`h1(req,res,(err)=>h2(...))`).
 * Do middleware tak wo padha jata tha; teen pe wo aisi seedhi hoti gayi ki
 * error kis kadam se aaya ye dhoondhna hi mushkil ho gaya. Ye chhota sa loop
 * wahi kaam karta hai, bas seedha.
 */
function chain(handlers, req, res, next, final) {
  let i = 0;
  const step = (err) => {
    if (err) return next(err);
    const handler = handlers[i];
    i += 1;
    if (!handler) return final(req, res, next);
    return handler(req, res, step);
  };
  return step();
}

/**
 * Ek hi path, do jawab — is baar ROLE se nahi, DARWAZE se.
 *
 * Pehle shart sirf itni thi: retailer ho to kharidne wala dashboard, warna
 * bechne wala. Ab ek wholesaler bhi Buy mode me aata hai, aur us waqt use apni
 * dukaan ka hisaab nahi chahiye — us dukaan ka chahiye JISSE wo maal le raha
 * hai (kitna udhaar hai, kaunse order chal rahe hain).
 *
 * `X-Shop-Id` hi wo nishaan hai. Client wo header SIRF buy mode me bhejta hai
 * (lib/api.js me `setShopHeaderEnabled` — wahan poori wajah likhi hai), isliye
 * Seller mode wale wholesaler ko bilkul wahi jawab milta hai jo pehle milta tha.
 */
router.get('/', (req, res, next) => {
  const buying = req.user.role === ROLES.RETAILER || Boolean(req.get('x-shop-id'));

  if (buying) {
    return chain(
      [requireBuyer, withBuyerTenant, requireActiveParty],
      req, res, next, ctrl.retailerHome,
    );
  }

  return chain(
    [requireRole(ROLES.WHOLESALER), withTenant],
    req, res, next, ctrl.wholesalerHome,
  );
});

export default router;

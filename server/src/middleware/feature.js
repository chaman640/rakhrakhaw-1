import ApiError from '../utils/ApiError.js';
import { rupees } from '../config/billing.js';
import { FEATURE_BY_KEY } from '../config/features.js';
import { businessHasFeature } from '../services/billing.service.js';
import { cheapestPlanFor } from '../services/platform.service.js';

/**
 * FEATURE KA PEHRA — backend pe, sirf button chhupana kaafi nahi.
 *
 *   router.get('/leads', requireFeature('crm_leads'), ...)
 *
 * Kis plan me kya hai, ye config/features.js (+ Admin ki badli setting) se
 * aata hai — yahan koi plan ka naam likha nahi jata. Band ho to 403 ke saath
 * `reason: 'feature_locked'` aur sabse sasta plan jata hai, taaki app seedha
 * "ye ₹500 wale plan me hai — [Plan dekhein]" dikha sake.
 *
 * Free mode me HR (FREE_MODE_OFF) chhod kar sab khula. Plan khatam hone ki rok `requirePaidSeller` ka kaam
 * hai; yahan sirf "is plan me ye hai ya nahi".
 */
export const requireFeature = (key) => async (req, res, next) => {
  try {
    if (await businessHasFeature(req.businessId, key)) return next();

    const f = FEATURE_BY_KEY[key];
    const p = cheapestPlanFor(key);
    return next(ApiError.forbidden(
      p ? `"${f?.name || key}" ${p.name} (₹${rupees(p.pricePaise)}) ya usse upar ke plan me hai`
        : `"${f?.name || key}" abhi band hai`,
      {
        reason: 'feature_locked',
        feature: key,
        featureName: f?.name || key,
        plan: p ? { code: p.code, name: p.name, priceRupees: rupees(p.pricePaise) } : null,
      },
    ));
  } catch (err) {
    return next(err);
  }
};

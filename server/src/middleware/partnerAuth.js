import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { readPartnerToken } from '../services/partner.service.js';
import { readAdminToken } from '../services/partnerAdmin.service.js';
import { Salesman } from '../models/index.js';

/*
  Salesman aur admin ke apne pehre — dukaan wale `protect` se BILKUL alag.

  Ek hi pehra dono ke liye banane ka matlab hota har jagah "agar salesman hai
  to..." likhna, aur unme se ek din ek jagah chhoot jana. Alag pehra rakhne se
  wo galti ho hi nahi sakti: salesman ka token dukaan wale raste pe chalta hi
  nahi, aur dukaan wale ka token yahan.
*/

function readToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export const requireSalesman = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  const d = readPartnerToken(token);
  const sm = await Salesman.findById(d.sub).lean();
  if (!sm) throw ApiError.unauthorized();
  if (!sm.active) throw ApiError.forbidden('Aapka account band kar diya gaya hai');

  // Password badla ho to purani chaabi yahin ruk jati hai
  if ((d.ts || 0) !== (sm.tokenSeq || 0)) {
    throw ApiError.unauthorized('Dobara login karein');
  }

  req.salesman = sm;
  return next();
});

export const requirePartnerAdmin = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  const d = readAdminToken(token);

  /*
    Admin ka record har request pe padha jata hai — sirf `tokenSeq` milane ke
    liye. Ek hi admin hai, isliye ye ek query din bhar me chand hi baar chalti
    hai. Iske badle jo milta hai wo bada hai: password badalte hi purani
    chaabi usi pal band ho jati hai.
  */
  const { PartnerAdmin } = await import('../models/index.js');
  const admin = await PartnerAdmin.findById(d.sub).select('tokenSeq').lean();
  if (!admin) throw ApiError.unauthorized();
  if ((d.ts || 0) !== (admin.tokenSeq || 0)) throw ApiError.unauthorized('Dobara login karein');

  req.adminId = d.sub;
  return next();
});

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { cacheGet, cacheSet, cacheBust } from '../utils/cache.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import User from '../models/User.js';
import { ROLES } from '../config/constants.js';
import {
  STAFF_ROLES, MODULE_LABEL, ACTION_LABEL, userCan as permCheck,
} from '../config/permissions.js';

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return null;
}

// Login zaroori — req.user set karta hai
export const protect = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  const decoded = jwt.verify(token, env.jwtSecret);
  /*
    User har request pe padha jata hai — poore system ki sabse garam query.
    15 second ka cache use lagbhag hata deta hai.

    15 hi kyun: is beech me band kiya gaya staff ya doosre phone se nikala gaya
    aadmi utni der aur chal sakta hai. 15 second me wo kuch aisa nahi kar sakta
    jo wapas na ho, aur badle me har request ka ek database call bach jata hai.
    Zyada rakhne se wo rok hi bemaani ho jati; kam rakhne se cache ka faayda hi
    nahi bachta.
  */
  const ckey = `u:${decoded.sub}`;
  let user = cacheGet(ckey);
  if (user === undefined) {
    user = await User.findById(decoded.sub).lean();
    cacheSet(ckey, user, 15000);
  }

  if (!user) throw ApiError.unauthorized('User nahi mila');
  if (!user.isActive) throw ApiError.forbidden('Aapka account band kar diya gaya hai');

  /*
    EK NUMBER, EK JAGAH (item 24).

    Naya login `sessionSeq` badha deta hai. Purane phone ke token me purani
    ginti likhi hai — wo yahin ruk jata hai.

    `decoded.ss === undefined` ko JAANE DETE hain, aur ye jaan-boojh kar hai:
    is fix se PEHLE bane token me ye khaana hai hi nahi. Use rokte to update
    lagte hi har chalu login ek saath toot jata — sab ko bina wajah dobara
    login karna padta. Wo token apni mohlat khatam hone par khud chale jayenge,
    aur agla login naye niyam pe aa jayega.

    Sandesh 401 ke saath saaf jata hai, warna aadmi ko lagta hai app kharab hai.
  */
  if (decoded.ss !== undefined && Number(decoded.ss) !== Number(user.sessionSeq || 0)) {
    throw ApiError.unauthorized(
      'Aapka ye number kisi aur phone pe login ho gaya hai. Ek number ek hi jagah chalta hai.',
    );
  }

  req.user = user;
  next();
});

// Role check — protect ke baad lagana
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('Ye page aapke role ke liye nahi hai'));
  }
  next();
};

/**
 * Staff ki ijazat ka check.
 *
 * `protect` .lean() use karta hai isliye model ka `.can()` yahan milta hi
 * nahi — isliye asli faisla `config/permissions.js` ke `userCan()` se hota
 * hai, jo plain object pe bhi chalta hai. Poore app me faisla lene ki jagah
 * wahi ek hai.
 */
export { userCan } from '../config/permissions.js';

/**
 * Ek kaam ki ijazat maango — `requirePermission('invoices:create')`.
 *
 * Do naam bhi de sakte hain, tab kisi EK ka hona kaafi hai:
 *   requirePermission('khata:create', 'khata:edit')
 *
 * Mana karte waqt error me saaf likha jata hai ki kis cheez ki ijazat nahi
 * mili — warna staff ko sirf "ijazat nahi hai" dikhta hai aur malik ko phone
 * karke pata hi nahi chalta ki kaunsa checkbox lagana hai.
 */
export const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());

  const allowed = permissions.some((p) => permCheck(req.user, p));
  if (!allowed) {
    const [first] = permissions;
    const [module, action] = String(first).split(':');
    const what = `${MODULE_LABEL[module] || module} — ${ACTION_LABEL[action] || action}`;
    return next(ApiError.forbidden(
      `Aapko is kaam ki ijazat nahi hai (${what}). Malik se kahiye ki Settings → Staff me de dein.`,
      { needed: permissions }
    ));
  }
  next();
};

/**
 * KHAREEDNE KA HAQ — buy-side ke har route pe.
 *
 * Pehle in raston pe `requireRole(ROLES.RETAILER)` laga tha. Uska matlab tha:
 * catalog, cart, my-orders, my-bills aur my-khata sirf retailer ke liye. Ek
 * wholesaler kisi doosre wholesaler se maal nahi mangwa sakta tha — jabki mandi
 * me sabse zyada yahi hota hai.
 *
 * Ab do tarah ke log andar aate hain:
 *
 *   retailer   — hamesha (uska poora kaam hi khareedna hai)
 *   wholesaler — jab uske paas `purchases:create` ho, yaani "maal khareedna"
 *
 * `purchases:create` hi kyun: ye pehle se maujood ijazat hai aur uska matlab
 * bilkul yahi hai. Nayi ijazat banane ka matlab hota har purane staff ki list
 * me use jodna, aur jo chhoot jata uska kaam chup-chaap ruk jata.
 *
 * Isi ek line se GODOWN INCHARGE ko bhi khareedne ka haq mil jata hai — uske
 * role me `purchases:create` pehle se hai (permissions.js dekhein). Malik,
 * sah-malik, manager aur munshi bhi is chhalni se aaram se nikal jate hain;
 * salesman, cashier aur CA nahi — aur wahi theek hai.
 */
export const requireBuyer = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());

  if (req.user.role === ROLES.RETAILER) return next();

  if (req.user.role === ROLES.WHOLESALER) {
    if (permCheck(req.user, 'purchases:create')) return next();
    return next(ApiError.forbidden(
      'Aapko maal khareedne ki ijazat nahi hai. Malik se kahiye ki Staff me '
      + '"Purchase (maal khareedna) — Banana" laga dein.',
      { needed: ['purchases:create'] }
    ));
  }

  return next(ApiError.forbidden('Ye page aapke role ke liye nahi hai'));
};

/** Sirf malik — staff add karna, backup lena, business profile badalna */
export const requireOwner = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== ROLES.WHOLESALER
    || (req.user.staffRole || STAFF_ROLES.OWNER) !== STAFF_ROLES.OWNER) {
    return next(ApiError.forbidden('Ye sirf dukaan ke malik kar sakte hain'));
  }
  next();
};

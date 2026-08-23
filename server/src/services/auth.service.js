import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { env } from '../config/env.js';
import { ROLES, PARTY_TYPES, PARTY_STATUS,  } from '../config/constants.js';
import { ALL_PERMISSIONS, STAFF_ROLE_LABEL, userCan } from '../config/permissions.js';
import ApiError from '../utils/ApiError.js';
import { normalizePhone } from '../utils/phone.js';
import { getStateCode } from '../config/states.js';
import { validateGstin } from '../utils/gstin.js';
import { generateInviteCode } from '../utils/generateCode.js';
import { businessForUser } from '../utils/businessView.js';
import { User, Business, Party, Membership } from '../models/index.js';

/**
 * Token banane wala.
 *
 * Bahar bhi chahiye hota hai (jaise invite link se judte hi login kara dena),
 * isliye `signTokenFor` naam se export bhi kar dete hain — taaki koi doosri
 * jagah apna alag jwt.sign na likh baithe aur do tarah ke token ban jayen.
 */
function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function publicUser(user) {
  const staffRole = user.staffRole || 'owner';
  return {
    _id: user._id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    businessId: user.businessId,
    partyId: user.partyId,

    // Client isi se menu aur button chhupata hai. Server phir bhi har request
    // pe khud check karta hai — ye sirf dikhawe ke liye hai, suraksha ke liye
    // nahi. (Client pe kuch bhi chhupana suraksha nahi hoti.)
    staffRole,
    staffRoleLabel: STAFF_ROLE_LABEL[staffRole] || staffRole,
    isOwner: user.role === 'wholesaler' && staffRole === 'owner',
    permissions: user.role === 'wholesaler'
      ? (staffRole === 'owner' ? ALL_PERMISSIONS : (user.permissions || []))
      : [],

    // "Sirf apna kaam" wala hai kya — client isse "sabka data" wale filter
    // aur tab chhupa deta hai
    scope: user.role === 'wholesaler' ? (staffRole === 'owner' ? 'all' : (user.scope || 'all')) : 'all',

    /*
      KHAREEDNE KA DARWAZA khulega ya nahi.

      Retailer ka poora kaam hi khareedna hai. Wholesaler ke liye wahi ek shart
      hai jo server pe lagti hai — `purchases:create` (middleware/auth.js ka
      `requireBuyer` dekhein). Do jagah do alag shart likhne se wo dheere dheere
      alag ho jati hain aur button dikhta hai par dabate hi "ijazat nahi" aata
      hai; isliye naam bhi wahi rakha hai aur matlab bhi.

      Isse GODOWN INCHARGE ko bhi Buy wala button dikh jata hai — uske role me
      `purchases:create` pehle se hai.
    */
    canBuy: user.role === 'retailer' ? true : userCan(user, 'purchases:create'),

    // Paise ki hadd — form me pehle hi bata dena behtar hai, save karke
    // "ijazat nahi" dikhane se
    limits: user.role === 'wholesaler' && staffRole !== 'owner'
      ? {
        maxDiscountPercent: user.limits?.maxDiscountPercent ?? null,
        maxInvoiceAmount: user.limits?.maxInvoiceAmount ?? null,
        canSellOnCredit: user.limits?.canSellOnCredit !== false,
      }
      : { maxDiscountPercent: null, maxInvoiceAmount: null, canSellOnCredit: true },
  };
}

/** Wholesaler signup — User + Business dono ek saath bante hain */
export async function signupWholesaler({ name, phone, password, businessName }) {
  const cleanPhone = normalizePhone(phone);

  const exists = await User.findOne({ phone: cleanPhone });
  if (exists) throw ApiError.conflict('Ye number pehle se registered hai. Login karein.');

  const session = await mongoose.startSession();
  let user, business;

  try {
    // Transaction sirf replica set pe chalta hai (Atlas pe chalta hai).
    // Local standalone mongod pe fail hota hai — isliye fallback bhi rakha hai.
    await session.withTransaction(async () => {
      const [createdUser] = await User.create(
        [{ name, phone: cleanPhone, passwordHash: 'temp', role: ROLES.WHOLESALER }],
        { session }
      );
      await createdUser.setPassword(password);
      await createdUser.save({ session });

      const [createdBusiness] = await Business.create(
        [{
          ownerUserId: createdUser._id,
          name: businessName,
          phone: cleanPhone,
          inviteCode: generateInviteCode(8),
        }],
        { session }
      );

      createdUser.businessId = createdBusiness._id;
      await createdUser.save({ session });

      user = createdUser;
      business = createdBusiness;
    });
  } catch (err) {
    if (err?.code === 20 || /Transaction numbers|replica set|not supported/i.test(err?.message || '')) {
      // Standalone MongoDB — bina transaction ke banao
      user = new User({ name, phone: cleanPhone, passwordHash: 'temp', role: ROLES.WHOLESALER });
      await user.setPassword(password);
      await user.save();

      business = await Business.create({
        ownerUserId: user._id,
        name: businessName,
        phone: cleanPhone,
        inviteCode: generateInviteCode(8),
      });

      user.businessId = business._id;
      await user.save();
    } else {
      throw err;
    }
  } finally {
    await session.endSession();
  }

  // Abhi abhi signup kiya hai to ye khud malik hai — poora profile milega
  return { token: signToken(user), user: publicUser(user), business: businessForUser(business, user) };
}

/** Invite link kholne par — retailer ko dikhega ki kis dukaan se jud raha hai */
export async function getInviteInfo(code) {
  const business = await Business.findOne({ inviteCode: code.toUpperCase(), isActive: true })
    .select('name address logoUrl inviteEnabled')
    .lean();

  if (!business) throw ApiError.notFound('Ye invite link kaam nahi kar raha. Wholesaler se naya link maangein.');
  if (!business.inviteEnabled) throw ApiError.forbidden('Ye link abhi band hai. Wholesaler se baat karein.');

  return {
    businessName: business.name,
    logoUrl: business.logoUrl,
    city: business.address?.city || '',
    state: business.address?.state || '',
  };
}

/** Retailer signup — invite code se. User + Party dono bante hain. */
export async function signupRetailer({ inviteCode, name, shopName, phone, password }) {
  const cleanPhone = normalizePhone(phone);
  const code = inviteCode.toUpperCase();

  const business = await Business.findOne({ inviteCode: code, isActive: true });
  if (!business) throw ApiError.notFound('Invite link galat hai ya expire ho gaya');
  if (!business.inviteEnabled) throw ApiError.forbidden('Ye link abhi band hai');

  /*
    Ye number pehle se registered hai.

    Pehle yahan likha tha "ek number sirf ek hi dukaan se jud sakta hai" — ab wo
    baat SACH NAHI RAHI. Doosri dukaan se judne ke liye ab naya account banane
    ki zarurat hi nahi: login karke Buy → dukaan ka number search kar lo, ek tap
    me jud jate ho, aur dono dukaanon ka khata alag alag apni jagah rehta hai.

    Isliye rok wahi hai (ek number, ek login), par rasta ab band nahi hai — aur
    sandesh me wahi rasta bataya jata hai. Purana sandesh aadmi ko doosra SIM
    dhoondhne bhej deta tha.
  */
  const existingUser = await User.findOne({ phone: cleanPhone });
  if (existingUser) {
    throw ApiError.conflict(
      'Ye number pehle se registered hai. Naya account banane ki zarurat nahi — '
      + 'login karke Buy me is dukaan ka number search kar lein, ek tap me jud jayenge.'
    );
  }

  // Wholesaler ne pehle se is phone ki party bana rakhi ho to usi ko link karo
  let party = await Party.findOne({
    businessId: business._id,
    type: PARTY_TYPES.RETAILER,
    phone: cleanPhone,
  });

  const status = business.autoApproveRetailers ? PARTY_STATUS.ACTIVE : PARTY_STATUS.PENDING;

  if (party) {
    party.name = party.name || name;
    party.shopName = shopName || party.shopName;
    if (party.status !== PARTY_STATUS.BLOCKED) party.status = status;
  } else {
    party = new Party({
      businessId: business._id,
      type: PARTY_TYPES.RETAILER,
      name,
      shopName,
      phone: cleanPhone,
      status,
      inviteUsedAt: new Date(),
    });
  }

  const user = new User({
    name,
    phone: cleanPhone,
    passwordHash: 'temp',
    role: ROLES.RETAILER,
    businessId: business._id,
  });
  await user.setPassword(password);

  party.linkedUserId = user._id;
  party.inviteUsedAt = new Date();
  await party.save();

  user.partyId = party._id;
  await user.save();

  /*
    Rishta NAYE tarike se bhi likh do.

    `User.businessId` abhi bhi bharta hai (purana sab kuch usi pe chal raha
    hai), par asli list ab Membership hai — usi se ye retailer aage aur
    dukaanein jod payega aur uski pehli dukaan search wali list me dikhegi.

    Ye fail ho jaye to signup nahi rukta: startup ka backfill ise apne aap bana
    deta hai, aur tab tak purana rasta chalta rehta hai. Naya account ban jane
    ke baad use ek chhoti si entry ki wajah se lauta dena bahut bura hoga.
  */
  try {
    await Membership.create({
      userId: user._id,
      buyerBusinessId: null,
      businessId: business._id,
      partyId: party._id,
      isSaved: true,
      isPrimary: true,
      connectedByUserId: user._id,
      lastUsedAt: new Date(),
    });
  } catch (err) {
    console.warn('[auth] Membership nahi ban payi (backfill baad me bana dega):', err.message);
  }

  return {
    token: signToken(user),
    user: publicUser(user),
    party: { _id: party._id, status: party.status, name: party.name, shopName: party.shopName },
    business: { _id: business._id, name: business.name, logoUrl: business.logoUrl, gstEnabled: business.gstEnabled },
  };
}

/** Login — wholesaler aur retailer dono ke liye ek hi endpoint */
export async function login({ phone, password }) {
  const cleanPhone = normalizePhone(phone);

  const user = await User.findOne({ phone: cleanPhone }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Ye number registered nahi hai');
  if (!user.isActive) throw ApiError.forbidden('Aapka account band kar diya gaya hai');

  const okPassword = await user.checkPassword(password);
  if (!okPassword) throw ApiError.unauthorized('Password galat hai');

  user.lastLoginAt = new Date();
  await user.save();

  return { token: signToken(user), ...(await buildSession(user)) };
}

/** /auth/me — user + business + (retailer ke liye) party status */
export const signTokenFor = signToken;

export async function buildSession(user) {
  const business = user.businessId
    ? await Business.findById(user.businessId).lean()
    : null;

  let party = null;
  if (user.role === ROLES.RETAILER && user.partyId) {
    party = await Party.findById(user.partyId)
      .select('name shopName phone status balance creditLimit address gstin')
      .lean();
  }

  // Kis user ko dukaan ki kaunsi baat dikhegi — faisla ek hi jagah hota hai.
  //
  // Pehle sirf retailer ke liye chhanti hoti thi aur STAFF ko poora doc chala
  // jata tha — matlab har salesman ke paas invite code (jisse koi bhi retailer
  // ban kar ghus sakta hai), malik ki UPI ID aur dukaan ka email pahunch jata tha.
  return { user: publicUser(user), business: businessForUser(business, user), party };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User nahi mila');

  const okPassword = await user.checkPassword(currentPassword);
  if (!okPassword) throw ApiError.badRequest('Purana password galat hai');

  await user.setPassword(newPassword);
  await user.save();
  return true;
}

/** Apni profile update karna — retailer apni dukaan ki detail, wholesaler sirf naam */
export async function updateProfile(user, payload) {
  const dbUser = await User.findById(user._id);
  if (!dbUser) throw ApiError.notFound('User nahi mila');

  if (payload.name) {
    dbUser.name = payload.name;
    await dbUser.save();
  }

  if (dbUser.role === ROLES.RETAILER && dbUser.partyId) {
    const party = await Party.findById(dbUser.partyId);
    if (party) {
      if (payload.name) party.name = payload.name;
      if (payload.shopName !== undefined) party.shopName = payload.shopName;

      if (payload.gstin !== undefined) {
        const gstin = payload.gstin.toUpperCase().trim();
        if (gstin) {
          const result = validateGstin(gstin);
          if (!result.valid) throw ApiError.badRequest(result.message);
          party.gstin = result.value;
        } else {
          party.gstin = '';
        }
      }

      if (payload.address) {
        const addr = { ...(party.address?.toObject?.() || party.address || {}), ...payload.address };
        addr.stateCode = addr.state ? getStateCode(addr.state) : '';
        party.address = addr;
      }

      await party.save();
    }
  }

  return buildSession(dbUser);
}

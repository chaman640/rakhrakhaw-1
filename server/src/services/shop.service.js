import mongoose from 'mongoose';

import ApiError from '../utils/ApiError.js';
import { normalizePhone } from '../utils/phone.js';
import { buyerFilter, buyerFields } from '../utils/buyer.js';
import { ROLES, PARTY_TYPES, PARTY_STATUS } from '../config/constants.js';
import { Business, Party, Membership, Item, User } from '../models/index.js';

/**
 * DUKAAN DHOONDHO, JUDO, SAVE KARO.
 *
 * Pehle doosri dukaan se judne ka ek hi rasta tha: uska invite link. Link
 * WhatsApp pe maangna padta tha, aur usse naya account banta tha — naye number
 * pe, naye khate ke saath. Do dukaan se maal lene wale ke do login ho jate the.
 *
 * Ab rasta seedha hai: NUMBER daalo, dukaan mil jayegi, ek tap me jud jao.
 *
 * Number hi kyun (naam se khoj kyun nahi):
 * Naam se khoj ka matlab hota har dukaan ka naam har kisi ko dikhna — aur uske
 * saath uska poora catalog aur rate. Number pehle se bill par chhapta hai,
 * yaani jise aapse kaam hai uske paas wo pehle se hai. Poora 10 ank sahi milna
 * chahiye — aadha number daal kar list nahi nikalti. Isliye koi anjaan aadmi
 * ek ek karke dukaanein nahi taad sakta.
 */

/* ───────────────────────────── dhoondhna ───────────────────────────── */

/**
 * Number se dukaan.
 *
 * Do jagah dekhte hain: dukaan ka apna number, aur malik ka login number.
 * Signup pe dono ek hi hote hain, par malik baad me dukaan ka number badal
 * sakta hai (landline, doosra SIM). Tab bhi purana number kaam karta rahe.
 */
async function findShopByPhone(phone) {
  const clean = normalizePhone(phone);
  if (!clean) return null;

  const byShop = await Business.findOne({ phone: clean, isActive: true }).lean();
  if (byShop) return byShop;

  const owner = await User.findOne({ phone: clean, role: ROLES.WHOLESALER }).select('businessId').lean();
  if (!owner?.businessId) return null;

  return Business.findOne({ _id: owner.businessId, isActive: true }).lean();
}

async function findShop({ phone, businessId }) {
  const business = businessId
    ? await Business.findOne({ _id: businessId, isActive: true }).lean()
    : await findShopByPhone(phone);

  if (!business) {
    throw ApiError.notFound('Is number pe koi dukaan nahi mili. Number dobara dekh lein.');
  }
  return business;
}

/** Kitna maal aur kitni category — dukaan ka "followers" wala hissa */
async function shopCounts(businessId) {
  const match = {
    businessId: new mongoose.Types.ObjectId(businessId),
    isActive: true,
    visibleToRetailers: true,
  };

  const [itemCount, categories] = await Promise.all([
    Item.countDocuments(match),
    Item.aggregate([
      { $match: { ...match, categoryId: { $ne: null } } },
      { $group: { _id: '$categoryId' } },
      { $count: 'n' },
    ]),
  ]);

  return { itemCount, categoryCount: categories[0]?.n || 0 };
}

/**
 * Dukaan ka card — search me, saved list me aur shop page pe yahi shakal.
 *
 * Ek hi jagah se banta hai, jaan-boojh kar: teen jagah alag alag banate to
 * teenon dheere dheere alag ho jate aur "search me logo dikha, saved me nahi"
 * jaisi shikayat aati.
 */
function shopCard(business, { membership = null, party = null, counts = null, isOwn = false } = {}) {
  return {
    _id: business._id,
    name: business.name,
    phone: business.phone || '',
    logoUrl: business.logoUrl || '',
    city: business.address?.city || '',
    state: business.address?.state || '',
    gstEnabled: Boolean(business.gstEnabled),

    itemCount: counts?.itemCount ?? null,
    categoryCount: counts?.categoryCount ?? null,

    // Apni hi dukaan to nahi — tab "Jodein" ka button dikhana bekaar hai
    isOwn: Boolean(isOwn),

    // Juda hua hai ya nahi, aur uska haal
    connected: Boolean(membership),
    saved: Boolean(membership?.isSaved),
    partyStatus: party?.status || null,
    // Kitna baaki hai — apna hi khata hai, isliye dikhana theek hai
    balance: party ? Number(party.balance || 0) : 0,
    lastUsedAt: membership?.lastUsedAt || null,
  };
}

/* ───────────────────────────── judna ───────────────────────────── */

/** Kharidaar ki pehchan — us dukaan ke andar iski Party isi se banti hai */
async function buyerIdentity(user) {
  if (user.role === ROLES.WHOLESALER && user.businessId) {
    const own = await Business.findById(user.businessId)
      .select('name phone gstin address ownerUserId').lean();
    return {
      name: own?.name || user.name,
      shopName: own?.name || '',
      phone: own?.phone || user.phone || '',
      gstin: own?.gstin || '',
      address: own?.address || {},
      linkUserId: own?.ownerUserId || user._id,
      ownBusinessId: user.businessId,
    };
  }

  // Retailer — apni purani party se dukaan ka naam utha lete hain
  const party = user.partyId
    ? await Party.findById(user.partyId).select('shopName gstin address').lean()
    : null;

  return {
    name: user.name,
    shopName: party?.shopName || '',
    phone: user.phone || '',
    gstin: party?.gstin || '',
    address: party?.address || {},
    linkUserId: user._id,
    ownBusinessId: null,
  };
}

/**
 * Us dukaan ke andar kharidaar ki Party dhoondho ya banao.
 *
 * Pehle se party ho (wholesaler ne haath se banayi thi, ya invite link se juda
 * tha) to USI ko lete hain — nayi banane par uska poora purana khata, bill aur
 * return doosri party pe chhoot jate aur hisaab do jagah bat jata.
 */
async function findOrCreateParty(business, ident, byUserId) {
  const wantStatus = business.autoApproveRetailers ? PARTY_STATUS.ACTIVE : PARTY_STATUS.PENDING;

  let party = ident.phone
    ? await Party.findOne({ businessId: business._id, type: PARTY_TYPES.RETAILER, phone: ident.phone })
    : null;

  if (party) {
    if (party.status === PARTY_STATUS.BLOCKED) {
      throw ApiError.forbidden('Is dukaan ne aapka access band kar rakha hai');
    }
    // Pehle se ACTIVE ho to use PENDING mat karo — haq chheenna sabse bura hai
    if (party.status !== PARTY_STATUS.ACTIVE) party.status = wantStatus;
    if (!party.shopName && ident.shopName) party.shopName = ident.shopName;
    if (!party.linkedUserId) party.linkedUserId = ident.linkUserId;
    if (!party.inviteUsedAt) party.inviteUsedAt = new Date();
    await party.save();
    return party;
  }

  try {
    return await Party.create({
      businessId: business._id,
      type: PARTY_TYPES.RETAILER,
      name: ident.shopName || ident.name,
      shopName: ident.shopName,
      phone: ident.phone,
      gstin: ident.gstin,
      address: ident.address,
      status: wantStatus,
      linkedUserId: ident.linkUserId,
      inviteUsedAt: new Date(),
      createdBy: byUserId,
    });
  } catch (err) {
    /*
      Do tap ek saath (ya do staff ek hi waqt pe). Unique index ne doosri ko
      roka — wo galti nahi hai, wahi to hona chahiye tha. Jo pehle ban gayi
      usi ko utha lete hain.
    */
    if (err?.code === 11000 && ident.phone) {
      const again = await Party.findOne({
        businessId: business._id, type: PARTY_TYPES.RETAILER, phone: ident.phone,
      });
      if (again) return again;
    }
    throw err;
  }
}

/** Number (ya id) se dukaan se judo — Party + Membership dono ban jate hain */
export async function connectShop(user, { phone, businessId }) {
  const mine = buyerFilter(user);
  if (!mine) throw ApiError.forbidden('Pehle business profile banaiye');

  const business = await findShop({ phone, businessId });

  if (String(business._id) === String(user.businessId || '')) {
    throw ApiError.badRequest('Ye to aapki apni hi dukaan hai');
  }

  // Pehle se juda ho to bas save karke wapas — dobara Party nahi banti
  const already = await Membership.findOne({ ...mine, businessId: business._id });
  if (already) {
    already.isSaved = true;
    already.lastUsedAt = new Date();
    await already.save();
    const party = await Party.findById(already.partyId).select('status balance').lean();
    return shopCard(business, { membership: already, party, counts: await shopCounts(business._id) });
  }

  const ident = await buyerIdentity(user);
  const party = await findOrCreateParty(business, ident, user._id);

  let membership;
  try {
    membership = await Membership.create({
      ...buyerFields(user),
      businessId: business._id,
      partyId: party._id,
      isSaved: true,
      connectedByUserId: user._id,
      lastUsedAt: new Date(),
    });
  } catch (err) {
    // Do tap ek saath — jo pehle ban gayi wahi sahi hai
    if (err?.code === 11000) {
      membership = await Membership.findOne({ ...mine, businessId: business._id });
    }
    if (!membership) throw err;
  }

  return shopCard(business, {
    membership,
    party,
    counts: await shopCounts(business._id),
  });
}

/* ───────────────────────────── dekhna ───────────────────────────── */

/** Number daal kar khoj — juda hua hai ya nahi, wo bhi saath me batata hai */
export async function lookupShop(user, phone) {
  const business = await findShop({ phone });
  const mine = buyerFilter(user);

  const membership = mine
    ? await Membership.findOne({ ...mine, businessId: business._id }).lean()
    : null;
  const party = membership
    ? await Party.findById(membership.partyId).select('status balance').lean()
    : null;

  return shopCard(business, {
    membership,
    party,
    counts: await shopCounts(business._id),
    isOwn: String(business._id) === String(user.businessId || ''),
  });
}

/** Ek dukaan ka poora page (Instagram wali window ka data) */
export async function getShopProfile(user, businessId) {
  const mine = buyerFilter(user);
  const membership = mine
    ? await Membership.findOne({ ...mine, businessId }).lean()
    : null;

  if (!membership && String(user.businessId || '') !== String(businessId)) {
    // Juda nahi hai — phir bhi dukaan ki pehchan dikha dete hain, taaki
    // "jodein?" wala button dikhaya ja sake
    const business = await findShop({ businessId });
    return shopCard(business, { counts: await shopCounts(businessId) });
  }

  const business = await findShop({ businessId });
  const party = membership
    ? await Party.findById(membership.partyId).select('status balance').lean()
    : null;

  return shopCard(business, { membership, party, counts: await shopCounts(businessId) });
}

/**
 * "Jis dukaan me main abhi hoon" ka poora card.
 *
 * Shop page (Instagram wali window) ka header isi se banta hai. Yahan
 * `businessId` aur `partyId` PEHLE SE tay ho chuke hote hain — `withBuyerTenant`
 * ne header dekh kar ya purane raste se nikal liye hote hain — isliye ye dobara
 * Membership nahi dhoondhta, sirf "save hai ya nahi" poochhta hai.
 *
 * Alag se banane ke bajaye wahi `shopCard` use hota hai jo search aur saved
 * list banati hai. Teen jagah teen alag card banate to teenon dheere dheere
 * alag ho jate — logo ek jagah dikhta, doosri jagah nahi.
 */
export async function getCurrentShopCard(user, businessId, partyId) {
  const mine = buyerFilter(user);

  const [business, membership, party, counts] = await Promise.all([
    Business.findById(businessId).select('name phone logoUrl address gstEnabled').lean(),
    mine ? Membership.findOne({ ...mine, businessId }).lean() : null,
    partyId ? Party.findById(partyId).select('status balance').lean() : null,
    shopCounts(businessId),
  ]);

  if (!business) throw ApiError.notFound('Dukaan nahi mili');

  return shopCard(business, {
    membership,
    party,
    counts,
    isOwn: String(businessId) === String(user.businessId || ''),
  });
}

/**
 * Save ki hui dukaanein — search kholte hi jo saamne dikhti hain.
 *
 * Instagram ki search history jaisi: logo, naam aur number. Number dobara
 * likhna hi na pade, yahi poori baat hai.
 */
export async function listSavedShops(user, { all = false } = {}) {
  const mine = buyerFilter(user);
  if (!mine) return [];

  const filter = all ? mine : { ...mine, isSaved: true };
  const memberships = await Membership.find(filter).sort({ lastUsedAt: -1 }).limit(50).lean();
  if (!memberships.length) return [];

  const [businesses, parties] = await Promise.all([
    Business.find({ _id: { $in: memberships.map((m) => m.businessId) } })
      .select('name phone logoUrl address gstEnabled').lean(),
    Party.find({ _id: { $in: memberships.map((m) => m.partyId) } })
      .select('status balance').lean(),
  ]);

  const bMap = new Map(businesses.map((b) => [String(b._id), b]));
  const pMap = new Map(parties.map((p) => [String(p._id), p]));

  return memberships
    .map((m) => {
      const business = bMap.get(String(m.businessId));
      if (!business) return null;    // dukaan band ho gayi
      return shopCard(business, { membership: m, party: pMap.get(String(m.partyId)) });
    })
    .filter(Boolean);
}

/* ───────────────────────────── save / hatana ───────────────────────────── */

/**
 * Save ka button — Instagram ke follow jaisa.
 *
 * Save hatane se rishta NAHI tootta (Membership.js me wajah). Khata, purane
 * bill aur return sab wahin rehte hain; sirf search wali list se hat jati hai.
 */
export async function setShopSaved(user, businessId, saved) {
  const mine = buyerFilter(user);
  if (!mine) throw ApiError.forbidden('Pehle business profile banaiye');

  const membership = await Membership.findOneAndUpdate(
    { ...mine, businessId },
    { isSaved: Boolean(saved), ...(saved ? { lastUsedAt: new Date() } : {}) },
    { new: true },
  );
  if (!membership) throw ApiError.notFound('Aap is dukaan se jude nahi hain');

  const [business, party] = await Promise.all([
    Business.findById(businessId).select('name phone logoUrl address gstEnabled').lean(),
    Party.findById(membership.partyId).select('status balance').lean(),
  ]);

  return shopCard(business, { membership, party });
}

/** "Abhi isi dukaan me hoon" — search history ka kram isse banta hai */
export async function touchShop(user, businessId) {
  const mine = buyerFilter(user);
  if (!mine) return;
  await Membership.updateOne({ ...mine, businessId }, { lastUsedAt: new Date() });
}

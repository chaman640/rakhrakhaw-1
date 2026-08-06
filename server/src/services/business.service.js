import { env } from '../config/env.js';
import { PARTY_TYPES, PARTY_STATUS } from '../config/constants.js';
import { getStateCode } from '../config/states.js';
import { validateGstin } from '../utils/gstin.js';
import { generateInviteCode } from '../utils/generateCode.js';
import { normalizePhone } from '../utils/phone.js';
import ApiError from '../utils/ApiError.js';
import { saveImage, deleteImage } from '../utils/storage.js';
import { Business, Party, User } from '../models/index.js';

export async function getBusiness(businessId) {
  const business = await Business.findById(businessId).lean();
  if (!business) throw ApiError.notFound('Business profile nahi mila');
  return { ...business, inviteLink: buildInviteLink(business.inviteCode) };
}

export const buildInviteLink = (code) => (code ? `${env.clientUrl}/join/${code}` : '');

export async function updateBusiness(businessId, payload) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound('Business profile nahi mila');

  const simpleFields = [
    'name', 'email', 'upiId', 'upiName', 'invoicePrefix', 'orderPrefix',
    'termsAndConditions', 'invoiceFooterNote', 'lowStockThreshold',
    'autoApproveRetailers', 'inviteEnabled',
  ];
  for (const field of simpleFields) {
    if (payload[field] !== undefined) business[field] = payload[field];
  }

  if (payload.phone !== undefined) {
    business.phone = payload.phone ? normalizePhone(payload.phone) : '';
  }

  if (payload.address) {
    const addr = { ...(business.address?.toObject?.() || business.address || {}), ...payload.address };
    // State chuna to uska GST code apne aap set ho jata hai
    addr.stateCode = addr.state ? getStateCode(addr.state) : '';
    business.address = addr;
  }

  // ---- GST toggle ----
  const gstEnabled = payload.gstEnabled !== undefined ? payload.gstEnabled : business.gstEnabled;

  if (gstEnabled) {
    const gstin = (payload.gstin !== undefined ? payload.gstin : business.gstin || '').toUpperCase().trim();
    const stateCode = business.address?.stateCode || '';
    const result = validateGstin(gstin, stateCode);
    if (!result.valid) throw ApiError.badRequest(result.message);

    business.gstEnabled = true;
    business.gstin = result.value;
  } else {
    // GST band — GSTIN hata do taaki purana number invoice pe na chhape
    business.gstEnabled = false;
    business.gstin = '';
  }

  await business.save();
  return getBusiness(businessId);
}

export async function setLogo(businessId, file) {
  if (!file) throw ApiError.badRequest('Koi image nahi mili');

  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound('Business profile nahi mila');

  const { url, publicId } = await saveImage(file, 'logos');

  if (business.logoPublicId) await deleteImage(business.logoPublicId);

  business.logoUrl = url;
  business.logoPublicId = publicId;
  await business.save();

  return { logoUrl: url };
}

export async function removeLogo(businessId) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound('Business profile nahi mila');

  if (business.logoPublicId) await deleteImage(business.logoPublicId);
  business.logoUrl = '';
  business.logoPublicId = '';
  await business.save();
  return { logoUrl: '' };
}

export async function regenerateInvite(businessId) {
  const business = await Business.findById(businessId);
  if (!business) throw ApiError.notFound('Business profile nahi mila');

  // Purana link turant band ho jayega
  let code;
  let tries = 0;
  do {
    code = generateInviteCode(8);
    tries += 1;
  } while (await Business.exists({ inviteCode: code }) && tries < 10);

  business.inviteCode = code;
  await business.save();

  return { inviteCode: code, inviteLink: buildInviteLink(code) };
}

/** Retailer list — Part 4 me poora UI banega, abhi approve/reject ke liye */
export async function listRetailers(businessId, status = 'all') {
  const query = { businessId, type: PARTY_TYPES.RETAILER };
  if (status !== 'all') query.status = status;

  const [retailers, counts] = await Promise.all([
    Party.find(query).sort({ createdAt: -1 }).lean(),
    Party.aggregate([
      { $match: { businessId, type: PARTY_TYPES.RETAILER } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
  ]);

  const summary = { pending: 0, active: 0, blocked: 0 };
  counts.forEach((c) => { summary[c._id] = c.n; });

  return { retailers, summary };
}

export async function setRetailerStatus(businessId, partyId, status) {
  const party = await Party.findOne({ _id: partyId, businessId, type: PARTY_TYPES.RETAILER });
  if (!party) throw ApiError.notFound('Retailer nahi mila');

  party.status = status;
  await party.save();

  // Blocked retailer login hi na kar paye
  if (party.linkedUserId) {
    await User.updateOne(
      { _id: party.linkedUserId },
      { isActive: status !== PARTY_STATUS.BLOCKED }
    );
  }

  return party;
}

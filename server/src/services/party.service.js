import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { PARTY_TYPES, PARTY_STATUS, LEDGER_TYPES } from '../config/constants.js';
import { getStateCode } from '../config/states.js';
import { normalizePhone } from '../utils/phone.js';
import { validateGstin } from '../utils/gstin.js';
import { round2 } from '../utils/money.js';
import {
  Party, User, Item, PartyItemRate, Order, Invoice, Payment, LedgerEntry, Purchase, ReturnNote,
} from '../models/index.js';
import { scopeParties, isScoped, canSeeParty } from '../utils/scope.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Hadd wale staff ke liye: ye party iski hai bhi ya nahi.
 *
 * "Nahi mili" hi bolte hain, "ijazat nahi" nahi — warna galat jawab se hi
 * pata chal jata ki us id pe kuch hai. Chhoti baat hai, par isi se doosre
 * salesman ke retailer ginne ja sakte hain.
 */
async function assertVisible(businessId, id, viewer) {
  if (!(await canSeeParty(id, businessId, viewer))) {
    throw ApiError.notFound('Party nahi mili');
  }
}

/* ------------------------------------------------------------------ list */

export async function listParties(businessId, q, viewer = null) {
  // "Sirf apna kaam" wale ko sirf uske naam wale retailer/supplier dikhte hain
  let filter = { businessId };
  if (q.type !== 'all') filter.type = q.type;
  if (q.status !== 'all') filter.status = q.status;

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { shopName: rx }, { phone: rx }, { gstin: rx }];
  }

  filter = scopeParties(filter, viewer);

  const skip = (q.page - 1) * q.limit;

  const [parties, total] = await Promise.all([
    Party.find(filter)
      .sort(q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 })
      .skip(skip).limit(q.limit).lean(),
    Party.countDocuments(filter),
  ]);

  // Kis retailer ke kitne custom rate set hain — list me batana useful hai
  const ids = parties.map((p) => p._id);
  const rateCounts = await PartyItemRate.aggregate([
    { $match: { businessId: new mongoose.Types.ObjectId(businessId), partyId: { $in: ids } } },
    { $group: { _id: '$partyId', n: { $sum: 1 } } },
  ]);
  const rateMap = Object.fromEntries(rateCounts.map((r) => [String(r._id), r.n]));

  return {
    parties: parties.map((p) => ({ ...p, customRateCount: rateMap[String(p._id)] || 0 })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function getStats(businessId, type = PARTY_TYPES.RETAILER, viewer = null) {
  const bid = new mongoose.Types.ObjectId(businessId);

  // Ginti bhi utni hi honi chahiye jitna data dikh raha hai — warna upar
  // "42 retailer" likha aata aur neeche list me 6 dikhte
  const match = isScoped(viewer)
    ? { businessId: bid, type, $or: [{ assignedToUserId: viewer._id }, { createdBy: viewer._id }] }
    : { businessId: bid, type };

  const [rows] = await Party.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
        totalDue: { $sum: { $cond: [{ $gt: ['$balance', 0] }, '$balance', 0] } },
      },
    },
  ]);

  return {
    total: rows?.total || 0,
    pending: rows?.pending || 0,
    active: rows?.active || 0,
    blocked: rows?.blocked || 0,
    totalDue: round2(rows?.totalDue || 0),
  };
}

/* --------------------------------------------------------------- get one */

export async function getParty(businessId, id, viewer = null) {
  const party = await Party.findOne({ _id: id, businessId }).lean();
  if (!party) throw ApiError.notFound('Party nahi mili');

  // Sirf list chhupa dena kaafi nahi — id URL me daali ja sakti hai. Bina is
  // check ke "sirf apna kaam" sirf dikhawa reh jata.
  if (!(await canSeeParty(id, businessId, viewer))) {
    throw ApiError.notFound('Party nahi mili');
  }

  const [customRateCount, linkedUser, orderCount, invoiceCount] = await Promise.all([
    PartyItemRate.countDocuments({ businessId, partyId: id }),
    party.linkedUserId ? User.findById(party.linkedUserId).select('name phone lastLoginAt isActive').lean() : null,
    Order.countDocuments({ businessId, partyId: id }),
    Invoice.countDocuments({ businessId, partyId: id }),
  ]);

  return { ...party, customRateCount, linkedUser, orderCount, invoiceCount };
}

/* -------------------------------------------------------------- create */

export async function createParty(businessId, payload, userId) {
  const phone = normalizePhone(payload.phone);

  const exists = await Party.findOne({ businessId, type: payload.type, phone });
  if (exists) {
    throw ApiError.conflict(
      `Is number se ek ${payload.type === PARTY_TYPES.RETAILER ? 'retailer' : 'supplier'} pehle se hai: ${exists.name}`
    );
  }

  if (payload.gstin) {
    const result = validateGstin(payload.gstin);
    if (!result.valid) throw ApiError.badRequest(result.message);
    payload.gstin = result.value;
  }

  const address = payload.address ? { ...payload.address } : {};
  address.stateCode = address.state ? getStateCode(address.state) : '';

  const opening = round2(payload.openingBalance || 0);

  const party = await Party.create({
    ...payload,
    phone,
    address,
    businessId,
    openingBalance: opening,
    balance: opening,
    // Wholesaler khud add kar raha hai to seedha active. Retailer khud link se
    // aaya to Part 2 me pending banta hai.
    status: PARTY_STATUS.ACTIVE,
    createdBy: userId || null,
    // Kiske naam karna hai — payload me aaya to wahi, warna jisne jodha usi ka
    assignedToUserId: payload.assignedToUserId || userId || null,
  });

  // Purana hisaab khata me pehli entry ban jata hai (Part 9 isi pe aage badhega)
  if (opening !== 0) {
    await LedgerEntry.create({
      businessId,
      partyId: party._id,
      type: LEDGER_TYPES.OPENING,
      debit: opening > 0 ? opening : 0,
      credit: opening < 0 ? -opening : 0,
      balanceAfter: opening,
      note: 'Purana hisaab (opening balance)',
      createdBy: userId,
    });
  }

  return getParty(businessId, party._id);
}

/* -------------------------------------------------------------- update */

export async function updateParty(businessId, id, payload, viewer = null) {
  await assertVisible(businessId, id, viewer);
  const party = await Party.findOne({ _id: id, businessId });
  if (!party) throw ApiError.notFound('Party nahi mili');

  if (payload.phone) {
    const phone = normalizePhone(payload.phone);
    const clash = await Party.findOne({ businessId, type: party.type, phone, _id: { $ne: id } });
    if (clash) throw ApiError.conflict(`Ye number ${clash.name} ke paas pehle se hai`);
    party.phone = phone;
  }

  if (payload.gstin !== undefined) {
    if (payload.gstin) {
      const result = validateGstin(payload.gstin);
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

  for (const f of ['name', 'shopName', 'email', 'creditLimit', 'notes']) {
    if (payload[f] !== undefined) party[f] = payload[f];
  }

  // Kiske naam hai — khali bhejein to "sabka" ho jata hai
  if (payload.assignedToUserId !== undefined) {
    party.assignedToUserId = payload.assignedToUserId || null;
  }

  await party.save();
  return getParty(businessId, id);
}

/* -------------------------------------------------------------- status */

export async function setStatus(businessId, id, status, viewer = null) {
  await assertVisible(businessId, id, viewer);
  const party = await Party.findOne({ _id: id, businessId });
  if (!party) throw ApiError.notFound('Party nahi mili');

  party.status = status;
  await party.save();

  // Blocked retailer ka login hi band ho jata hai
  if (party.linkedUserId) {
    await User.updateOne({ _id: party.linkedUserId }, { isActive: status !== PARTY_STATUS.BLOCKED });
  }

  return getParty(businessId, id);
}

/* -------------------------------------------------------------- delete */

/**
 * Party ka koi order/invoice/payment/purchase hai to delete NAHI hoti — sirf blocked.
 * Warna purane bill ka "kiske naam" hi gayab ho jayega.
 */
export async function deleteParty(businessId, id, viewer = null) {
  await assertVisible(businessId, id, viewer);
  const party = await Party.findOne({ _id: id, businessId });
  if (!party) throw ApiError.notFound('Party nahi mili');

  // Har wo document jo is party se juda ho sakta hai — ek bhi chhoot gaya to
  // party hard-delete ho jayegi aur wo document anaath ho jayega (uska khata
  // bhi neeche LedgerEntry.deleteMany me mit jayega).
  // ReturnNote pehle yahan gina hi nahi jata tha, isliye jis party ka sirf
  // "bina bill ka return" tha wo chupchap delete ho jati thi.
  const [orders, invoices, payments, purchases, returns] = await Promise.all([
    Order.countDocuments({ businessId, partyId: id }),
    Invoice.countDocuments({ businessId, partyId: id }),
    Payment.countDocuments({ businessId, partyId: id }),
    Purchase.countDocuments({ businessId, supplierId: id }),
    ReturnNote.countDocuments({ businessId, partyId: id }),
  ]);

  const used = orders + invoices + payments + purchases + returns;

  if (used > 0) {
    party.status = PARTY_STATUS.BLOCKED;
    party.isActive = false;
    await party.save();
    if (party.linkedUserId) await User.updateOne({ _id: party.linkedUserId }, { isActive: false });

    // Kya kya mila, wahi naam le kar batao — "record hai" se user ko kuch pata nahi chalta
    const parts = [];
    if (orders) parts.push(`${orders} order`);
    if (invoices) parts.push(`${invoices} bill`);
    if (payments) parts.push(`${payments} payment`);
    if (purchases) parts.push(`${purchases} kharid`);
    if (returns) parts.push(`${returns} return`);

    return {
      deleted: false,
      blocked: true,
      message: `${party.name} ka ${parts.join(', ')} hai, isliye delete nahi kiya — block kar diya`,
    };
  }

  await PartyItemRate.deleteMany({ businessId, partyId: id });
  await LedgerEntry.deleteMany({ businessId, partyId: id });
  if (party.linkedUserId) await User.deleteOne({ _id: party.linkedUserId });
  await party.deleteOne();

  return { deleted: true, blocked: false, message: `${party.name} delete ho gaya` };
}

/* ------------------------------------------------------ party-wise rates */

/**
 * Har item ke saath dikhata hai: is party ka effective rate aur wo kahan se aaya.
 */
export async function listRates(businessId, partyId, q, viewer = null) {
  await assertVisible(businessId, partyId, viewer);
  const party = await Party.findOne({ _id: partyId, businessId }).select('name type').lean();
  if (!party) throw ApiError.notFound('Party nahi mili');

  const filter = { businessId, isActive: true };
  if (q.categoryId === 'none') filter.categoryId = null;
  else if (q.categoryId) filter.categoryId = q.categoryId;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { sku: rx }];
  }

  const customRates = await PartyItemRate.find({ businessId, partyId }).select('itemId rate').lean();
  const rateMap = new Map(customRates.map((r) => [String(r.itemId), r.rate]));

  if (q.onlyCustom === 'true') filter._id = { $in: customRates.map((r) => r.itemId) };

  const skip = (q.page - 1) * q.limit;
  const [items, total] = await Promise.all([
    Item.find(filter).sort({ name: 1 }).skip(skip).limit(q.limit)
      .populate('categoryId', 'name').lean(),
    Item.countDocuments(filter),
  ]);

  const rows = items.map((item) => {
    const custom = rateMap.get(String(item._id));
    const hasCustom = custom !== undefined;
    const rate = hasCustom ? custom : (item.wholesalePrice > 0 ? item.wholesalePrice : item.salePrice || 0);
    const source = hasCustom ? 'custom' : (item.wholesalePrice > 0 ? 'wholesale' : 'sale');

    return {
      _id: item._id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      category: item.categoryId?.name || null,
      imageUrl: item.imageUrl,
      purchasePrice: item.purchasePrice,
      salePrice: item.salePrice,
      wholesalePrice: item.wholesalePrice,
      customRate: hasCustom ? custom : null,
      rate: round2(rate),
      source,
      margin: item.purchasePrice > 0 ? round2(rate - item.purchasePrice) : null,
    };
  });

  return {
    party,
    rows,
    customCount: customRates.length,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function setRate(businessId, partyId, itemId, rate, viewer = null) {
  await assertVisible(businessId, partyId, viewer);
  const [party, item] = await Promise.all([
    Party.findOne({ _id: partyId, businessId }).select('name').lean(),
    Item.findOne({ _id: itemId, businessId }).select('name').lean(),
  ]);
  if (!party) throw ApiError.notFound('Party nahi mili');
  if (!item) throw ApiError.notFound('Item nahi mila');

  // rate null = custom rate hata do, wapas wholesale/sale pe
  if (rate === null || rate === undefined) {
    await PartyItemRate.deleteOne({ businessId, partyId, itemId });
    return { removed: true, message: `${item.name} ka special rate hata diya` };
  }

  await PartyItemRate.findOneAndUpdate(
    { businessId, partyId, itemId },
    { rate: round2(rate) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { removed: false, message: `${item.name} ka rate ${party.name} ke liye set ho gaya` };
}

const ROUNDERS = {
  none: (n) => round2(n),
  1: (n) => Math.round(n),
  0.5: (n) => Math.round(n * 2) / 2,
  5: (n) => Math.round(n / 5) * 5,
  10: (n) => Math.round(n / 10) * 10,
};

/**
 * "Suresh ko har cheez wholesale se 5% kam" — ek click me sab items pe rate lag jata hai.
 */
export async function bulkSetRates(businessId, partyId, { mode, value, categoryId, roundTo }, viewer = null) {
  await assertVisible(businessId, partyId, viewer);
  const party = await Party.findOne({ _id: partyId, businessId }).select('name').lean();
  if (!party) throw ApiError.notFound('Party nahi mili');

  const filter = { businessId, isActive: true };
  if (categoryId === 'none') filter.categoryId = null;
  else if (categoryId) filter.categoryId = categoryId;

  if (mode === 'clear') {
    const items = await Item.find(filter).select('_id').lean();
    const res = await PartyItemRate.deleteMany({
      businessId, partyId, itemId: { $in: items.map((i) => i._id) },
    });
    return { affected: res.deletedCount || 0, message: `${res.deletedCount || 0} item ka special rate hata diya` };
  }

  const items = await Item.find(filter).select('salePrice wholesalePrice purchasePrice').lean();
  if (!items.length) throw ApiError.badRequest('Is filter me koi item nahi mila');

  const round = ROUNDERS[String(roundTo)] || ROUNDERS.none;
  const ops = [];

  for (const item of items) {
    let base;
    if (mode === 'percentOffWholesale') base = item.wholesalePrice > 0 ? item.wholesalePrice : item.salePrice;
    else if (mode === 'percentOffSale') base = item.salePrice;
    else base = item.purchasePrice; // percentOnPurchase

    if (!base || base <= 0) continue;

    const rate = mode === 'percentOnPurchase'
      ? round(base * (1 + value / 100))   // purchase pe markup
      : round(base * (1 - value / 100));  // discount

    if (rate < 0) continue;

    ops.push({
      updateOne: {
        filter: { businessId, partyId, itemId: item._id },
        update: { $set: { rate: round2(rate) } },
        upsert: true,
      },
    });
  }

  if (!ops.length) throw ApiError.badRequest('Kisi item ka base price set nahi hai — pehle price bhar lein');

  await PartyItemRate.bulkWrite(ops);

  return { affected: ops.length, message: `${ops.length} item pe ${party.name} ka rate set ho gaya` };
}

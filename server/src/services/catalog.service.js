import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { Item, Category, Business } from '../models/index.js';
import { resolveRates } from './rate.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Retailer ka catalog.
 *
 * Do baatein pakki:
 *   1. Sirf `visibleToRetailers` items — jo wholesaler ne chhupaye wo dikhte hi nahi
 *   2. Rate hamesha rate.service se — cart aur bill me bhi wahi rate aayega
 */
export async function listCatalog(businessId, partyId, q) {
  const filter = { businessId, isActive: true, visibleToRetailers: true };

  if (q.categoryId === 'none') filter.categoryId = null;
  else if (q.categoryId) filter.categoryId = q.categoryId;

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { sku: rx }];
  }

  if (q.stock === 'in') filter.stockQty = { $gt: 0 };

  const sortByRate = q.sort === 'rate' || q.sort === '-rate';
  const skip = (q.page - 1) * q.limit;

  // Rate ke hisaab se sort karna ho to pehle sab uthana padta hai
  // (rate DB me nahi, resolve hoke banta hai)
  const dbSort = sortByRate
    ? { name: 1 }
    : (q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 });

  const [rawItems, total] = await Promise.all([
    Item.find(filter)
      .sort(dbSort)
      .skip(sortByRate ? 0 : skip)
      .limit(sortByRate ? 500 : q.limit)
      .populate('categoryId', 'name')
      .select('name sku unit imageUrl description stockQty lowStockAt salePrice wholesalePrice categoryId createdAt brand modelNo mrp warrantyMonths warrantyNote minOrderQty')
      .lean(),
    Item.countDocuments(filter),
  ]);

  let items = (await resolveRates(businessId, partyId, rawItems)).map(decorate);

  if (sortByRate) {
    items.sort((a, b) => (q.sort === 'rate' ? a.rate - b.rate : b.rate - a.rate));
    items = items.slice(skip, skip + q.limit);
  }

  return {
    items,
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

function decorate(item) {
  const stockQty = Number(item.stockQty || 0);
  return {
    _id: item._id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    description: item.description,
    imageUrl: item.imageUrl,
    category: item.categoryId?.name || null,
    categoryId: item.categoryId?._id || null,
    rate: round2(item.rate),
    rateSource: item.rateSource,
    // Retailer ko "aapke liye khaas rate" dikhta hai, par kitna kam hai wo nahi
    hasSpecialRate: item.rateSource === 'custom',
    stockQty,
    inStock: stockQty > 0,
    isLowStock: stockQty > 0 && stockQty <= Number(item.lowStockAt || 0),

    // Part 11 — retailer ko ye bhi dikhna chahiye
    brand: item.brand || '',
    modelNo: item.modelNo || '',
    mrp: Number(item.mrp || 0),
    warrantyMonths: Number(item.warrantyMonths || 0),
    warrantyText: warrantyText(item.warrantyMonths),
    warrantyNote: item.warrantyNote || '',
    minOrderQty: Number(item.minOrderQty || 0),
  };
}

/** 18 -> "1 saal 6 mahine". Model ka virtual .lean() pe nahi milta, isliye yahan dobara. */
export function warrantyText(months) {
  const m = Number(months || 0);
  if (!m) return '';
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return [years && `${years} saal`, rest && `${rest} mahine`].filter(Boolean).join(' ');
}

export async function getCatalogItem(businessId, partyId, id) {
  const item = await Item.findOne({ _id: id, businessId, isActive: true, visibleToRetailers: true })
    .populate('categoryId', 'name').lean();
  if (!item) throw ApiError.notFound('Ye item ab available nahi hai');

  const [priced] = await resolveRates(businessId, partyId, [item]);
  return decorate(priced);
}

/** Sirf wahi categories jinme retailer ke liye kuch hai */
export async function listCatalogCategories(businessId) {
  const [categories, counts] = await Promise.all([
    Category.find({ businessId, isActive: true }).sort({ name: 1 }).select('name').lean(),
    Item.aggregate([
      { $match: { businessId: new mongoose.Types.ObjectId(businessId),
        isActive: true, visibleToRetailers: true, categoryId: { $ne: null } } },
      { $group: { _id: '$categoryId', n: { $sum: 1 } } },
    ]),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));

  return categories
    .map((c) => ({ ...c, itemCount: countMap[String(c._id)] || 0 }))
    .filter((c) => c.itemCount > 0);
}

/** Retailer ko dukaan ki basic detail (catalog header ke liye) */
export async function getShopInfo(businessId) {
  const business = await Business.findById(businessId)
    .select('name phone address logoUrl gstEnabled').lean();
  if (!business) throw ApiError.notFound('Dukaan nahi mili');
  return business;
}

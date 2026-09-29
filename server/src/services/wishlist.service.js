import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { Item, Party, Wishlist } from '../models/index.js';
import { resolveRates } from './rate.service.js';

/**
 * WISHLIST — kharidaar ki taraf "ye chahiye", malik ki taraf "log kya maang
 * rahe hain". Model me poori soch likhi hai (models/Wishlist.js).
 */

// Ek aadmi ki list ka hadd — spam na bane, aur list padhne layak rahe
const MAX_PER_PARTY = 100;

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/* ─────────────────────────── kharidaar ki taraf ─────────────────────────── */

export async function listWishlist(businessId, partyId) {
  const rows = await Wishlist.find({ businessId, partyId }).sort({ createdAt: -1 }).lean();

  const itemIds = rows.filter((r) => r.itemId).map((r) => r.itemId);
  const items = itemIds.length
    ? await Item.find({ _id: { $in: itemIds }, businessId, isActive: true, visibleToRetailers: true })
      .select('name imageUrl unit stockQty salePrice wholesalePrice').lean()
    : [];
  // Rate wahi jo is kharidaar ko catalog me dikhta hai (uska khaas rate bhi)
  const priced = items.length ? await resolveRates(businessId, partyId, items) : [];
  const byId = new Map(priced.map((i) => [String(i._id), i]));

  return rows.map((r) => {
    const it = r.itemId ? byId.get(String(r.itemId)) : null;
    return {
      _id: r._id,
      itemId: r.itemId,
      text: r.text,
      createdAt: r.createdAt,
      // itemId hai par item nahi mila = dukaan ne hata/chhupa diya
      item: it ? {
        _id: it._id,
        name: it.name,
        imageUrl: it.imageUrl || '',
        unit: it.unit,
        rate: round2(it.rate),
        inStock: Number(it.stockQty || 0) > 0,
      } : null,
    };
  });
}

/** Sirf item ki id — catalog me dil (heart) bhara dikhane ke liye */
export async function wishlistItemIds(businessId, partyId) {
  const rows = await Wishlist.find({ businessId, partyId, itemId: { $ne: null } }).select('itemId').lean();
  return rows.map((r) => r.itemId);
}

export async function addWish(businessId, partyId, { itemId, text }) {
  const count = await Wishlist.countDocuments({ businessId, partyId });
  if (count >= MAX_PER_PARTY) {
    throw ApiError.badRequest(`Wishlist me ${MAX_PER_PARTY} se zyada cheez nahi — purani hata dijiye`);
  }

  if (itemId) {
    const item = await Item.exists({ _id: itemId, businessId, isActive: true, visibleToRetailers: true });
    if (!item) throw ApiError.badRequest('Ye maal is dukaan me nahi mila');
    // Dobara tap = wahi line, doosri nahi
    const existing = await Wishlist.findOne({ businessId, partyId, itemId }).lean();
    if (existing) return existing;
    return (await Wishlist.create({ businessId, partyId, itemId })).toObject();
  }

  const t = clean(text).slice(0, 200);
  if (t.length < 2) throw ApiError.badRequest('Kya chahiye, thoda likh dijiye');
  const same = await Wishlist.findOne({
    businessId, partyId, itemId: null,
    text: new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).lean();
  if (same) return same;
  return (await Wishlist.create({ businessId, partyId, text: t })).toObject();
}

export async function removeWish(businessId, partyId, id) {
  const res = await Wishlist.deleteOne({ _id: id, businessId, partyId });
  if (!res.deletedCount) throw ApiError.notFound('Ye wishlist me nahi mila');
  return { removed: true };
}

/** Item se hatana (dil dobara dabane pe) — id pata na ho tab bhi */
export async function removeWishForItem(businessId, partyId, itemId) {
  await Wishlist.deleteOne({ businessId, partyId, itemId });
  return { removed: true };
}

/* ─────────────────────────── malik ki taraf ─────────────────────────── */

/**
 * "Log kya maang rahe hain" — do hisse:
 *
 *   items — apna maal jise kitne logon ne wishlist me rakha (sabse zyada
 *           upar). Khatam maal pe zyada maang = dobara mangwane ka ishara.
 *   asks  — wo maal jo dukaan me hai hi nahi (likh kar maanga), kisne maanga.
 */
export async function demandFor(businessId) {
  const bid = new mongoose.Types.ObjectId(String(businessId));

  const grouped = await Wishlist.aggregate([
    { $match: { businessId: bid, itemId: { $ne: null } } },
    { $group: { _id: '$itemId', count: { $sum: 1 }, last: { $max: '$createdAt' } } },
    { $sort: { count: -1, last: -1 } },
    { $limit: 100 },
  ]);
  const items = grouped.length
    ? await Item.find({ _id: { $in: grouped.map((g) => g._id) }, businessId })
      .select('name imageUrl unit stockQty isActive').lean()
    : [];
  const itemMap = new Map(items.map((i) => [String(i._id), i]));

  const asksRaw = await Wishlist.find({ businessId, itemId: null })
    .sort({ createdAt: -1 }).limit(100).lean();
  const parties = asksRaw.length
    ? await Party.find({ _id: { $in: [...new Set(asksRaw.map((a) => String(a.partyId)))] } })
      .select('name shopName').lean()
    : [];
  const partyMap = new Map(parties.map((p) => [String(p._id), p]));

  return {
    items: grouped
      .map((g) => {
        const it = itemMap.get(String(g._id));
        if (!it) return null;
        return {
          itemId: g._id,
          name: it.name,
          imageUrl: it.imageUrl || '',
          unit: it.unit,
          stockQty: Number(it.stockQty || 0),
          hidden: !it.isActive,
          count: g.count,
          last: g.last,
        };
      })
      .filter(Boolean),
    asks: asksRaw.map((a) => {
      const p = partyMap.get(String(a.partyId));
      return {
        _id: a._id,
        text: a.text,
        partyId: a.partyId,
        partyName: p?.shopName || p?.name || '',
        createdAt: a.createdAt,
      };
    }),
  };
}

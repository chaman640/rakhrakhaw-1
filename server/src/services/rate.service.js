import { round2 } from '../utils/money.js';
import { Item, PartyItemRate } from '../models/index.js';

/**
 * RATE RESOLUTION CHAIN — poore project me rate lagane ka ek hi tarika.
 *
 *   1. PartyItemRate      (is retailer ke liye khaas rate)
 *   2. item.wholesalePrice (sabhi retailers ke liye)
 *   3. item.salePrice      (default / counter sale)
 *
 * Part 6 (cart) aur Part 8 (invoice) dono yahi use karenge — warna cart me ek rate
 * aur bill me dusra rate aa jayega.
 */
export function pickRate(item, customRate) {
  if (customRate !== undefined && customRate !== null) {
    return { rate: round2(customRate), source: 'custom' };
  }
  if (item.wholesalePrice > 0) {
    return { rate: round2(item.wholesalePrice), source: 'wholesale' };
  }
  return { rate: round2(item.salePrice || 0), source: 'sale' };
}

/** Ek item ka rate */
export async function resolveRate(businessId, partyId, itemId) {
  const [item, custom] = await Promise.all([
    Item.findOne({ _id: itemId, businessId }).select('wholesalePrice salePrice').lean(),
    partyId ? PartyItemRate.findOne({ businessId, partyId, itemId }).select('rate').lean() : null,
  ]);
  if (!item) return null;
  return pickRate(item, custom?.rate);
}

/**
 * Bahut saare items ka rate ek saath — cart/invoice me har item pe alag query
 * maarna theek nahi, isliye ek hi baar me sab nikal lete hain.
 */
export async function resolveRates(businessId, partyId, items) {
  const itemIds = items.map((i) => i._id);

  const customRates = partyId
    ? await PartyItemRate.find({ businessId, partyId, itemId: { $in: itemIds } })
        .select('itemId rate').lean()
    : [];

  const rateMap = new Map(customRates.map((r) => [String(r.itemId), r.rate]));

  return items.map((item) => {
    const { rate, source } = pickRate(item, rateMap.get(String(item._id)));
    return { ...item, rate, rateSource: source };
  });
}

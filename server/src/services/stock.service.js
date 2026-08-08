import ApiError from '../utils/ApiError.js';
import { STOCK_MOVEMENT_TYPES } from '../config/constants.js';
import { Item, StockMovement } from '../models/index.js';

/**
 * STOCK BADALNE KA EK HI RASTA.
 *
 * Poore project me stock kabhi seedha Item.stockQty pe mat likhna — hamesha yahi function.
 * Kyunki har badlav ka StockMovement record banna zaroori hai, warna "stock kahan gaya"
 * ka jawab kabhi nahi milega.
 *
 * qty signed hai:  +10 = stock aaya,  -3 = stock gaya
 *
 * Part 5 (purchase), Part 8 (invoice) — dono yahi call karenge.
 */
export async function applyStockChange({
  businessId,
  itemId,
  type,
  qty,
  refType = null,
  refId = null,
  note = '',
  userId = null,
  allowNegative = false,
}) {
  if (!qty || Number.isNaN(Number(qty))) {
    throw ApiError.badRequest('Quantity 0 nahi ho sakti');
  }

  const filter = { _id: itemId, businessId };

  // Stock ghata rahe hain to atomically check karo ki itna hai bhi ya nahi.
  // Do order ek saath aayen tab bhi stock minus me nahi jayega.
  if (qty < 0 && !allowNegative) filter.stockQty = { $gte: -qty };

  const item = await Item.findOneAndUpdate(filter, { $inc: { stockQty: qty } }, { new: true });

  if (!item) {
    const exists = await Item.findOne({ _id: itemId, businessId }).select('name stockQty unit').lean();
    if (!exists) throw ApiError.notFound('Item nahi mila');
    throw ApiError.badRequest(
      `${exists.name} ka stock kam hai — sirf ${exists.stockQty} ${exists.unit} bacha hai`
    );
  }

  await StockMovement.create({
    businessId,
    itemId,
    type,
    qty,
    balanceAfter: item.stockQty,
    refType,
    refId,
    note,
    createdBy: userId,
  });

  // Stock ghata hai to dekh lo kahin khatam to nahi ho raha
  if (qty < 0) await maybeWarnLowStock(businessId, item, qty);

  return item;
}

/**
 * Low stock ka alert.
 *
 * Sirf tab bhejta hai jab stock threshold ko PAAR kiya ho — yaani pehle upar tha, ab neeche.
 * Isse har bill pe wahi alert dobara nahi aata. Alert bhejne me kuch gadbad ho jaye to
 * bill nahi rukna chahiye, isliye poora block try/catch me hai.
 */
async function maybeWarnLowStock(businessId, item, qty) {
  try {
    const before = item.stockQty - qty;   // qty minus me hai, isliye ghatane se pehle wala mil jata hai
    const limit = item.lowStockAt ?? 0;

    const crossedOut = before > 0 && item.stockQty <= 0;
    const crossedLow = before > limit && item.stockQty <= limit;
    if (!crossedOut && !crossedLow) return;

    const { notifyWholesaler } = await import('./notification.service.js');
    const { NOTIFICATION_TYPES } = await import('../config/constants.js');

    await notifyWholesaler(businessId, {
      type: NOTIFICATION_TYPES.LOW_STOCK,
      title: crossedOut ? `${item.name} khatam ho gaya` : `${item.name} kam bacha hai`,
      body: crossedOut
        ? 'Stock 0 hai — order aaya to pura nahi kar payenge'
        : `Sirf ${item.stockQty} ${item.unit} bacha hai`,
      link: `/items?q=${encodeURIComponent(item.name)}`,
      data: { itemId: item._id, stockQty: item.stockQty },
    });
  } catch {
    // alert na jaye to bhi stock ka kaam nahi rukna chahiye
  }
}

/** Stock ko seedha ek number pe set karna (physical count ke baad) */
export async function setStock({ businessId, itemId, newQty, note = '', userId = null }) {
  const item = await Item.findOne({ _id: itemId, businessId }).select('stockQty').lean();
  if (!item) throw ApiError.notFound('Item nahi mila');

  const delta = Number(newQty) - Number(item.stockQty);
  if (delta === 0) {
    return Item.findById(itemId);
  }

  return applyStockChange({
    businessId,
    itemId,
    type: STOCK_MOVEMENT_TYPES.ADJUSTMENT,
    qty: delta,
    note: note || `Stock ${item.stockQty} se ${newQty} kiya`,
    userId,
    allowNegative: true,
  });
}

export async function getMovements(businessId, itemId, { limit = 50 } = {}) {
  return StockMovement.find({ businessId, itemId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'name')
    .lean();
}

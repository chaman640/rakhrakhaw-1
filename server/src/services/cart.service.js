import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { Cart, Item } from '../models/index.js';
import { resolveRates } from './rate.service.js';

/**
 * Cart me sirf itemId aur qty rehti hai. Rate, total, stock — sab har baar
 * dobara nikalta hai. Isliye wholesaler rate badal de to cart me turant naya
 * rate dikhega, aur order bhi usi rate pe jayega.
 */
export async function getCart(businessId, partyId) {
  const cart = await Cart.findOne({ businessId, partyId }).lean();
  if (!cart || !cart.items.length) {
    return { items: [], itemCount: 0, totalQty: 0, total: 0, note: cart?.note || '', warnings: [] };
  }

  const itemIds = cart.items.map((i) => i.itemId);
  const rawItems = await Item.find({
    _id: { $in: itemIds }, businessId, isActive: true, visibleToRetailers: true,
  }).select('name sku unit imageUrl stockQty salePrice wholesalePrice').lean();

  const priced = await resolveRates(businessId, partyId, rawItems);
  const priceMap = new Map(priced.map((p) => [String(p._id), p]));

  const warnings = [];
  const lines = [];

  for (const line of cart.items) {
    const item = priceMap.get(String(line.itemId));

    // Wholesaler ne item hata diya ya chhupa diya
    if (!item) {
      warnings.push({ type: 'removed', message: 'Ek item ab available nahi hai, cart se hata diya' });
      continue;
    }

    const qty = round2(line.qty);
    const amount = round2(qty * item.rate);

    if (item.stockQty <= 0) {
      warnings.push({ type: 'out', itemId: item._id, message: `${item.name} abhi khatam hai` });
    } else if (qty > item.stockQty) {
      warnings.push({
        type: 'low', itemId: item._id,
        message: `${item.name} me abhi sirf ${item.stockQty} ${item.unit} hai`,
      });
    }

    lines.push({
      itemId: item._id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      imageUrl: item.imageUrl,
      rate: item.rate,
      rateSource: item.rateSource,
      hasSpecialRate: item.rateSource === 'custom',
      qty,
      amount,
      stockQty: item.stockQty,
      inStock: item.stockQty > 0,
      enough: item.stockQty >= qty,
    });
  }

  // Jo item gayab ho gaye unhe cart se saaf kar do
  if (lines.length !== cart.items.length) {
    await Cart.updateOne(
      { businessId, partyId },
      { items: lines.map((l) => ({ itemId: l.itemId, qty: l.qty })) }
    );
  }

  return {
    items: lines,
    itemCount: lines.length,
    totalQty: round2(lines.reduce((s, l) => s + l.qty, 0)),
    total: round2(lines.reduce((s, l) => s + l.amount, 0)),
    note: cart.note || '',
    warnings,
  };
}

async function assertOrderable(businessId, itemId) {
  const item = await Item.findOne({
    _id: itemId, businessId, isActive: true, visibleToRetailers: true,
  }).select('name stockQty unit minOrderQty').lean();

  if (!item) throw ApiError.notFound('Ye item available nahi hai');
  if (item.stockQty <= 0) throw ApiError.badRequest(`${item.name} abhi khatam hai`);
  return item;
}

/**
 * Kam se kam order ki rok (Part 11).
 * Cart ka KUL qty dekhta hai, sirf abhi jodi hui qty nahi — warna 1+1 kar ke
 * koi bhi limit se bach jata.
 */
function assertMinQty(item, totalQty) {
  const min = Number(item.minOrderQty || 0);
  if (min > 1 && totalQty < min) {
    throw ApiError.badRequest(
      `${item.name} kam se kam ${min} ${item.unit} lena padega`
    );
  }
}

/** Add — pehle se cart me hai to qty jud jati hai */
export async function addToCart(businessId, partyId, { itemId, qty }) {
  const item = await assertOrderable(businessId, itemId);

  const cart = await Cart.findOneAndUpdate(
    { businessId, partyId },
    { $setOnInsert: { businessId, partyId } },
    { upsert: true, new: true }
  );

  const existing = cart.items.find((i) => String(i.itemId) === String(itemId));
  const newQty = round2((existing?.qty || 0) + qty);
  assertMinQty(item, newQty);

  if (existing) existing.qty = newQty;
  else cart.items.push({ itemId, qty: newQty });

  await cart.save();
  return { cart: await getCart(businessId, partyId), message: `${item.name} cart me daal diya` };
}

/** qty 0 bhejo to item cart se nikal jata hai */
export async function setCartQty(businessId, partyId, itemId, qty) {
  const cart = await Cart.findOne({ businessId, partyId });
  if (!cart) throw ApiError.notFound('Cart khali hai');

  if (qty <= 0) {
    cart.items = cart.items.filter((i) => String(i.itemId) !== String(itemId));
  } else {
    const item = await assertOrderable(businessId, itemId);
    assertMinQty(item, round2(qty));
    const existing = cart.items.find((i) => String(i.itemId) === String(itemId));
    if (existing) existing.qty = round2(qty);
    else cart.items.push({ itemId, qty: round2(qty) });
  }

  await cart.save();
  return getCart(businessId, partyId);
}

export async function removeFromCart(businessId, partyId, itemId) {
  await Cart.updateOne({ businessId, partyId }, { $pull: { items: { itemId } } });
  return getCart(businessId, partyId);
}

export async function clearCart(businessId, partyId) {
  await Cart.updateOne({ businessId, partyId }, { items: [], note: '' });
  return getCart(businessId, partyId);
}

export async function setCartNote(businessId, partyId, note) {
  await Cart.findOneAndUpdate(
    { businessId, partyId },
    { note, $setOnInsert: { businessId, partyId } },
    { upsert: true }
  );
  return getCart(businessId, partyId);
}

/** Sidebar ke badge ke liye — poora cart nahi chahiye */
export async function getCartCount(businessId, partyId) {
  const cart = await Cart.findOne({ businessId, partyId }).select('items').lean();
  return { count: cart?.items?.length || 0 };
}

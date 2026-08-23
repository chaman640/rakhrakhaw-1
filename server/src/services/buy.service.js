import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import { buyerFilter } from '../utils/buyer.js';
import { PARTY_STATUS, ORDER_PAYMENT_MODES } from '../config/constants.js';
import { Business, Cart, Membership, Party } from '../models/index.js';
import { getCart } from './cart.service.js';
import { placeOrder } from './order.service.js';

/**
 * SAB DUKAANON KA CART EK SAATH.
 *
 * Ek dukaan ka cart pehle se `cart.service.js` sambhalta hai, aur wo poora
 * `(businessId, partyId)` pe chalta hai — yaani har dukaan ka cart pehle se
 * ALAG hai. Isliye yahan naya cart nahi banaya gaya; ye file bas un sab carton
 * ko ek jagah jod kar deti hai.
 *
 * Ye baat mehnga bachaav hai: rate dobara nikalna, "item hat gaya", "rate badal
 * gaya", "stock kam hai" — ye saara hisaab ek hi jagah likha hai aur wahin se
 * chalta rehta hai. Do jagah likhne par dono dheere dheere alag ho jate, aur
 * cart page ek rate dikhata aur order doosre rate pe jata.
 *
 * SEEDHA `Cart.find()` kyun (har membership pe getCart kyun nahi):
 * ek aadmi ki das dukaanein ho sakti hain aur cart do me hi hota hai. Har ek pe
 * poora hisaab lagana das guna kaam hai jiska aath hissa khali jawab deta.
 * Isliye pehle ye poochte hain ki cart kis-kis me PADA hai, aur mehnat sirf
 * unhi pe lagti hai.
 */

/** Kharidaar ki saari judi hui dukaanein — ek hi jagah se */
async function myMemberships(user) {
  const mine = buyerFilter(user);
  if (!mine) return [];
  return Membership.find(mine).sort({ lastUsedAt: -1 }).lean();
}

function shopHead(business, party) {
  return {
    _id: business._id,
    name: business.name,
    phone: business.phone || '',
    logoUrl: business.logoUrl || '',
    city: business.address?.city || '',
    gstEnabled: Boolean(business.gstEnabled),
    partyStatus: party?.status || null,
    balance: party ? Number(party.balance || 0) : 0,
  };
}

/**
 * Har dukaan ka apna dabba — naam, logo, uska maal aur uska jod. Aakhir me kul jod.
 */
export async function getGroupedCart(user) {
  const memberships = await myMemberships(user);
  if (!memberships.length) {
    return { shops: [], shopCount: 0, itemCount: 0, grandTotal: 0, warnings: [] };
  }

  const partyIds = memberships.map((m) => m.partyId);

  // Pehle sirf itna: cart kis-kis dukaan me pada hai
  const filled = await Cart.find({ partyId: { $in: partyIds }, 'items.0': { $exists: true } })
    .select('businessId partyId').lean();

  if (!filled.length) {
    return { shops: [], shopCount: 0, itemCount: 0, grandTotal: 0, warnings: [] };
  }

  const wanted = new Set(filled.map((c) => `${c.businessId}|${c.partyId}`));
  const live = memberships.filter((m) => wanted.has(`${m.businessId}|${m.partyId}`));

  const [businesses, parties] = await Promise.all([
    Business.find({ _id: { $in: live.map((m) => m.businessId) } })
      .select('name phone logoUrl address gstEnabled').lean(),
    Party.find({ _id: { $in: live.map((m) => m.partyId) } })
      .select('status balance').lean(),
  ]);

  const bMap = new Map(businesses.map((b) => [String(b._id), b]));
  const pMap = new Map(parties.map((p) => [String(p._id), p]));

  const carts = await Promise.all(live.map((m) => getCart(m.businessId, m.partyId)));

  const shops = [];
  const warnings = [];

  live.forEach((m, i) => {
    const business = bMap.get(String(m.businessId));
    const cart = carts[i];
    // Dukaan band ho gayi, ya cart padhte-padhte khali ho gaya (saare item hat gaye)
    if (!business || !cart.items.length) return;

    const party = pMap.get(String(m.partyId));
    shops.push({
      shop: shopHead(business, party),
      ...cart,
      // Order ja sakta hai ya nahi — approve na hone par ye dabba dikhega par
      // uska button band rahega, aur wajah saath likhi hogi
      canOrder: party?.status === PARTY_STATUS.ACTIVE,
    });

    /*
      Chetavni ke saath DUKAAN ka naam bhi.

      Ek dukaan ke cart me wo bina naam ke theek thi ("Bearing ka rate badal
      gaya"). Ab paanch dukaanon ka maal ek hi screen pe hai — bina naam ke
      pata hi nahi chalta ki kiski baat ho rahi hai.
    */
    for (const w of cart.warnings || []) {
      warnings.push({ ...w, shopId: business._id, shopName: business.name });
    }
  });

  return {
    shops,
    shopCount: shops.length,
    itemCount: shops.reduce((s, x) => s + x.itemCount, 0),
    totalQty: round2(shops.reduce((s, x) => s + x.totalQty, 0)),
    grandTotal: round2(shops.reduce((s, x) => s + x.total, 0)),
    warnings,
  };
}

/** Neeche wali patti ke badge ke liye — poora hisaab nahi chahiye */
export async function getGroupedCartCount(user) {
  const memberships = await myMemberships(user);
  if (!memberships.length) return { count: 0, shopCount: 0 };

  const carts = await Cart.find({
    partyId: { $in: memberships.map((m) => m.partyId) },
    'items.0': { $exists: true },
  }).select('items businessId').lean();

  return {
    count: carts.reduce((s, c) => s + (c.items?.length || 0), 0),
    shopCount: carts.length,
  };
}

/**
 * EK CONFIRM — HAR DUKAAN KA APNA ORDER.
 *
 * Ye jaan-boojh kar ek hi bada order nahi banata. Har dukaan ka apna order
 * banta hai, apne number ke saath, us dukaan ke apne business ke andar — aur
 * isi wajah se stock, rate, GST, khata aur notification sab pehle jaise chalte
 * hain. Bechne wale ko bhi bilkul wahi order dikhta hai jaisa pehle dikhta tha;
 * use pata bhi nahi chalta ki kharidaar ne ek saath teen dukaanon me bheja tha.
 *
 * Isi se "alag alag notification" wali baat apne aap poori ho jati hai —
 * `placeOrder` har dukaan ko uski apni khabar bhejta hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EK DUKAAN FAIL HO JAYE TO BAAKI NAHI RUKTE.
 *
 * Ye sabse zaroori faisla hai. Teen dukaanon ka maal chuna, teesri ka ek item
 * beech me khatam ho gaya — poora checkout fail kar dena sabse bura hoga:
 * kharidaar ko lagta hai kuch gaya hi nahi, wo dobara dabata hai, aur pehli do
 * dukaanon me DO-DO order chale jate hain.
 *
 * Isliye har dukaan apne aap me poori hai: jiska ban gaya uska cart khali ho
 * gaya, jiska nahi bana uska cart JAISA KA WAISA pada hai. Jawab me dono list
 * jati hain, aur screen saaf saaf batati hai ki kiska gaya aur kiska nahi.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function checkoutMany(user, { orders = [] } = {}) {
  if (!orders.length) throw ApiError.badRequest('Kis dukaan ko order bhejna hai, ye nahi bataya');

  const memberships = await myMemberships(user);
  const byShop = new Map(memberships.map((m) => [String(m.businessId), m]));

  const placed = [];
  const failed = [];

  for (const row of orders) {
    const membership = byShop.get(String(row.shopId));

    if (!membership) {
      failed.push({ shopId: row.shopId, shopName: '', message: 'Aap is dukaan se jude nahi hain' });
      continue;
    }

    try {
      const order = await placeOrder(membership.businessId, membership.partyId, user._id, {
        note: row.note || '',
        paymentMode: row.paymentMode || ORDER_PAYMENT_MODES.UDHAAR,
      });
      placed.push({ shopId: membership.businessId, orderId: order._id, orderNo: order.orderNo });
    } catch (err) {
      /*
        Yahan `throw` NAHI karte — upar wali wajah. Par galti nigalte bhi nahi:
        wo poori jawab me jati hai, dukaan ke naam ke saath, taaki screen pe
        wahi likha ja sake jo sach me hua.
      */
      failed.push({
        shopId: membership.businessId,
        message: err?.message || 'Order nahi ja saka',
      });
    }
  }

  // Naam bharne ke liye — screen pe "Bada Traders ka order chala gaya" likhna hai
  const ids = [...placed, ...failed].map((x) => x.shopId).filter(Boolean);
  const businesses = await Business.find({ _id: { $in: ids } }).select('name').lean();
  const nameOf = new Map(businesses.map((b) => [String(b._id), b.name]));

  for (const row of placed) row.shopName = nameOf.get(String(row.shopId)) || '';
  for (const row of failed) row.shopName = nameOf.get(String(row.shopId)) || row.shopName || '';

  if (!placed.length) {
    // Ek bhi nahi gaya — ye sach me galti hai, isliye error hi bhejte hain
    throw ApiError.badRequest(
      failed[0]?.message || 'Koi order nahi ja saka',
      failed.map((f) => ({ field: String(f.shopId || ''), message: f.message })),
    );
  }

  return { placed, failed };
}

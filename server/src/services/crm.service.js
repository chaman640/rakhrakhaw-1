import mongoose from 'mongoose';
import { Party } from '../models/index.js';
import { PARTY_TYPES, PARTY_STATUS, ORDER_STATUS } from '../config/constants.js';
import { scopePartiesMatch } from '../utils/scope.js';

const DAY = 24 * 60 * 60 * 1000;

/*
  TEEN GHANTI (Part 46) — inke beech ki lakeer yahin tay hoti hai. Number
  "sahi" nahi hain, kisi ek dhande ke hisaab se bhi nahi — ye ek shuruaat hai,
  jo dukaandaar apne experience se aage badal sakta hai (settings me nahi
  rakha abhi, taaki pehli baar seedha kaam kare).

    0–15 din pehle order   -> chup, kuch nahi kehna (ACTIVE)
    16–45 din pehle order  -> FOLLOW-UP — "pooch lo kaisa hai"
    45+ din, ya kabhi nahi -> DEAD — par naye jude retailer ko itni jaldi
                              "dead" mat kaho, 14 din ki mohlat do (NEW_GRACE)
*/
const FOLLOWUP_AFTER_DAYS = 15;
const DEAD_AFTER_DAYS = 45;
const NEW_GRACE_DAYS = 14;

/**
 * CRM — "kaun abhi dekh raha hai, kaun chup ho gaya, kaun gaya hi gaya."
 *
 * CART SABSE UPAR JEETTA HAI. Agar koi purana "dead" retailer abhi cart mein
 * maal daal raha hai, wo LEAD me dikhega — DEAD me nahi. Wahi sabse zaroori
 * khabar hai: koi wapas aa raha hai, aur usi waqt dobara jud jaana chahiye,
 * "dead" ka theppa dekh kar chhod nahi dena chahiye.
 *
 * Ek hi aggregation — Party se Order aur Cart dono `$lookup` se, taaki 40
 * retailer ke liye 80 alag-alag query na chalani padein.
 */
export async function getCrmOverview(businessId, viewer = null) {
  const bid = new mongoose.Types.ObjectId(String(businessId));

  const match = scopePartiesMatch(
    { businessId: bid, type: PARTY_TYPES.RETAILER, isActive: true, status: { $ne: PARTY_STATUS.BLOCKED } },
    viewer,
  );

  const rows = await Party.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'orders',
        let: { pid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$partyId', '$$pid'] },
                  { $eq: ['$businessId', bid] },
                  { $ne: ['$status', ORDER_STATUS.CANCELLED] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              lastOrderAt: { $max: '$createdAt' },
              lifetimeValue: { $sum: '$itemsTotal' },
            },
          },
        ],
        as: 'orderStats',
      },
    },
    {
      $lookup: {
        from: 'carts',
        let: { pid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$partyId', '$$pid'] } } },
          {
            $project: {
              itemCount: { $size: '$items' },
              cartValue: {
                $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.qty', '$$i.addedRate'] } } },
              },
              lastTouchedAt: { $max: '$items.addedAt' },
            },
          },
        ],
        as: 'cartStats',
      },
    },
    {
      $project: {
        name: 1, shopName: 1, phone: 1, balance: 1, createdAt: 1,
        orderStats: { $arrayElemAt: ['$orderStats', 0] },
        cartStats: { $arrayElemAt: ['$cartStats', 0] },
      },
    },
  ]);

  const now = Date.now();
  const leads = [];
  const followUp = [];
  const dead = [];
  const fresh = [];   // naye jude, na order na cart — na "dead", na "follow-up"
  let activeCount = 0;

  for (const r of rows) {
    const cartItemCount = r.cartStats?.itemCount || 0;
    const hasCart = cartItemCount > 0;
    const totalOrders = r.orderStats?.count || 0;
    const lastOrderAt = r.orderStats?.lastOrderAt || null;
    const daysSinceOrder = lastOrderAt ? Math.floor((now - new Date(lastOrderAt).getTime()) / DAY) : null;
    const daysSinceJoined = Math.floor((now - new Date(r.createdAt).getTime()) / DAY);

    const base = {
      partyId: r._id,
      name: r.name,
      shopName: r.shopName || '',
      phone: r.phone || '',
      balance: Math.round((r.balance || 0) * 100) / 100,
      totalOrders,
      lifetimeValue: Math.round((r.orderStats?.lifetimeValue || 0) * 100) / 100,
      lastOrderAt,
      daysSinceOrder,
    };

    if (hasCart) {
      leads.push({
        ...base,
        cartItemCount,
        cartValue: Math.round((r.cartStats?.cartValue || 0) * 100) / 100,
        cartTouchedAt: r.cartStats?.lastTouchedAt || null,
        isReturning: totalOrders > 0, // purana graahak wapas aa raha hai, ya bilkul naya lead
      });
      continue;
    }

    if (totalOrders === 0) {
      if (daysSinceJoined >= NEW_GRACE_DAYS) dead.push({ ...base, neverOrdered: true });
      else fresh.push(base);
      continue;
    }

    if (daysSinceOrder <= FOLLOWUP_AFTER_DAYS) activeCount += 1;
    else if (daysSinceOrder <= DEAD_AFTER_DAYS) followUp.push(base);
    else dead.push({ ...base, neverOrdered: false });
  }

  // Sabse zaroori pehle: leads me abhi-abhi cart chhua hua sabse upar;
  // follow-up me jiska order sabse jaldi wapas mangwana hai wo upar;
  // dead me sabse purana (sabse zyada nuksan wala) sabse upar.
  leads.sort((a, b) => new Date(b.cartTouchedAt || 0) - new Date(a.cartTouchedAt || 0));
  followUp.sort((a, b) => (a.daysSinceOrder ?? 9999) - (b.daysSinceOrder ?? 9999));
  dead.sort((a, b) => (b.daysSinceOrder ?? 99999) - (a.daysSinceOrder ?? 99999));

  return {
    leads,
    followUp,
    dead,
    fresh,
    summary: {
      totalRetailers: rows.length,
      leadsCount: leads.length,
      followUpCount: followUp.length,
      deadCount: dead.length,
      freshCount: fresh.length,
      activeCount,
      // "Dead" hue retailer se kabhi kitna business tha — dikhata hai daanv pe kitna laga hai
      deadLifetimeValue: Math.round(dead.reduce((s, r) => s + r.lifetimeValue, 0)),
    },
  };
}

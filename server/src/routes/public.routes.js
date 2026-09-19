import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import ApiError from '../utils/ApiError.js';
import { Business, Item } from '../models/index.js';
import * as catalog from '../services/catalog.service.js';

/*
  BINA LOGIN KE DUKAAN DEKHNA.

  Pehle catalog dekhne ke liye bhi account banana padta tha. Wo sabse badi
  rukawat thi: naya retailer ye jaan hi nahi paata tha ki dukaan me hai kya,
  aur bina jaane account koi nahi banata.

  Ab dekhna khula hai, aur account tab maanga jata hai jab wo SACH ME kuch
  lena chahe — us pal tak use pata hota hai ki kya mil raha hai.

  Yahan KHAAS RATE NAHI dikhta — wo har retailer ka apna hota hai aur login ke
  baad hi banta hai. Guest ko sirf aam bikri ka daam dikhta hai.
*/
const router = Router();

const shopFields = 'name logoUrl address.city address.state phone gstEnabled inviteCode';

router.get('/shop/:code', asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const biz = await Business.findOne({ inviteCode: code, inviteEnabled: true })
    .select(shopFields).lean();
  if (!biz) throw ApiError.notFound('Ye dukaan nahi mili');

  return ok(res, {
    _id: biz._id,
    name: biz.name,
    logoUrl: biz.logoUrl || '',
    city: biz.address?.city || '',
    state: biz.address?.state || '',
    inviteCode: biz.inviteCode,
  });
}));

router.get('/shop/:code/items', asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const biz = await Business.findOne({ inviteCode: code, inviteEnabled: true })
    .select('_id').lean();
  if (!biz) throw ApiError.notFound('Ye dukaan nahi mili');

  const q = String(req.query.q || '').trim().slice(0, 60);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 24;

  const filter = { businessId: biz._id, isActive: true, visibleToRetailers: true };
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { sku: { $regex: safe, $options: 'i' } },
      { brand: { $regex: safe, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Item.find(filter)
      .select('name imageUrl unit salePrice mrp stock brand category minOrderQty')
      .sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Item.countDocuments(filter),
  ]);

  return ok(res, {
    items: items.map((i) => ({
      _id: i._id,
      name: i.name,
      imageUrl: i.imageUrl || '',
      unit: i.unit,
      rate: i.salePrice,
      mrp: i.mrp || 0,
      brand: i.brand || '',
      inStock: (i.stock || 0) > 0,
      minOrderQty: i.minOrderQty || 1,
    })),
    total,
    page,
    hasMore: page * limit < total,
  });
}));

/**
 * BINA LOGIN KE — EK item ka poora detail (Part 55).
 *
 * Retailer ko URL bheja jaaye to poori tarah wahi Instagram-jaisa product
 * page khulta hai jo login karke dikhta — reel, swipe, zoom, sab kuch —
 * bas "Add to Cart" ki jagah "Order karein" (jo signup/login pe le jaata
 * hai). Isi wajah se ye `getCatalogItem` KO HI dobara istemal karta hai,
 * naya likhne ke bajaye — `partyId` seedha `null` bhej dete hain, jisse
 * `resolveRates` khud-ba-khud kisi retailer ka khaas rate kabhi nahi
 * dhoondta, hamesha aam bikri ka daam (`salePrice`) milta hai. Ek hi jagah
 * se dono (logged-in aur guest) ka jawab aata hai — kabhi alag-alag ho hi
 * nahi sakta.
 */
router.get('/shop/:code/item/:itemId', asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const biz = await Business.findOne({ inviteCode: code, inviteEnabled: true })
    .select('_id').lean();
  if (!biz) throw ApiError.notFound('Ye dukaan nahi mili');

  const item = await catalog.getCatalogItem(biz._id, null, req.params.itemId);
  return ok(res, item);
}));

export default router;

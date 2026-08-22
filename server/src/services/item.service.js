import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { STOCK_MOVEMENT_TYPES, UNITS } from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { saveImage, deleteImage } from '../utils/storage.js';
import { parseCsvToObjects, toCsv } from '../utils/csv.js';
import { Item, Category, StockMovement, PartyItemRate, Invoice, Purchase, ReturnNote } from '../models/index.js';
import { applyStockChange, setStock } from './stock.service.js';
import { khepBanao, khepValueMap } from './lot.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ list */

export async function listItems(businessId, q) {
  const filter = { businessId };

  if (q.status === 'active') filter.isActive = true;
  else if (q.status === 'inactive') filter.isActive = false;

  if (q.categoryId === 'none') filter.categoryId = null;
  else if (q.categoryId) filter.categoryId = q.categoryId;

  if (q.brand) filter.brand = q.brand;

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { hsn: rx }, { brand: rx }, { modelNo: rx }, { barcode: rx }];
  }

  // Stock filter — low ka matlab "lowStockAt se kam ya barabar, par khatam nahi"
  if (q.stock === 'out') filter.stockQty = { $lte: 0 };
  else if (q.stock === 'in') filter.stockQty = { $gt: 0 };
  else if (q.stock === 'low') {
    filter.$expr = { $and: [{ $lte: ['$stockQty', '$lowStockAt'] }, { $gt: ['$stockQty', 0] }] };
  }

  /*
    Expiry ki chhalni.

    "Soon" ka matlab AGLE 30 DIN — aur usme wo bhi aate hain jo expire ho chuke
    hain. Wajah seedhi hai: dukaandaar ye list "kya nikalna hai" dekhne ke liye
    kholta hai, aur jo kal expire hua wo bhi wahi kaam hai. Alag alag dikhana
    ho to "Expire ho chuka" wali chhalni alag se hai.

    Jinki expiry likhi hi nahi (`null`) wo kabhi nahi aate — na "soon" me, na
    "gone" me. Khali khaana "expire nahi hua" hai, "pata nahi" nahi.
  */
  if (q.expiry === 'soon') {
    const tak = new Date();
    tak.setDate(tak.getDate() + 30);
    filter.expiryDate = { $ne: null, $lte: tak };
  } else if (q.expiry === 'gone') {
    filter.expiryDate = { $ne: null, $lt: new Date() };
  }

  const skip = (q.page - 1) * q.limit;

  const [items, total] = await Promise.all([
    Item.find(filter)
      .sort(q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 })
      .skip(skip)
      .limit(q.limit)
      .populate('categoryId', 'name')
      .lean(),
    Item.countDocuments(filter),
  ]);

  return {
    items: items.map(decorate),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

// isLowStock virtual lean() ke saath hamesha nahi aata — yahan pakka kar dete hain
function decorate(item) {
  const stockQty = Number(item.stockQty || 0);
  const lowStockAt = Number(item.lowStockAt || 0);
  return {
    ...item,
    // categoryId populate hoke aata hai -> { _id, name }
    category: item.categoryId?.name || null,
    categoryId: item.categoryId?.name ? item.categoryId._id : (item.categoryId || null),
    isLowStock: stockQty > 0 && stockQty <= lowStockAt,
    isOutOfStock: stockQty <= 0,
    // .lean() virtuals skip kar deta hai, isliye yahan dobara banana padta hai
    warrantyText: warrantyTextOf(item.warrantyMonths),
    stockValue: round2(stockQty * Number(item.purchasePrice || 0)),
    margin: marginOf(item),
  };
}

/** 18 -> "1 saal 6 mahine" */
function warrantyTextOf(months) {
  const m = Number(months || 0);
  if (!m) return '';
  const years = Math.floor(m / 12);
  const rest = m % 12;
  return [years && `${years} saal`, rest && `${rest} mahine`].filter(Boolean).join(' ');
}

function marginOf(item) {
  const cost = Number(item.purchasePrice || 0);
  const sale = Number(item.wholesalePrice || item.salePrice || 0);
  if (!cost || !sale) return null;
  return { amount: round2(sale - cost), percent: round2(((sale - cost) / cost) * 100) };
}

/* ----------------------------------------------------------------- stats */

/** Jo brand asli me use ho rahe hain unki list — dropdown ke liye */
export async function listBrands(businessId) {
  const brands = await Item.distinct('brand', { businessId, isActive: true, brand: { $ne: '' } });
  return brands.sort((a, b) => a.localeCompare(b));
}

export async function getStats(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const [agg] = await Item.aggregate([
    { $match: { businessId: bid, isActive: true } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        stockValue: { $sum: { $multiply: ['$stockQty', '$purchasePrice'] } },
        outOfStock: { $sum: { $cond: [{ $lte: ['$stockQty', 0] }, 1, 0] } },
        lowStock: {
          $sum: {
            $cond: [
              { $and: [{ $lte: ['$stockQty', '$lowStockAt'] }, { $gt: ['$stockQty', 0] }] },
              1, 0,
            ],
          },
        },
      },
    },
  ]);

  /*
    STOCK KI KEEMAT ab KHEP se aati hai, `stockQty × purchasePrice` se nahi.

    Purana tarika ab seedha jhooth bol raha hota: `purchasePrice` aaj ka rate
    hai, aur godown me pada aadha maal purane sasta rate ka ho sakta hai. 100
    bolt me se 40 ₹80 wale aur 60 ₹100 wale — purana hisaab 100 × ₹100 =
    ₹10,000 dikhata, sach ₹9,200 hai.

    Jinki koi khep hai hi nahi (is feature se pehle ka maal) unke liye purana
    tarika hi rehta hai — usse behtar kuch hai nahi, aur unhe chhod dena poori
    keemat ko aur galat kar deta.
  */
  const [lotMap, bina] = await Promise.all([
    khepValueMap(businessId),
    Item.find({ businessId, isActive: true }).select('stockQty purchasePrice').lean(),
  ]);

  let stockValue = 0;
  for (const it of bina) {
    const lot = lotMap[String(it._id)];
    stockValue = round2(stockValue + (lot ? lot.value : (it.stockQty || 0) * (it.purchasePrice || 0)));
  }

  // Agle 30 din me expire hone wale (aur jo ho chuke) — ek hi ginti, kyunki
  // dono ka kaam ek hi hai: aaj shelf se nikalna
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const expiringSoon = await Item.countDocuments({
    businessId, isActive: true, expiryDate: { $ne: null, $lte: soon },
  });

  return {
    totalItems: agg?.totalItems || 0,
    stockValue,
    lowStock: agg?.lowStock || 0,
    outOfStock: agg?.outOfStock || 0,
    expiringSoon,
  };
}

/**
 * "GST ON karne se pehle kitna kaam baaki hai" — ek seedha jawab.
 *
 * Ye chetavni na hone se ek chup-chaap nuksaan hota tha. GST ON karte hi bill
 * ka naam "TAX INVOICE" ho jata hai, par jin item pe rate 0 hai unpe tax lagta
 * hi nahi. Bill dekhne me poora sahi lagta hai — bas usme tax hai hi nahi.
 * Ye mahino chalta rehta hai aur pakda tab jata hai jab CA return bharne
 * baithta hai, aur tab tak wo bill graahak ke paas ja chuke hote hain.
 *
 * HSN alag baat hai: uske bina bhi bill banta hai, par GST return me wo
 * maanga jata hai. Isliye dono ginte hain, aur naam bhi bata dete hain —
 * "12 item me rate nahi hai" se aage badhne ka rasta nahi milta.
 */
export async function gstReadiness(businessId) {
  const items = await Item.find({ businessId, isActive: true })
    .select('name gstRate hsn').lean();

  const zero = items.filter((i) => !(Number(i.gstRate) > 0));
  const noHsn = items.filter((i) => !String(i.hsn || '').trim());

  return {
    total: items.length,
    zeroRate: zero.length,
    noHsn: noHsn.length,
    ready: zero.length === 0 && noHsn.length === 0,
    // Pehle paanch naam — poori list ka koi fayda nahi, aur wo bhaari bhi hai
    samples: [...new Set([...zero, ...noHsn].map((i) => String(i._id)))]
      .slice(0, 5)
      .map((id) => {
        const it = items.find((x) => String(x._id) === id);
        return {
          _id: it._id,
          name: it.name,
          kya: !(Number(it.gstRate) > 0) ? 'rate nahi hai' : 'HSN nahi hai',
        };
      }),
  };
}

export async function getLowStockItems(businessId, limit = 20) {
  return Item.find({
    businessId,
    isActive: true,
    $expr: { $lte: ['$stockQty', '$lowStockAt'] },
  })
    .sort({ stockQty: 1 })
    .limit(limit)
    .select('name unit stockQty lowStockAt imageUrl')
    .lean();
}

/* ------------------------------------------------------------------ CRUD */

export async function getItem(businessId, id) {
  const item = await Item.findOne({ _id: id, businessId }).populate('categoryId', 'name').lean();
  if (!item) throw ApiError.notFound('Item nahi mila');

  const movements = await StockMovement.find({ businessId, itemId: id })
    .sort({ createdAt: -1 }).limit(20).lean();

  return { ...decorate(item), movements };
}

async function assertUniqueName(businessId, name, excludeId = null) {
  const query = { businessId, name: new RegExp(`^${escapeRegex(name)}$`, 'i'), isActive: true };
  if (excludeId) query._id = { $ne: excludeId };
  if (await Item.exists(query)) throw ApiError.conflict(`"${name}" naam ka item pehle se hai`);
}

async function assertCategoryBelongs(businessId, categoryId) {
  if (!categoryId) return null;
  const exists = await Category.exists({ _id: categoryId, businessId });
  if (!exists) throw ApiError.badRequest('Ye category aapki nahi hai');
  return categoryId;
}

export async function createItem(businessId, payload, userId) {
  await assertUniqueName(businessId, payload.name);
  const categoryId = await assertCategoryBelongs(businessId, payload.categoryId || null);

  const openingStock = Number(payload.openingStock || 0);

  const item = await Item.create({
    ...payload,
    categoryId,
    businessId,
    openingStock,
    stockQty: openingStock,
  });

  // Opening stock bhi audit trail me aata hai
  if (openingStock !== 0) {
    await StockMovement.create({
      businessId,
      itemId: item._id,
      type: STOCK_MOVEMENT_TYPES.OPENING,
      qty: openingStock,
      balanceAfter: openingStock,
      note: 'Opening stock',
      createdBy: userId,
    });

    /*
      Pehle din ka maal bhi ek KHEP hai.

      Iske bina FIFO ka pehla din hi khali hota: jo maal app shuru karte waqt
      dukaan me pada tha uski koi lagat kahin darj hi na hoti, aur uske bikne
      par lagat andaze se aati. Jo rate dukaandaar ne item banate waqt likha,
      wahi is khep ki lagat hai — usse behtar sach hai bhi nahi.
    */
    await khepBanao({
      businessId,
      itemId: item._id,
      qty: openingStock,
      unitCost: Number(payload.purchasePrice || 0),
      source: 'OPENING',
      refType: 'Item',
      refId: item._id,
      refNo: 'Opening stock',
      userId,
    });
  }

  return getItem(businessId, item._id);
}

export async function updateItem(businessId, id, payload, userId) {
  if (payload.name) await assertUniqueName(businessId, payload.name, id);
  if (payload.categoryId !== undefined) {
    payload.categoryId = payload.categoryId ? await assertCategoryBelongs(businessId, payload.categoryId) : null;
  }

  // stockQty yahan se kabhi nahi badalta — uske liye alag endpoint hai
  delete payload.stockQty;
  delete payload.openingStock;

  const item = await Item.findOneAndUpdate({ _id: id, businessId }, payload, { new: true, runValidators: true });
  if (!item) throw ApiError.notFound('Item nahi mila');

  return getItem(businessId, id);
}

/**
 * Delete — agar item kabhi kisi purchase/invoice me use hua hai to sirf
 * deactivate hota hai (purane bill kharab na ho jayein), warna poora hat jata hai.
 */
export async function deleteItem(businessId, id) {
  const item = await Item.findOne({ _id: id, businessId });
  if (!item) throw ApiError.notFound('Item nahi mila');

  // Seedha document dekho, stock movement nahi.
  //
  // Pehle yahan PURCHASE/SALE movement dhoonda jata tha. Wo asli sawal ka
  // ulta jawab hai — sawal ye hai ki "kya ye item kisi purane bill me hai",
  // aur delete ki hui purchase ka movement bhi ab (theek se) bacha rehta hai.
  // Document se poochhne pe jawab hamesha sahi milta hai.
  const [inInvoice, inPurchase, inReturn] = await Promise.all([
    Invoice.exists({ businessId, 'items.itemId': id }),
    Purchase.exists({ businessId, 'items.itemId': id }),
    ReturnNote.exists({ businessId, 'items.itemId': id }),
  ]);

  if (inInvoice || inPurchase || inReturn) {
    item.isActive = false;
    item.visibleToRetailers = false;
    await item.save();
    return { deleted: false, deactivated: true, message: `${item.name} purane bill me hai, isliye hide kar diya` };
  }

  if (item.imagePublicId) await deleteImage(item.imagePublicId);
  await StockMovement.deleteMany({ businessId, itemId: id });
  await PartyItemRate.deleteMany({ businessId, itemId: id });
  await item.deleteOne();

  return { deleted: true, deactivated: false, message: `${item.name} delete ho gaya` };
}

/* ----------------------------------------------------------------- photo */

export async function setPhoto(businessId, id, file) {
  if (!file) throw ApiError.badRequest('Koi image nahi mili');

  const item = await Item.findOne({ _id: id, businessId });
  if (!item) throw ApiError.notFound('Item nahi mila');

  const { url, publicId } = await saveImage(file, 'items');
  if (item.imagePublicId) await deleteImage(item.imagePublicId);

  item.imageUrl = url;
  item.imagePublicId = publicId;
  await item.save();

  return { imageUrl: url };
}

export async function removePhoto(businessId, id) {
  const item = await Item.findOne({ _id: id, businessId });
  if (!item) throw ApiError.notFound('Item nahi mila');

  if (item.imagePublicId) await deleteImage(item.imagePublicId);
  item.imageUrl = '';
  item.imagePublicId = '';
  await item.save();
  return { imageUrl: '' };
}

/* ----------------------------------------------------------------- stock */

export async function adjustStock(businessId, id, { mode, qty, note, type }, userId) {
  if (mode === 'set') {
    await setStock({ businessId, itemId: id, newQty: qty, note, userId });
  } else {
    const signed = mode === 'add' ? Math.abs(qty) : -Math.abs(qty);
    if (signed === 0) throw ApiError.badRequest('Quantity 0 nahi ho sakti');
    await applyStockChange({
      businessId, itemId: id, type: type || STOCK_MOVEMENT_TYPES.ADJUSTMENT,
      qty: signed, note, userId,
      allowNegative: false,
    });
  }
  return getItem(businessId, id);
}

/* ------------------------------------------------------------------ bulk */

export async function bulkAction(businessId, { ids, action, categoryId }) {
  const filter = { businessId, _id: { $in: ids } };

  switch (action) {
    case 'activate':
      await Item.updateMany(filter, { isActive: true });
      return { message: `${ids.length} item wapas chalu kar diye` };

    case 'deactivate':
      await Item.updateMany(filter, { isActive: false, visibleToRetailers: false });
      return { message: `${ids.length} item hide kar diye` };

    case 'showToRetailers':
      await Item.updateMany(filter, { visibleToRetailers: true });
      return { message: `${ids.length} item retailers ko dikhne lage` };

    case 'hideFromRetailers':
      await Item.updateMany(filter, { visibleToRetailers: false });
      return { message: `${ids.length} item retailers se chhupa diye` };

    case 'setCategory': {
      const cid = categoryId ? await assertCategoryBelongs(businessId, categoryId) : null;
      await Item.updateMany(filter, { categoryId: cid });
      return { message: `${ids.length} item ki category badal di` };
    }

    case 'delete': {
      let removed = 0, hidden = 0;
      for (const id of ids) {
        const res = await deleteItem(businessId, id).catch(() => null);
        if (res?.deleted) removed++;
        else if (res?.deactivated) hidden++;
      }
      return { message: `${removed} delete, ${hidden} hide (purane bill me the)` };
    }

    default:
      throw ApiError.badRequest('Ye action nahi ho sakta');
  }
}

/* ---------------------------------------------------------------- export */

export const CSV_HEADERS = [
  'name', 'sku', 'brand', 'modelNo', 'barcode', 'category', 'unit',
  'purchasePrice', 'salePrice', 'wholesalePrice', 'mrp',
  'stockQty', 'lowStockAt', 'hsn', 'gstRate',
  'warrantyMonths', 'warrantyNote', 'rack', 'minOrderQty',
];

export async function exportCsv(businessId) {
  const items = await Item.find({ businessId, isActive: true })
    .sort({ name: 1 }).populate('categoryId', 'name').lean();

  const rows = items.map((i) => ({
    name: i.name,
    sku: i.sku || '',
    brand: i.brand || '',
    modelNo: i.modelNo || '',
    barcode: i.barcode || '',
    category: i.categoryId?.name || '',
    unit: i.unit,
    purchasePrice: i.purchasePrice,
    salePrice: i.salePrice,
    wholesalePrice: i.wholesalePrice,
    mrp: i.mrp || 0,
    stockQty: i.stockQty,
    lowStockAt: i.lowStockAt,
    hsn: i.hsn || '',
    gstRate: i.gstRate,
    warrantyMonths: i.warrantyMonths || 0,
    warrantyNote: i.warrantyNote || '',
    rack: i.rack || '',
    minOrderQty: i.minOrderQty || 0,
  }));

  return { csv: toCsv(CSV_HEADERS, rows), count: rows.length };
}

export function sampleCsv() {
  return toCsv(CSV_HEADERS, [
    { name: 'Bearing 6203', sku: 'BRG-6203', brand: 'SKF', modelNo: '6203-2RS', barcode: '8901234567890',
      category: 'Bearings', unit: 'PCS', purchasePrice: 85, salePrice: 120, wholesalePrice: 105, mrp: 140,
      stockQty: 50, lowStockAt: 10, hsn: '8482', gstRate: 18,
      warrantyMonths: 6, warrantyNote: 'Company warranty, bill ke saath', rack: 'A-3', minOrderQty: 0 },
    { name: 'Chain 428H', sku: 'CHN-428', brand: 'Rolon', modelNo: '428H-118L', barcode: '',
      category: 'Chains', unit: 'PCS', purchasePrice: 320, salePrice: 450, wholesalePrice: 400, mrp: 520,
      stockQty: 24, lowStockAt: 5, hsn: '7315', gstRate: 18,
      warrantyMonths: 12, warrantyNote: '', rack: 'B-1', minOrderQty: 2 },
  ]);
}

/* ---------------------------------------------------------------- import */

/**
 * Do step: pehle commit=false se preview (kuch save nahi hota),
 * user dekh le, phir commit=true se asli import.
 */
export async function importCsv(businessId, { csv, commit }, userId) {
  const { headers, records } = parseCsvToObjects(csv);

  if (!headers.includes('name')) {
    throw ApiError.badRequest('CSV me "name" column hona zaroori hai. Sample file download karke dekh lein.');
  }
  if (!records.length) throw ApiError.badRequest('CSV me koi row nahi mili');
  if (records.length > 2000) throw ApiError.badRequest('Ek baar me 2000 se zyada item nahi ho sakte');

  const [existingItems, existingCategories] = await Promise.all([
    Item.find({ businessId }).select('name sku').lean(),
    Category.find({ businessId }).select('name').lean(),
  ]);

  const itemByName = new Map(existingItems.map((i) => [i.name.toLowerCase(), i]));
  const categoryByName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c]));

  const seenInFile = new Set();
  const rows = [];

  for (const rec of records) {
    const errors = [];
    const name = (rec.name || '').trim();

    if (!name) errors.push('Naam khali hai');
    else if (name.length > 120) errors.push('Naam bahut lamba hai');

    const key = name.toLowerCase();
    if (key && seenInFile.has(key)) errors.push('Isi file me ye naam do baar hai');
    seenInFile.add(key);

    const unit = (rec.unit || 'PCS').toUpperCase();
    if (!UNITS.includes(unit)) errors.push(`Unit "${rec.unit}" galat hai (${UNITS.slice(0, 6).join('/')}...)`);

    const nums = {};
    for (const [field, label] of [
      ['purchasePrice', 'Purchase price'], ['salePrice', 'Sale price'],
      ['wholesalePrice', 'Wholesale price'], ['stockQty', 'Stock'],
      ['lowStockAt', 'Low stock'], ['gstRate', 'GST rate'],
      ['mrp', 'MRP'], ['warrantyMonths', 'Warranty months'], ['minOrderQty', 'Min order qty'],
    ]) {
      const raw = rec[field];
      if (raw === undefined || raw === '') { nums[field] = field === 'lowStockAt' ? 5 : 0; continue; }
      const n = Number(String(raw).replace(/[₹,\s]/g, ''));
      if (Number.isNaN(n)) errors.push(`${label} number nahi hai: "${raw}"`);
      else if (n < 0) errors.push(`${label} negative nahi ho sakta`);
      else nums[field] = n;
    }
    if (nums.gstRate > 28) errors.push('GST rate 28 se zyada nahi ho sakta');

    const existing = itemByName.get(key);

    rows.push({
      line: rec.__line,
      name,
      sku: (rec.sku || '').trim(),
      brand: (rec.brand || '').trim(),
      modelNo: (rec.modelNo || '').trim(),
      barcode: (rec.barcode || '').trim(),
      categoryName: (rec.category || '').trim(),
      unit,
      hsn: (rec.hsn || '').trim(),
      warrantyNote: (rec.warrantyNote || '').trim(),
      rack: (rec.rack || '').trim(),
      ...nums,
      action: existing ? 'update' : 'create',
      existingId: existing?._id || null,
      errors,
    });
  }

  const valid = rows.filter((r) => !r.errors.length);
  const invalid = rows.filter((r) => r.errors.length);

  const newCategories = [...new Set(
    valid.map((r) => r.categoryName).filter((c) => c && !categoryByName.has(c.toLowerCase()))
  )];

  const summary = {
    total: rows.length,
    willCreate: valid.filter((r) => r.action === 'create').length,
    willUpdate: valid.filter((r) => r.action === 'update').length,
    withErrors: invalid.length,
    newCategories,
  };

  if (!commit) {
    return { preview: true, summary, rows: rows.slice(0, 200), truncated: rows.length > 200 };
  }

  if (!valid.length) throw ApiError.badRequest('Ek bhi sahi row nahi mili — errors theek karke dobara try karein');

  // Nayi categories pehle bana lo
  for (const catName of newCategories) {
    const created = await Category.create({ businessId, name: catName });
    categoryByName.set(catName.toLowerCase(), created);
  }

  let created = 0, updated = 0;

  for (const row of valid) {
    const categoryId = row.categoryName ? categoryByName.get(row.categoryName.toLowerCase())?._id || null : null;

    const common = {
      sku: row.sku,
      brand: row.brand,
      modelNo: row.modelNo,
      barcode: row.barcode,
      categoryId,
      unit: row.unit,
      purchasePrice: row.purchasePrice,
      salePrice: row.salePrice,
      wholesalePrice: row.wholesalePrice,
      mrp: row.mrp,
      lowStockAt: row.lowStockAt,
      hsn: row.hsn,
      gstRate: row.gstRate,
      warrantyMonths: row.warrantyMonths,
      warrantyNote: row.warrantyNote,
      rack: row.rack,
      minOrderQty: row.minOrderQty,
    };

    if (row.action === 'update') {
      await Item.updateOne({ _id: row.existingId, businessId }, common);
      // Stock CSV se aaya hai to use adjustment ki tarah record karo
      const item = await Item.findById(row.existingId).select('stockQty').lean();
      if (item && Number(row.stockQty) !== Number(item.stockQty)) {
        await setStock({ businessId, itemId: row.existingId, newQty: row.stockQty, note: 'CSV import', userId });
      }
      updated++;
    } else {
      const item = await Item.create({
        businessId, name: row.name, ...common,
        openingStock: row.stockQty, stockQty: row.stockQty,
      });
      if (row.stockQty) {
        await StockMovement.create({
          businessId, itemId: item._id, type: STOCK_MOVEMENT_TYPES.OPENING,
          qty: row.stockQty, balanceAfter: row.stockQty, note: 'CSV import', createdBy: userId,
        });
      }
      created++;
    }
  }

  return {
    preview: false,
    summary: { ...summary, created, updated, skipped: invalid.length },
    rows: invalid.slice(0, 100),
  };
}

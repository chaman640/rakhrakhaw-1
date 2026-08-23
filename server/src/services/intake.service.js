import ApiError from '../utils/ApiError.js';
import { round2 } from '../utils/money.js';
import {
  PARTY_TYPES, PARTY_STATUS, NOTIFICATION_TYPES,
} from '../config/constants.js';
import {
  Business, Item, Membership, Party, StockIntake,
} from '../models/index.js';
import { notifyWholesaler } from './notification.service.js';
import { createPurchase } from './purchase.service.js';
import { createItem } from './item.service.js';

/**
 * KHAREEDA HUA MAAL APNI DUKAAN ME — ka poora kaam.
 *
 * Kahani ek line me: bada wholesaler bill banata hai → kharidne wale ke yahan
 * ye kaam apne aap ban jata hai → wo ek ek item pe "Add karke aage" dabata hai
 * aur bechne ka rate daalta hai → aakhir me wahi purana `createPurchase()`
 * chalta hai.
 *
 * Aakhri kadam sabse zaroori hai. Stock yahan se NAHI badhta — Purchase se
 * badhta hai. Wajah StockIntake.js me poori likhi hai, par saar itna: stock ke
 * saath khep (FIFO ki lagat), supplier ka khata, GST ka input credit aur
 * purchase ka number — sab ek saath banne chahiye, aur wo hisaab pehle se ek hi
 * jagah likha hai. Use dobara likhne ka matlab hota do jagah do sach.
 */

/* ═══════════════════ 1. bill bante hi kaam ban jaye ═══════════════════ */

/**
 * Bechne wala jise bill de raha hai, uski apni dukaan hai kya?
 *
 * Aam retailer ki apni dukaan hoti hi nahi — uske paas stock, khep aur khata
 * jaisa kuch hai hi nahi, isliye uske liye ye kaam banana bekaar hai (aur
 * uske paas use karne ka koi page bhi nahi). Ye kaam sirf tab banta hai jab
 * kharidaar khud ek DUKAAN ho — yaani buy mode wala wholesaler.
 */
async function buyerBusinessOf(sellerBusinessId, partyId) {
  const membership = await Membership.findOne({
    businessId: sellerBusinessId, partyId,
  }).select('buyerBusinessId').lean();
  return membership?.buyerBusinessId || null;
}

/**
 * Bechne wale ko kharidne wali dukaan me SUPPLIER bana do.
 *
 * Khata isi pe banega. Party hamesha apne hi business ke andar banti hai —
 * doosre tenant ki Party udhaar le lena sabse aasan lagta hai aur usi se poora
 * multi-tenant bandobast toot jata hai.
 *
 * Pehle se ho to usi ko lete hain: nayi banane par uska purana khata doosri
 * party pe chhoot jata aur ek hi aadmi ka hisaab do jagah bat jata.
 */
async function findOrCreateSupplier(buyerBusinessId, seller) {
  const phone = (seller.phone || '').trim();

  let supplier = phone
    ? await Party.findOne({ businessId: buyerBusinessId, type: PARTY_TYPES.SUPPLIER, phone })
    : await Party.findOne({ businessId: buyerBusinessId, type: PARTY_TYPES.SUPPLIER, name: seller.name });

  if (supplier) return supplier;

  try {
    return await Party.create({
      businessId: buyerBusinessId,
      type: PARTY_TYPES.SUPPLIER,
      name: seller.name,
      shopName: seller.name,
      phone,
      gstin: seller.gstin || '',
      address: seller.address || {},
      status: PARTY_STATUS.ACTIVE,
    });
  } catch (err) {
    // Do bill ek saath aa gaye — jo pehle ban gayi wahi sahi hai
    if (err?.code === 11000 && phone) {
      const again = await Party.findOne({
        businessId: buyerBusinessId, type: PARTY_TYPES.SUPPLIER, phone,
      });
      if (again) return again;
    }
    throw err;
  }
}

/**
 * Bill se kaam banao. Bechne wale ki taraf se bulaya jata hai.
 *
 * Ye kabhi bill banna nahi rokta. Kharidne wale ke yahan kuch bhi gadbad ho
 * (dukaan band ho gayi, party na bane) to bill phir bhi banna chahiye — wo
 * bechne wale ka apna kaam hai aur usme kisi doosri dukaan ki dikkat aane ka
 * koi matlab nahi. Isliye bulane wala ise `try/catch` me rakhta hai aur yahan
 * bhi har galti chup-chaap log hoti hai.
 */
export async function createIntakeFromInvoice(sellerBusinessId, invoice, party, seller) {
  const buyerBusinessId = await buyerBusinessOf(sellerBusinessId, party._id);
  if (!buyerBusinessId) return null;                    // aam retailer — uska stock hai hi nahi
  if (String(buyerBusinessId) === String(sellerBusinessId)) return null;   // ho hi nahi sakta, par pakka kar lein

  const buyer = await Business.findById(buyerBusinessId).select('name isActive').lean();
  if (!buyer?.isActive) return null;

  const supplier = await findOrCreateSupplier(buyerBusinessId, seller);

  const lines = (invoice.items || []).map((l) => {
    const qty = Number(l.qty || 0);
    const taxable = round2(l.taxableValue || 0);
    const tax = round2((l.cgst || 0) + (l.sgst || 0) + (l.igst || 0));
    const total = round2(l.total || taxable + tax);
    return {
      sourceName: l.name,
      hsn: l.hsn || '',
      unit: l.unit || 'PCS',
      qty,
      rate: round2(l.rate || 0),
      discount: round2(l.discount || 0),
      taxableValue: taxable,
      gstRate: Number(l.gstRate || 0),
      taxAmount: tax,
      total,
      unitCostExTax: qty > 0 ? round2(taxable / qty) : 0,
      unitCostIncTax: qty > 0 ? round2(total / qty) : 0,
      status: 'PENDING',
    };
  });

  if (!lines.length) return null;

  let intake;
  try {
    intake = await StockIntake.create({
      businessId: buyerBusinessId,
      sellerBusinessId,
      sellerName: seller.name,
      supplierPartyId: supplier._id,
      sourceInvoiceId: invoice._id,
      sourceInvoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate || new Date(),
      taxableTotal: round2(invoice.taxableTotal || 0),
      taxTotal: round2(invoice.taxTotal || 0),
      grandTotal: round2(invoice.grandTotal || 0),
      gstEnabled: Boolean(invoice.gstEnabled),
      lines,
    });
  } catch (err) {
    // Wahi bill dobara — unique index ne roka, aur wahi theek hai (StockIntake.js me wajah)
    if (err?.code === 11000) {
      return StockIntake.findOne({ businessId: buyerBusinessId, sourceInvoiceId: invoice._id });
    }
    throw err;
  }

  await notifyWholesaler(buyerBusinessId, {
    type: NOTIFICATION_TYPES.STOCK_INTAKE,
    title: `${seller.name} ka maal aa gaya`,
    body: `${lines.length} item · ${invoice.invoiceNo} — apne stock me daal lijiye`,
    link: `/stock-intake/${intake._id}`,
    data: { intakeId: intake._id, invoiceNo: invoice.invoiceNo },
  });

  return intake;
}

/**
 * Bechne wale ne bill cancel kar diya.
 *
 * Kaam abhi baaki tha to use rok dete hain — us maal ka ab koi bill hi nahi
 * hai, use stock me daalna jhooth hoga.
 *
 * Kaam ho chuka ho to CHUP NAHI rehte, par apne aap kuch ULTA bhi nahi karte.
 * Ulta karna khatarnak hai: ho sakta hai wo maal bik bhi chuka ho, aur tab
 * uski khep zabardasti hatane se pichhle bill ka munafa hawa me latak jata.
 * Isliye sirf khabar jati hai aur faisla dukaandaar par chhodte hain — uske
 * paas purchase delete karne ka poora rasta pehle se hai.
 */
export async function cancelIntakeForInvoice(sellerBusinessId, invoiceId, reason = '') {
  const intake = await StockIntake.findOne({ sellerBusinessId, sourceInvoiceId: invoiceId });
  if (!intake) return null;

  if (intake.status === 'PENDING') {
    intake.status = 'CANCELLED';
    intake.cancelReason = reason || 'Bechne wale ne bill cancel kar diya';
    await intake.save();

    await notifyWholesaler(intake.businessId, {
      type: NOTIFICATION_TYPES.STOCK_INTAKE,
      title: `${intake.sellerName} ne bill cancel kar diya`,
      body: `${intake.sourceInvoiceNo} — wo maal ab stock me daalne ki zarurat nahi`,
      link: '/stock-intake',
      data: { intakeId: intake._id },
    });
    return intake;
  }

  if (intake.status === 'DONE') {
    await notifyWholesaler(intake.businessId, {
      type: NOTIFICATION_TYPES.STOCK_INTAKE,
      title: `${intake.sellerName} ne bill cancel kar diya`,
      body: `${intake.sourceInvoiceNo} ka maal aap stock me daal chuke hain — apni purchase dekh lijiye`,
      link: intake.purchaseId ? `/purchases/${intake.purchaseId}` : '/purchases',
      data: { intakeId: intake._id, purchaseId: intake.purchaseId },
    });
  }

  return intake;
}

/* ═══════════════════ 2. kharidne wale ki taraf ═══════════════════ */

const shape = (intake) => ({
  _id: intake._id,
  sellerName: intake.sellerName,
  sellerBusinessId: intake.sellerBusinessId,
  supplierPartyId: intake.supplierPartyId,
  sourceInvoiceNo: intake.sourceInvoiceNo,
  invoiceDate: intake.invoiceDate,
  taxableTotal: intake.taxableTotal,
  taxTotal: intake.taxTotal,
  grandTotal: intake.grandTotal,
  status: intake.status,
  cancelReason: intake.cancelReason,
  purchaseId: intake.purchaseId,
  lines: intake.lines,
  itemCount: intake.lines.length,
  pendingCount: intake.lines.filter((l) => l.status === 'PENDING').length,
  addedCount: intake.lines.filter((l) => l.status === 'ADDED').length,
  skippedCount: intake.lines.filter((l) => l.status === 'SKIPPED').length,
  createdAt: intake.createdAt,
  completedAt: intake.completedAt,
});

export async function listIntakes(businessId, { status = 'PENDING', page = 1, limit = 20 } = {}) {
  const filter = { businessId };
  if (status !== 'all') filter.status = status;

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    StockIntake.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StockIntake.countDocuments(filter),
  ]);

  return {
    rows: rows.map(shape),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Menu ke badge ke liye — "kitne kaam baaki hain" */
export async function pendingIntakeCount(businessId) {
  const count = await StockIntake.countDocuments({ businessId, status: 'PENDING' });
  return { count };
}

export async function getIntake(businessId, id) {
  const intake = await StockIntake.findOne({ _id: id, businessId }).lean();
  if (!intake) throw ApiError.notFound('Ye kaam nahi mila');
  return shape(intake);
}

/**
 * "Ye mera kaunsa item hai?" — app khud dhoondh kar batati hai.
 *
 * Teen raste, isi kram me: poora naam, phir naam ka hissa, phir wahi HSN. Kram
 * mayne rakhta hai — poora naam ek hi cheez batata hai, jabki "bearing" das
 * item se mil jata hai aur ek HSN to poori category ka hota hai.
 *
 * Isliye jawab ke saath `sure` bhi jata hai: poora naam mila to hi "pakka",
 * warna sirf "shayad" — aur screen dono ko alag alag dikhati hai. Bina is farak
 * ke app aksar galat item ko pakka bata deti aur dukaandaar bina padhe haan kar
 * deta; wo galti stock aur lagat dono me ghus jati hai.
 */
export async function matchesForLine(businessId, id, index) {
  const intake = await StockIntake.findOne({ _id: id, businessId }).select('lines').lean();
  if (!intake) throw ApiError.notFound('Ye kaam nahi mila');

  const line = intake.lines[index];
  if (!line) throw ApiError.badRequest('Ye line nahi mili');

  const select = 'name sku unit stockQty salePrice wholesalePrice purchasePrice mrp hsn gstRate';
  const base = { businessId, isActive: true };
  const esc = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const found = [];
  const seen = new Set();
  const push = (rows, sure) => {
    for (const row of rows) {
      const key = String(row._id);
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ ...row, sure });
    }
  };

  push(
    await Item.find({ ...base, name: new RegExp(`^${esc(line.sourceName)}$`, 'i') })
      .select(select).limit(5).lean(),
    true,
  );

  if (found.length < 5) {
    push(
      await Item.find({ ...base, name: new RegExp(esc(line.sourceName.slice(0, 24)), 'i') })
        .select(select).limit(8).lean(),
      false,
    );
  }

  if (found.length < 5 && line.hsn) {
    push(await Item.find({ ...base, hsn: line.hsn }).select(select).limit(5).lean(), false);
  }

  return { line, matches: found.slice(0, 8) };
}

/**
 * EK LINE KA FAISLA — "Add karke aage" wala button yahi bulata hai.
 *
 * Bechne ka rate ITEM PE turant lag jata hai, aakhir me nahi. Wajah: aadmi ne
 * abhi abhi soch kar wo number likha hai. Use aakhir tak roke rakhne ka matlab
 * hota ki beech me app band ho jane par wo poori mehnat gayab — aur dobara
 * bees item ke rate yaad karke likhna kisi ke bas ka nahi.
 *
 * Stock phir bhi abhi nahi badhta — wo aakhri kadam (`finishIntake`) hi karta
 * hai, ek hi baar, poore bill ka.
 */
export async function decideLine(businessId, id, index, payload, userId) {
  const intake = await StockIntake.findOne({ _id: id, businessId });
  if (!intake) throw ApiError.notFound('Ye kaam nahi mila');
  if (intake.status !== 'PENDING') {
    throw ApiError.badRequest('Ye kaam pehle se poora ho chuka hai ya ruk gaya hai');
  }

  const line = intake.lines[index];
  if (!line) throw ApiError.badRequest('Ye line nahi mili');

  /* ---- chhod dena ---- */
  if (payload.skip) {
    line.status = 'SKIPPED';
    line.itemId = null;
    line.createdNewItem = false;
    line.decidedAt = new Date();
    await intake.save();
    return shape(intake.toObject());
  }

  const sellingPrice = round2(payload.sellingPrice || 0);
  if (!(sellingPrice > 0)) {
    throw ApiError.badRequest('Bechne ka rate daalna zaroori hai');
  }

  /* ---- kaunsa item ---- */
  let itemId = null;
  let createdNew = false;

  /*
    Lagat kaun si — GST wale ke liye tax ke bina, bina GST wale ke liye tax ke
    saath (StockIntake.js me poori wajah). Aakhri kadam bhi bilkul yahi hisaab
    lagata hai; do jagah do alag lagana hi wo galti hai jisse screen pe ek
    number dikhta hai aur khep me doosra chadh jata hai.
  */
  const business = await Business.findById(businessId).select('gstEnabled').lean();
  const cost = business?.gstEnabled ? line.unitCostExTax : line.unitCostIncTax;

  if (payload.itemId) {
    const item = await Item.findOne({ _id: payload.itemId, businessId }).select('_id').lean();
    if (!item) throw ApiError.badRequest('Ye item aapke stock me nahi mila');
    itemId = item._id;
  } else {
    /*
      Naya item — par OPENING STOCK ZERO.

      Yahan quantity daal dena sabse aasan galti hai, aur uska nateeja saaf
      dikhta bhi nahi: wahi maal do baar chadh jata — ek baar opening stock ke
      roop me, doosri baar purchase se — aur uski do khep ban jati. Stock dugna,
      lagat aadhi, aur ye pakda mahino baad stock ginte waqt jata hai.

      Maal SIRF purchase se aata hai. Item yahan bas KHULTA hai.
    */
    const created = await createItem(businessId, {
      name: (payload.newItem?.name || line.sourceName).trim(),
      sku: payload.newItem?.sku || '',
      unit: payload.newItem?.unit || line.unit,
      hsn: payload.newItem?.hsn ?? line.hsn,
      gstRate: payload.newItem?.gstRate ?? line.gstRate,
      categoryId: payload.newItem?.categoryId || null,
      purchasePrice: cost,
      salePrice: sellingPrice,
      openingStock: 0,
    }, userId);
    itemId = created._id;
    createdNew = true;
  }

  // Purane item ka bechne ka rate bhi abhi hi badal do — wahi to abhi tay hua hai
  if (!createdNew) {
    await Item.updateOne({ _id: itemId, businessId }, { salePrice: sellingPrice });
  }

  line.itemId = itemId;
  line.sellingPrice = sellingPrice;
  line.status = 'ADDED';
  line.createdNewItem = createdNew;
  line.decidedAt = new Date();
  await intake.save();

  return shape(intake.toObject());
}

/** Faisla badalna — "peeche" dabane par wahi line dobara khulti hai */
export async function resetLine(businessId, id, index) {
  const intake = await StockIntake.findOne({ _id: id, businessId });
  if (!intake) throw ApiError.notFound('Ye kaam nahi mila');
  if (intake.status !== 'PENDING') throw ApiError.badRequest('Ye kaam pehle se poora ho chuka hai');

  const line = intake.lines[index];
  if (!line) throw ApiError.badRequest('Ye line nahi mili');

  line.status = 'PENDING';
  line.decidedAt = null;
  await intake.save();
  return shape(intake.toObject());
}

/**
 * AAKHRI KADAM — ab maal sach me stock me aata hai.
 *
 * Yahan koi naya hisaab nahi hai. Wahi purana `createPurchase()` chalta hai,
 * isliye stock, khep (FIFO ki lagat), supplier ka khata, GST ka input credit
 * aur purchase ka number — sab bilkul waise bante hain jaise haath se ki hui
 * kharid me. Return, GST report aur Fayda-Nuksan me is maal ka bartaav baaki
 * sab maal jaisa hi rehta hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GST OFF WALE KA RATE — chhota faisla, bada farak.
 *
 * Kharidne wale ki GST band ho to uske liye tax ek ASLI kharch hai; wo kabhi
 * wapas nahi milega. Aise me bill ka tax chhod dena do jhooth bolta: uski lagat
 * kam dikhti (aur munafa zyada), aur supplier ke khate me bill se kam raqam
 * chadhti — yaani hisaab hi na milta.
 *
 * Isliye us halat me rate me tax jod kar bhejte hain (`total / qty`) aur gstRate
 * 0 rakhte hain. Jod bill se milta hai, aur lagat sach bolti hai.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function finishIntake(businessId, id, payload, userId) {
  const found = await StockIntake.findOne({ _id: id, businessId }).lean();
  if (!found) throw ApiError.notFound('Ye kaam nahi mila');
  if (found.status === 'DONE') throw ApiError.badRequest('Ye maal pehle se stock me daal chuke hain');
  if (found.status === 'CANCELLED') throw ApiError.badRequest('Ye bill cancel ho chuka hai');

  const pending = found.lines.filter((l) => l.status === 'PENDING');
  if (pending.length) {
    throw ApiError.badRequest(`${pending.length} item ka faisla abhi baaki hai`);
  }

  const added = found.lines.filter((l) => l.status === 'ADDED' && l.itemId);
  if (!added.length) {
    throw ApiError.badRequest('Ek bhi item stock me daalne ke liye nahi chuna');
  }

  const business = await Business.findById(businessId).select('gstEnabled').lean();
  const gstOn = Boolean(business?.gstEnabled);

  const items = added.map((l) => (gstOn
    ? {
      itemId: l.itemId, qty: l.qty, rate: l.rate, discount: l.discount, gstRate: l.gstRate,
    }
    : {
      // Tax lagat me — upar wali wajah
      itemId: l.itemId, qty: l.qty, rate: l.unitCostIncTax, discount: 0, gstRate: 0,
    }));

  /*
    STATUS PEHLE PAKDO, PHIR KAAM KARO.

    Do tap ek saath (ya do staff ek hi waqt pe) — aur wahi maal DO baar stock me
    chadh jata: do purchase, do khep, supplier ka khata dugna. Ye galti mahino
    baad stock ginte waqt pakdi jati hai, jab tak uska koi sira nahi milta.

    Isliye status pehle `findOneAndUpdate` ki chhalni me hi pakad lete hain —
    doosri koshish ko wahin "pehle se ho chuka" mil jata hai. Purchase banne me
    kuch gadbad ho to status wapas PENDING kar dete hain, warna kaam adhoora reh
    jata aur dobara karne ka koi rasta hi na bachta.
  */
  const claimed = await StockIntake.findOneAndUpdate(
    { _id: id, businessId, status: 'PENDING' },
    { status: 'DONE', completedAt: new Date(), completedByUserId: userId },
    { new: true },
  );
  if (!claimed) throw ApiError.badRequest('Ye kaam abhi abhi kisi aur ne poora kar diya');

  let purchase;
  try {
    purchase = await createPurchase(businessId, {
      supplierId: found.supplierPartyId ? String(found.supplierPartyId) : '',
      supplierBillNo: found.sourceInvoiceNo || '',
      // Tareekh BILL ki, aaj ki nahi — FIFO me is khep ka number usi hisaab se aana chahiye
      purchaseDate: found.invoiceDate || new Date(),
      items,
      paidAmount: round2(payload?.paidAmount || 0),
      notes: payload?.notes || `${found.sellerName} se aaya maal`,
      updatePurchasePrice: true,
    }, userId);
  } catch (err) {
    await StockIntake.updateOne(
      { _id: id, businessId },
      { status: 'PENDING', completedAt: null, completedByUserId: null },
    );
    throw err;
  }

  claimed.purchaseId = purchase._id;
  await claimed.save();

  return { intake: shape(claimed.toObject()), purchase };
}

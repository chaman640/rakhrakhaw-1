import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  RETURN_TYPES, PARTY_TYPES, LEDGER_TYPES, STOCK_MOVEMENT_TYPES,
  COUNTER_KEYS, TAX_TYPES, PAYMENT_STATUS} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { amountInWords } from '../utils/amountInWords.js';
import {
  ReturnNote, Invoice, Purchase, Party, Item, Business, Counter, Payment} from '../models/index.js';
import { scopeByParty, isScoped, canSeeDoc } from '../utils/scope.js';
import { applyStockChange } from './stock.service.js';
import { khepNikalo, khepWapas } from './lot.service.js';
import { postEntry, reverseEntriesFor } from './ledger.service.js';
import { applyCredit, releaseCredit, tradedQty } from './settlement.service.js';
import { sweepAdvance } from './balance.service.js';
import { decideTaxType, computeInvoice, hsnSummary } from './gst.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const IS_SALE = (type) => type === RETURN_TYPES.SALE_RETURN;

/**
 * Bill ki line par jo khep likhi hai, usme se "ab wali" wapasi ka hissa chuno.
 *
 * Bill me ek hi item do khep se ja sakta hai — 60 purane ₹80 wale, 40 naye
 * ₹100 wale. Retailer 50 wapas kare to wo un 60 me se hi hain, kyunki bikte
 * bhi wahi pehle the.
 *
 * `pehleWapas` yahan asli baat hai. Uske bina do adhoori wapasi (50 + 50)
 * DONO shuru se ginti aur dono wahi purani khep me 50-50 daal deti — us khep
 * me 100 wapas chala jata jabki usme se nikle sirf 60 the. Ginti sahi dikhti
 * rehti, par godown me ₹800 ki lagat hawa se paida ho jati. Isliye pehle
 * utna hissa CHHOD kar aage badhte hain jitna pehle wapas ho chuka hai.
 *
 * Bill hi na juda ho (ya purane bill me khep ka nishaan hi na ho) to `null` —
 * bulane wala tab andaze wali lagat pe nayi khep bana leta hai.
 */
function khepChuno(billLots, pehleWapas, chahiye) {
  if (!billLots?.length) return null;

  let chhodna = round2(pehleWapas || 0);
  let bacha = round2(chahiye);
  const out = [];

  for (const lot of billLots) {
    if (bacha <= 0) break;
    let isme = round2(lot.qty);

    if (chhodna > 0) {
      const kata = Math.min(chhodna, isme);
      chhodna = round2(chhodna - kata);
      isme = round2(isme - kata);
      if (isme <= 0) continue;
    }

    const lena = round2(Math.min(bacha, isme));
    out.push({ lotId: lot.lotId || null, qty: lena, unitCost: lot.unitCost || 0 });
    bacha = round2(bacha - lena);
  }

  // Bill pe likhi khep kam pad gayi (purana data) — bache hue ko andaze pe chhodo
  if (bacha > 0) out.push({ lotId: null, qty: bacha, unitCost: billLots[0]?.unitCost || 0 });

  return out;
}

const CONFIG = {
  [RETURN_TYPES.SALE_RETURN]: {
    label: 'Credit Note',
    prefix: 'CRN',
    counterKey: COUNTER_KEYS.SALE_RETURN,
    partyType: PARTY_TYPES.RETAILER,
    stockType: STOCK_MOVEMENT_TYPES.SALE_RETURN,
    stockSign: +1,                       // maal wapas aaya -> stock badha
    ledgerType: LEDGER_TYPES.SALE_RETURN,
  },
  [RETURN_TYPES.PURCHASE_RETURN]: {
    label: 'Debit Note',
    prefix: 'DBN',
    counterKey: COUNTER_KEYS.PURCHASE_RETURN,
    partyType: PARTY_TYPES.SUPPLIER,
    stockType: STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
    stockSign: -1,                       // maal wapas bheja -> stock ghata
    ledgerType: LEDGER_TYPES.PURCHASE_RETURN,
  },
};

/* ------------------------------------------------------------------ list */

export async function listReturns(businessId, q, viewer = null) {
  let filter = { businessId };
  if (q.type !== 'all') filter.type = q.type;
  if (q.partyId) filter.partyId = q.partyId;

  if (q.from || q.to) {
    filter.returnDate = {};
    if (q.from) filter.returnDate.$gte = q.from;
    if (q.to) { const t = new Date(q.to); t.setHours(23, 59, 59, 999); filter.returnDate.$lte = t; }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const parties = await Party.find({ businessId, $or: [{ name: rx }, { shopName: rx }] })
      .select('_id').lean();
    filter.$or = [
      { returnNo: rx }, { againstNo: rx },
      { partyId: { $in: parties.map((p) => p._id) } },
    ];
  }

  /*
    Wapasi bhi party ke saath chalti hai, isliye wahi hadd yahan bhi.

    Ek baat khaas: PURCHASE_RETURN ki party supplier hoti hai, aur supplier
    kisi ke "naam" nahi hote. Matlab hadd wale aadmi ko purchase return tabhi
    dikhega jab usne khud banaya ho (`alsoMine`) — jo theek hai, kyunki
    supplier wala kaam uske hisse me hai hi nahi.
  */
  filter = await scopeByParty(filter, businessId, viewer, { alsoMine: true });

  const skip = (q.page - 1) * q.limit;
  const [rows, total] = await Promise.all([
    ReturnNote.find(filter).sort({ returnDate: -1, createdAt: -1 }).skip(skip).limit(q.limit)
      .populate('partyId', 'name shopName phone type').lean(),
    ReturnNote.countDocuments(filter),
  ]);

  return {
    returns: rows.map((r) => ({
      ...r,
      itemCount: r.items.length,
      party: r.partyId ? {
        _id: r.partyId._id, name: r.partyId.shopName || r.partyId.name, phone: r.partyId.phone,
      } : null,
      partyId: r.partyId?._id || r.partyId,
    })),
    meta: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) },
  };
}

export async function getStats(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const rows = await ReturnNote.aggregate([
    { $match: { businessId: bid } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        amount: { $sum: '$grandTotal' },
        monthAmount: {
          $sum: { $cond: [{ $gte: ['$returnDate', monthStart] }, '$grandTotal', 0] },
        },
      },
    },
  ]);

  const pick = (t) => rows.find((r) => r._id === t) || {};
  return {
    saleCount: pick(RETURN_TYPES.SALE_RETURN).count || 0,
    saleAmount: round2(pick(RETURN_TYPES.SALE_RETURN).amount || 0),
    saleMonthAmount: round2(pick(RETURN_TYPES.SALE_RETURN).monthAmount || 0),
    purchaseCount: pick(RETURN_TYPES.PURCHASE_RETURN).count || 0,
    purchaseAmount: round2(pick(RETURN_TYPES.PURCHASE_RETURN).amount || 0),
    purchaseMonthAmount: round2(pick(RETURN_TYPES.PURCHASE_RETURN).monthAmount || 0),
  };
}

export async function getReturn(businessId, id, { partyId = null, viewer = null } = {}) {
  const filter = { _id: id, businessId };
  if (partyId) filter.partyId = partyId;

  const note = await ReturnNote.findOne(filter).populate('partyId', 'name shopName phone type').lean();
  if (!note) throw ApiError.notFound('Ye return nahi mila');

  /*
    List se chhupa dena aadha kaam hai — id to URL me haath se bhi daali ja
    sakti hai. Isliye khud kholne par bhi wahi hadd, aur jawab "nahi mila" hi
    hai, "ijazat nahi" nahi — warna "nahi mila" aur "hai par tumhara nahi" ka
    farak batakar hum khud hi bata dete ki uska wajood hai.
  */
  if (viewer && !(await canSeeDoc(
    { partyId: note.partyId?._id || note.partyId, createdBy: note.createdBy },
    businessId, viewer,
  ))) throw ApiError.notFound('Ye return nahi mila');

  return {
    ...note,
    party: note.partyId,
    partyId: note.partyId?._id || note.partyId,
    label: CONFIG[note.type].label,
    hsnSummary: note.gstEnabled ? hsnSummary(note.items, note.taxType) : [],
    amountInWords: amountInWords(note.grandTotal),
  };
}

/* ------------------------------------------------- kitna wapas ho chuka */

/**
 * Ek bill/purchase me se har item ka kitna maal PEHLE HI wapas ho chuka hai.
 * Isi se aage rok lagti hai — becha 10, wapas 12 nahi ho sakta.
 */
async function returnedSoFar(businessId, { invoiceId, purchaseId }) {
  const match = { businessId: new mongoose.Types.ObjectId(businessId) };
  if (invoiceId) match.invoiceId = new mongoose.Types.ObjectId(invoiceId);
  else if (purchaseId) match.purchaseId = new mongoose.Types.ObjectId(purchaseId);
  else return {};

  const rows = await ReturnNote.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $group: { _id: '$items.itemId', qty: { $sum: '$items.qty' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.qty]));
}

/**
 * Is party se ab tak KUL kitna maal wapas ho chuka — bill se juda hua bhi,
 * aur bina bill wala bhi.
 *
 * `returnedSoFar` sirf ek bill ke andar dekhta hai. Bina bill wali wapasi
 * kisi bill se judi hoti hi nahi, isliye wahan se wo dikhti hi nahi — aur
 * bina is ginti ke koi 10 piece ka maal 10-10 karke kai baar "wapas" kar
 * sakta tha, har baar naya credit leke.
 */
async function returnedByParty(businessId, partyId, type, itemIds = []) {
  const rows = await ReturnNote.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(String(businessId)),
        partyId: new mongoose.Types.ObjectId(String(partyId)),
        type,
      },
    },
    { $unwind: '$items' },
    {
      $match: {
        'items.itemId': { $in: itemIds.map((i) => new mongoose.Types.ObjectId(String(i))) },
      },
    },
    { $group: { _id: '$items.itemId', qty: { $sum: '$items.qty' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), round2(r.qty)]));
}

/** Bill ya purchase se return ka form pehle se bhar do */
export async function prefillFromDoc(businessId, type, docId) {
  const isSale = IS_SALE(type);

  const doc = isSale
    ? await Invoice.findOne({ _id: docId, businessId, isCancelled: false }).lean()
    : await Purchase.findOne({ _id: docId, businessId }).lean();

  if (!doc) throw ApiError.notFound(isSale ? 'Bill nahi mila' : 'Purchase nahi mili');

  const already = await returnedSoFar(businessId, isSale ? { invoiceId: docId } : { purchaseId: docId });

  const items = doc.items.map((l) => {
    const done = already[String(l.itemId)] || 0;
    return {
      itemId: l.itemId,
      name: l.name,
      hsn: l.hsn || '',
      unit: l.unit,
      soldQty: round2(l.qty),
      returnedQty: round2(done),
      qty: round2(Math.max(0, l.qty - done)),   // default: jitna bacha hai
      rate: l.rate,
      discount: 0,
      gstRate: l.gstRate ?? 0,
    };
  });

  const partyId = isSale ? doc.partyId : doc.supplierId;
  const party = await Party.findOne({ _id: partyId, businessId })
    .select('name shopName phone type gstin address balance').lean();

  return {
    type,
    partyId,
    party,
    [isSale ? 'invoiceId' : 'purchaseId']: doc._id,
    againstNo: isSale ? doc.invoiceNo : doc.purchaseNo,
    againstDate: isSale ? doc.invoiceDate : doc.purchaseDate,
    gstEnabled: isSale ? doc.gstEnabled : undefined,
    items,
    fullyReturned: items.every((i) => i.qty <= 0),
  };
}

/* ---------------------------------------------------------------- create */

export async function createReturn(businessId, payload, userId) {
  const type = payload.type;
  const cfg = CONFIG[type];
  if (!cfg) throw ApiError.badRequest('Return ka type galat hai');
  const isSale = IS_SALE(type);

  const [business, party] = await Promise.all([
    Business.findById(businessId).lean(),
    Party.findOne({ _id: payload.partyId, businessId }).lean(),
  ]);
  if (!party) throw ApiError.badRequest('Party nahi mili');
  if (party.type !== cfg.partyType) {
    throw ApiError.badRequest(isSale
      ? 'Sale return sirf retailer ka hota hai'
      : 'Purchase return sirf supplier ka hota hai');
  }

  if (!payload.items?.length) throw ApiError.badRequest('Kam se kam ek item daalein');

  // Original document (agar bataya hai)
  let original = null;
  if (isSale && payload.invoiceId) {
    original = await Invoice.findOne({ _id: payload.invoiceId, businessId, isCancelled: false }).lean();
    if (!original) throw ApiError.badRequest('Bill nahi mila ya cancel ho chuka hai');
    if (String(original.partyId) !== String(party._id)) {
      throw ApiError.badRequest('Ye bill is retailer ka nahi hai');
    }
  } else if (!isSale && payload.purchaseId) {
    original = await Purchase.findOne({ _id: payload.purchaseId, businessId }).lean();
    if (!original) throw ApiError.badRequest('Purchase nahi mili');
    if (String(original.supplierId) !== String(party._id)) {
      throw ApiError.badRequest('Ye purchase is supplier ki nahi hai');
    }
  }

  /**
   * Ek hi item agar do alag line me daala gaya ho to dono ko JOD kar dekhna zaroori hai.
   *
   * Pehle har line alag alag check hoti thi — isliye bill me 10 beche the aur koi
   * "6 + 6" do line me daal de to dono 10 se kam nikalte the aur 12 wapas ho jate the.
   */
  const wantedByItem = new Map();
  for (const line of payload.items) {
    const key = String(line.itemId);
    wantedByItem.set(key, round2((wantedByItem.get(key) || 0) + Number(line.qty || 0)));
  }

  // Bill se zyada wapas na ho jaye
  //
  // `already` neeche khep ka hisaab lagane me bhi chahiye (kitna pehle hi
  // wapas ho chuka), isliye ye is block ke bahar rehta hai.
  let already = {};
  if (original) {
    already = await returnedSoFar(businessId, isSale
      ? { invoiceId: original._id } : { purchaseId: original._id });

    /*
      BILL WALI HADD AKELE KAAFI NAHI HAI.

      `returnedSoFar` sirf `invoiceId` pe match karta hai, aur bina-bill wali
      wapasi `invoiceId: null` se save hoti hai — yaani wo is ginti me dikhti
      hi nahi. Us chhoot se ye rasta khula tha:

        1. INV-1 pe retailer ne 10 piece liye
        2. BINA BILL ka return, 10 piece  -> party wali ginti se paas
        3. INV-1 ke SAATH return, 10 piece -> bill wali ginti ko #2 dikha hi
           nahi, isliye ye bhi paas

      Nateeja: 10 beche, 20 wapas. Stock me 10 ka phantom aur khate me dohra
      credit. (Ulta kram pehle se safe tha — us halat me party wali ginti #1
      ko pakad leti hai.)

      Ab dono ginti chalti hain aur JO CHHOTI ho wahi asli hadd hai.
    */
    const itemIdList = [...wantedByItem.keys()];
    const [taken, returnedAll] = await Promise.all([
      tradedQty(isSale ? 'Invoice' : 'Purchase', businessId, party._id, itemIdList),
      returnedByParty(businessId, party._id, payload.type, itemIdList),
    ]);

    for (const [itemId, wantQty] of wantedByItem) {
      const src = original.items.find((i) => String(i.itemId) === itemId);
      if (!src) throw ApiError.badRequest(`${itemId} is bill me tha hi nahi`);

      const billLeft = round2(src.qty - (already[itemId] || 0));
      const partyLeft = round2((taken[itemId] || 0) - (returnedAll[itemId] || 0));
      const left = round2(Math.min(billLeft, partyLeft));

      if (wantQty > left) {
        throw ApiError.badRequest(
          partyLeft < billLeft
            ? `${src.name}: sirf ${left} ${src.unit} wapas ho sakta hai — is party ka bina-bill wala return pehle hi ho chuka hai`
            : `${src.name}: sirf ${left} ${src.unit} wapas ho sakta hai (${src.qty} me se ${round2(src.qty - left)} pehle hi wapas ho chuka)`
        );
      }
    }
  } else {
    /*
      BINA BILL WALI WAPASI PE BHI HADD.

      Ye jaanch pehle thi hi nahi — `if (original)` ke bahar kuch tha hi nahi.
      Yaani bill na chuno, aur 10 piece kharidne wala 500 piece "wapas" kar
      de: stock bhi badh jata tha aur uska poora credit bhi khate me chala
      jata tha. Dono taraf: retailer bhi, supplier bhi.

      Ab hadd wo hai jo us party ne SACH ME li hai — uske saare bill ka jod,
      jitna pehle wapas ho chuka wo ghata kar. Bill chuna hua na ho tab bhi
      hisaab utna hi sakht rehta hai.
    */
    const itemIdList = [...wantedByItem.keys()];
    const [taken, returned] = await Promise.all([
      tradedQty(isSale ? 'Invoice' : 'Purchase', businessId, party._id, itemIdList),
      returnedByParty(businessId, party._id, payload.type, itemIdList),
    ]);

    const names = await Item.find({ _id: { $in: itemIdList }, businessId })
      .select('name unit').lean();
    const nameMap = new Map(names.map((i) => [String(i._id), i]));

    for (const [itemId, wantQty] of wantedByItem) {
      const left = round2((taken[itemId] || 0) - (returned[itemId] || 0));
      if (wantQty > left) {
        const it = nameMap.get(itemId);
        const label = it?.name || 'Ye item';
        const unit = it?.unit || '';
        throw ApiError.badRequest(
          left <= 0
            ? `${label}: ${isSale ? 'inhone' : 'inse'} ye maal liya hi nahi — wapasi nahi ho sakti`
            : `${label}: sirf ${left} ${unit} wapas ho sakta hai (${isSale ? 'inhone' : 'inse'} kul ${taken[itemId] || 0} ${unit} liya tha)`
        );
      }
    }
  }

  const itemIds = payload.items.map((i) => i.itemId);
  const dbItems = await Item.find({ _id: { $in: itemIds }, businessId })
    .select('name hsn gstRate unit stockQty purchasePrice').lean();
  const itemMap = new Map(dbItems.map((i) => [String(i._id), i]));

  const lines = payload.items.map((l, idx) => {
    const item = itemMap.get(String(l.itemId));
    if (!item) throw ApiError.badRequest(`Row ${idx + 1}: item nahi mila`);
    if (l.qty <= 0) throw ApiError.badRequest(`${item.name}: quantity 0 nahi ho sakti`);
    return {
      itemId: item._id,
      name: item.name,
      hsn: item.hsn || '',
      unit: item.unit,
      // Bill ki tarah yahan bhi lagat jam jati hai — Fayda-Nuksan me wapas
      // aaye maal ki lagat isi se ghatati hai (Invoice model me poori wajah)
      costPrice: item.purchasePrice || 0,
      qty: l.qty,
      rate: l.rate,
      discount: l.discount || 0,
      gstRate: l.gstRate ?? item.gstRate ?? 0,
      reason: l.reason || '',
    };
  });

  // Supplier ko wapas bhejne se pehle dekh lo stock hai bhi ya nahi.
  // Yahan bhi ek hi item ki saari line jod kar dekhni hai — warna 15+15 do line me
  // daal kar 20 ke stock se 30 nikalne ki koshish ho jati hai (aur note ban chukne
  // ke baad beech me fail hoti hai).
  if (!isSale) {
    for (const [itemId, wantQty] of wantedByItem) {
      const item = itemMap.get(itemId);
      if (item && item.stockQty < wantQty) {
        throw ApiError.badRequest(
          `${item.name} ka stock sirf ${item.stockQty} ${item.unit} hai — itna wapas nahi bhej sakte`
        );
      }
    }
  }

  /**
   * GST — bill jaisa hi hisaab.
   *
   * DHYAN: `decideTaxType()` ek OBJECT deta hai — `{ documentType, taxType }`.
   * Pehle yahan destructure karna reh gaya tha, isliye poora object `taxType` me
   * chala jata tha. Nateeja: `computeInvoice` ka `taxType === 'CGST_SGST'` kabhi
   * match hi nahi karta tha -> GST 0 lagta tha, aur object enum field me jaane se
   * note save bhi nahi hota tha. (invoice.service.js me ye sahi likha hai.)
   */
  const gstEnabled = original?.gstEnabled ?? Boolean(business?.gstEnabled);
  const decided = decideTaxType({
    gstEnabled,
    businessStateCode: business?.address?.stateCode,
    partyStateCode: party?.address?.stateCode,
  });
  // Bill ka apna taxType ho to wahi — credit note aur bill me ek jaisa tax lagna chahiye.
  // (Purchase me taxType hota hi nahi, wahan decided use hoga.)
  const taxType = original?.taxType || decided.taxType;

  let totals;
  try {
    totals = computeInvoice(lines, {
      gstEnabled, taxType, extraDiscount: payload.extraDiscount || 0,
    });
  } catch (err) {
    // "discount rate se zyada" jaisi galti user ki hai — 500 nahi, 400 jana chahiye
    throw ApiError.badRequest(err.message);
  }

  const { number: returnNo } = await Counter.nextNumber({
    businessId, key: cfg.counterKey, prefix: cfg.prefix, date: payload.returnDate || new Date(),
  });

  const note = await ReturnNote.create({
    businessId, partyId: party._id, type, returnNo,
    returnDate: payload.returnDate || new Date(),
    invoiceId: isSale ? (payload.invoiceId || null) : null,
    purchaseId: !isSale ? (payload.purchaseId || null) : null,
    againstNo: original ? (isSale ? original.invoiceNo : original.purchaseNo) : '',
    gstEnabled,
    taxType: gstEnabled ? taxType : TAX_TYPES.NONE,
    items: totals.items.map((it, i) => ({ ...it, reason: lines[i].reason })),
    subTotal: totals.subTotal,
    discountTotal: totals.discountTotal,
    taxableTotal: totals.taxableTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    businessSnapshot: {
      name: business?.name, phone: business?.phone, gstin: business?.gstin,
      logoUrl: business?.logoUrl, address: business?.address,
    },
    partySnapshot: {
      name: party.name, shopName: party.shopName, phone: party.phone,
      gstin: party.gstin, address: party.address,
    },
    reason: payload.reason || '',
    notes: payload.notes || '',
    createdBy: userId,
  });

  // ---- Stock ----
  for (const line of totals.items) {
    await applyStockChange({
      businessId,
      itemId: line.itemId,
      type: cfg.stockType,
      qty: cfg.stockSign * line.qty,
      refType: 'ReturnNote',
      refId: note._id,
      note: `${returnNo}${note.againstNo ? ` (${note.againstNo})` : ''}`,
      userId,
    });

    /*
      Khep bhi sambhalo — aur dono taraf ka matlab ULTA hai.

      SALE RETURN (retailer ne wapas kiya): maal ghar aa raha hai. Wo USI khep
      me lautna chahiye jahan se gaya tha. Bill juda ho to wo nishaan bill ki
      line pe hi likha hai — seedha wahi istemal karte hain, isliye wapas aaya
      maal apni asli lagat aur apni asli jagah dono paa leta hai.

      Bill juda na ho to hum jaan hi nahi sakte ki maal kis khep ka tha.
      Aise me nayi khep banti hai, aur uski lagat wo hai jis par ye wapasi
      likhi gayi — andaza hi sahi, par saaf aur bataya hua andaza.

      PURCHASE RETURN (supplier ko wapas bheja): maal ja raha hai — FIFO se
      nikalta hai, bilkul bikri ki tarah.
    */
    if (isSale) {
      const fromBill = original?.items?.find((i) => String(i.itemId) === String(line.itemId));
      const pieces = khepChuno(fromBill?.lots, already[String(line.itemId)] || 0, line.qty)
        || [{ lotId: null, qty: line.qty, unitCost: line.costPrice || 0 }];
      await khepWapas({
        businessId, itemId: line.itemId, pieces,
        date: note.returnDate, refNo: returnNo,
      });
      line.lots = pieces;
      /*
        Wapas aaye maal ki lagat bhi wahi jo GAYA tha, aaj ka rate nahi.

        Fayda-Nuksan me becha hua maal ki lagat ghatai jati hai; wapas aane par
        wo ghatana ulta karna padta hai. Agar yahan aaj ka rate rakh dein to
        ₹80 me becha maal ₹100 pe wapas aayega aur har wapasi chup-chaap ₹20
        ka jhootha fayda bana degi.
      */
      const wapasKul = round2(pieces.reduce((s, x) => s + x.qty * x.unitCost, 0));
      line.costPrice = line.qty > 0 ? round2(wapasKul / line.qty) : 0;
      line.costTotal = wapasKul;
    } else {
      const { cost, unitCost, pieces } = await khepNikalo({
        businessId, itemId: line.itemId, qty: line.qty,
        fallbackCost: line.costPrice || 0,
      });
      line.lots = pieces;
      line.costPrice = unitCost;
      line.costTotal = cost;
    }
  }

  // Khep ka nishaan aur asli lagat note pe likh do
  note.items = note.items.map((it, i) => ({
    ...(it.toObject?.() || it),
    costPrice: totals.items[i].costPrice,
    costTotal: totals.items[i].costTotal || 0,
    lots: totals.items[i].lots || [],
  }));
  await note.save();

  // ---- Khata ----
  // Dono taraf hisaab GHATTA hai, isliye dono me credit:
  //   sale return     -> retailer ka udhaar kam
  //   purchase return -> supplier ko dena kam
  await postEntry({
    businessId,
    partyId: party._id,
    type: cfg.ledgerType,
    credit: totals.grandTotal,
    date: note.returnDate,
    refType: 'ReturnNote',
    refId: note._id,
    refNo: returnNo,
    note: payload.reason || cfg.label,
    userId,
  });

  /*
    ---- Aur ab BILL pe bhi ----

    Yahi wo kadam hai jo pehle tha hi nahi. Khate me credit daal dena aadha
    kaam hai; jab tak bill ka `dueAmount` nahi ghatta, wo bill kagaz pe udhaar
    dikhata rehta hai — chahe poora maal dukaan me wapas aa chuka ho.

    Kram maayne rakhta hai: credit SABSE PEHLE usi bill pe lagta hai jiska
    maal wapas aaya (`preferId`), phir sabse purane khule bill pe. Bina iske
    "is bill ka maal wapas kiya" karne pe kisi teen mahine purane bill ka
    udhaar ghatta aur ye bill khula pada rehta — dukaandaar ko lagta ki kuch
    hua hi nahi.
  */
  const { allocations, left } = await applyCredit(
    isSale ? 'Invoice' : 'Purchase',
    businessId,
    party._id,
    totals.grandTotal,
    { preferId: original?._id || null },
  );

  if (allocations.length || left > 0) {
    note.allocations = allocations;
    note.advance = round2(left);
    await note.save();
  }

  await sweepAdvance(businessId, party._id);

  return getReturn(businessId, note._id);
}

/* ---------------------------------------------------------------- delete */

export async function deleteReturn(businessId, id, userId, viewer = null) {
  const note = await ReturnNote.findOne({ _id: id, businessId });
  if (!note) throw ApiError.notFound('Ye return nahi mila');

  // Mitane se pehle bhi wahi hadd — dekh na sakne wali cheez mitani to bilkul nahi
  if (isScoped(viewer) && !(await canSeeDoc(note, businessId, viewer))) {
    throw ApiError.notFound('Ye return nahi mila');
  }

  /*
    Jis wapasi ka paisa cash me wapas kiya ja chuka hai, wo mitayi nahi ja
    sakti. Warna Payment pe `returnNoteId` ek aise note ko takta reh jata hai
    jo hai hi nahi, aur khate me wo refund bina kisi wajah ke pada rehta hai.
  */
  const refunded = await Payment.countDocuments({
    businessId, returnNoteId: note._id, status: PAYMENT_STATUS.CONFIRMED,
  });
  if (refunded > 0) {
    throw ApiError.badRequest(
      `${note.returnNo} ka paisa wapas kiya ja chuka hai — pehle wo payment hatayein, phir ye wapasi hategi`,
    );
  }

  const cfg = CONFIG[note.type];

  // Stock ulta karo — sale return me ghatao, purchase return me badhao.
  // allowNegative isliye taaki jo maal wapas aake bik chuka hai uske delete pe bhi
  // entry ban jaye (warna record aur stock dono galat ho jate).
  for (const line of note.items) {
    await applyStockChange({
      businessId,
      itemId: line.itemId,
      type: cfg.stockType,
      qty: -cfg.stockSign * line.qty,
      refType: 'ReturnNote',
      refId: note._id,
      note: `${note.returnNo} delete hua`,
      userId,
      allowNegative: true,
    });

    /*
      Khep bhi ulti — banate waqt jo kiya tha, uska ulta.

      Sale return ne maal khep me DAALA tha, to delete uske utna hi NIKALEGA
      (aur wahi khep pehle, kyunki FIFO ka kram wahi hai). Purchase return ne
      NIKALA tha, to delete usi khep me wapas daalega.
    */
    if (note.type === RETURN_TYPES.SALE_RETURN) {
      await khepNikalo({
        businessId, itemId: line.itemId, qty: line.qty,
        fallbackCost: line.costPrice || 0,
      });
    } else {
      await khepWapas({
        businessId, itemId: line.itemId,
        pieces: line.lots?.length
          ? line.lots
          : [{ lotId: null, qty: line.qty, unitCost: line.costPrice || 0 }],
        date: note.returnDate,
        refNo: `${note.returnNo} delete`,
      });
    }
  }

  await reverseEntriesFor({ businessId, refType: 'ReturnNote', refId: note._id, userId });

  // Bill pe jo credit laga tha wo bhi wapas — warna wapasi mitane pe bill
  // hamesha ke liye "chukta" dikhta rehta aur paisa gayab ho jata
  await releaseCredit(
    note.type === RETURN_TYPES.SALE_RETURN ? 'Invoice' : 'Purchase',
    businessId,
    note.allocations,
  );

  // Credit wapas lene se bill dobara khul gaya — us party ka koi aur jama
  // paisa pada ho to wo ab is bill pe laga do
  await sweepAdvance(businessId, note.partyId);

  const no = note.returnNo;
  await note.deleteOne();

  return { deleted: true, message: `${no} hata diya — stock aur khata wapas theek kar diye` };
}

/* --------------------------------------------------------- retailer side */

export async function listMyReturns(businessId, partyId, q) {
  return listReturns(businessId, { ...q, partyId: String(partyId), type: RETURN_TYPES.SALE_RETURN });
}

export { CONFIG as RETURN_CONFIG };

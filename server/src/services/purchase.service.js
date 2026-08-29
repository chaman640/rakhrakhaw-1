import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  PARTY_TYPES, STOCK_MOVEMENT_TYPES, LEDGER_TYPES, COUNTER_KEYS,
  RETURN_TYPES, PAYMENT_STATUS,
} from '../config/constants.js';
import { round2, splitRoundOff } from '../utils/money.js';
import { getFinancialYear } from '../utils/financialYear.js';
import {
  Purchase, Party, Item, Business, Counter, StockMovement, StockLot, Payment, ReturnNote,
} from '../models/index.js';
import { applyStockChange } from './stock.service.js';
import { khepBanao, khepHatao } from './lot.service.js';
import { postEntry, reverseEntriesFor } from './ledger.service.js';
import { applyCredit } from './settlement.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PREFIX = 'PUR';

/* ---------------------------------------------------------------- totals */

/**
 * Ek jagah hisaab. Line total = (qty × rate) − discount, uspe GST.
 * GST off hai to gstRate 0 chala jata hai — koi alag code path nahi.
 */
export function computeTotals(lines, { gstEnabled }) {
  let subTotal = 0, discountTotal = 0, taxableTotal = 0, taxTotal = 0;

  const items = lines.map((l) => {
    const gross = round2(l.qty * l.rate);
    const discount = round2(l.discount || 0);
    const taxableValue = round2(gross - discount);
    if (taxableValue < 0) throw ApiError.badRequest('Discount rate se zyada nahi ho sakta');

    const gstRate = gstEnabled ? Number(l.gstRate || 0) : 0;
    const taxAmount = round2((taxableValue * gstRate) / 100);

    subTotal = round2(subTotal + gross);
    discountTotal = round2(discountTotal + discount);
    taxableTotal = round2(taxableTotal + taxableValue);
    taxTotal = round2(taxTotal + taxAmount);

    return {
      ...l,
      discount,
      gstRate,
      taxableValue,
      taxAmount,
      total: round2(taxableValue + taxAmount),
    };
  });

  const before = round2(taxableTotal + taxTotal);
  const { grandTotal, roundOff } = splitRoundOff(before);

  return { items, subTotal, discountTotal, taxableTotal, taxTotal, roundOff, grandTotal };
}

function paymentStatusOf(paid, total) {
  if (paid <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  return 'partial';
}

/* ------------------------------------------------------------------ list */

export async function listPurchases(businessId, q) {
  const filter = { businessId };
  if (q.supplierId) filter.supplierId = q.supplierId;
  if (q.paymentStatus !== 'all') filter.paymentStatus = q.paymentStatus;

  if (q.from || q.to) {
    filter.purchaseDate = {};
    if (q.from) filter.purchaseDate.$gte = q.from;
    if (q.to) {
      const to = new Date(q.to);
      to.setHours(23, 59, 59, 999);
      filter.purchaseDate.$lte = to;
    }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ purchaseNo: rx }, { supplierBillNo: rx }, { 'items.name': rx }];
  }

  const skip = (q.page - 1) * q.limit;
  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .sort(q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 })
      .skip(skip).limit(q.limit)
      .populate('supplierId', 'name shopName phone')
      .lean(),
    Purchase.countDocuments(filter),
  ]);

  return {
    purchases: purchases.map((p) => ({
      ...p,
      supplier: p.supplierId ? { _id: p.supplierId._id, name: p.supplierId.shopName || p.supplierId.name } : null,
      supplierId: p.supplierId?._id || p.supplierId,
      itemCount: p.items?.length || 0,
    })),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      dayTotals: await dayTotalsFor(purchases, filter, q),
    },
  };
}

/**
 * "Aaj · 3 purchase · ₹42,500" wali header line ka jod.
 *
 * Bill wali list pe jo niyam hai, wahi yahan bhi — aur wo niyam ek hi hai:
 * **jod page ki rows se nahi gina jata**. Page 25 pe toot ta hai aur toot
 * aksar din ke beech me padta hai; page pe gino to aakhri din ka jod aadha
 * dikhega, poore vishwas ke saath.
 *
 * Purchase me `partyId` nahi, `supplierId` hota hai — aur `$match` id ko khud
 * nahi badalta, isliye use haath se ObjectId banana padta hai.
 */
async function dayTotalsFor(purchases, filter, q) {
  if (!purchases.length) return [];
  if (q.sort !== '-purchaseDate' && q.sort !== 'purchaseDate') return null;

  const times = purchases.map((p) => new Date(p.purchaseDate).getTime());
  const first = new Date(Math.min(...times)); first.setHours(0, 0, 0, 0);
  const last = new Date(Math.max(...times)); last.setHours(23, 59, 59, 999);

  const match = {
    ...filter,
    businessId: new mongoose.Types.ObjectId(String(filter.businessId)),
    purchaseDate: { $gte: first, $lte: last },
  };
  if (match.supplierId) match.supplierId = new mongoose.Types.ObjectId(String(match.supplierId));

  const rows = await Purchase.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } },
        amount: { $sum: '$grandTotal' },
        due: { $sum: '$dueAmount' },
        bills: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  return rows.map((r) => ({
    date: r._id, amount: round2(r.amount), due: round2(r.due), bills: r.bills,
  }));
}

export async function getStats(businessId) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [all] = await Purchase.aggregate([
    { $match: { businessId: bid } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' }, due: { $sum: '$dueAmount' } } },
  ]);

  const [month] = await Purchase.aggregate([
    { $match: { businessId: bid, purchaseDate: { $gte: monthStart } } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
  ]);

  return {
    totalPurchases: all?.count || 0,
    totalAmount: round2(all?.total || 0),
    totalDue: round2(all?.due || 0),
    thisMonthCount: month?.count || 0,
    thisMonthAmount: round2(month?.total || 0),
  };
}

export async function getPurchase(businessId, id) {
  const purchase = await Purchase.findOne({ _id: id, businessId })
    .populate('supplierId', 'name shopName phone gstin address balance')
    .lean();
  if (!purchase) throw ApiError.notFound('Purchase nahi mili');

  const movements = await StockMovement.find({ businessId, refType: 'Purchase', refId: id }).lean();

  /*
    YE MAAL AAYA KAHAN SE (item 11).

    App ke andar se aayi kharid pe ab bechne wali dukaan ka naam jata hai. Ab
    tak sirf `supplierBillNo` hota tha — ek khali text, jisse ye pata hi nahi
    chalta tha ki wo bill isi app me kahin maujood hai.

    Bill KHOLNE ka rasta yahan se nahi milta, aur wo jaan-boojh kar hai: wo
    bill doosri dukaan ka hai, uska poora kagaz dekhne ka haq is dukaan ko
    nahi. Naam kaafi hai — "ye maal Sharma Traders ke bill INV/2026/41 se
    aaya" — aur usse aage baat phone pe hoti hai, app me nahi.
  */
  let source = null;
  if (purchase.sourceBusinessId) {
    const seller = await Business.findById(purchase.sourceBusinessId).select('name phone').lean();
    if (seller) {
      source = {
        shopName: seller.name,
        phone: seller.phone || '',
        invoiceNo: purchase.supplierBillNo || '',
      };
    }
  }

  return {
    ...purchase,
    supplier: purchase.supplierId,
    supplierId: purchase.supplierId?._id || purchase.supplierId,
    source,
    movements,
  };
}

export async function nextNumber(businessId) {
  const fy = getFinancialYear();
  const counter = await Counter.findOne({ businessId, key: COUNTER_KEYS.PURCHASE, fy }).lean();
  const seq = (counter?.seq || 0) + 1;
  return { preview: `${PREFIX}/${fy}/${String(seq).padStart(4, '0')}` };
}

/* ---------------------------------------------------------------- create */

export async function createPurchase(businessId, payload, userId) {
  const business = await Business.findById(businessId).select('gstEnabled').lean();

  /*
    SUPPLIER AB ZAROORI NAHI.

    Aadhi kharid mandi se hoti hai — nakad, parchi bhi nahi, aur us aadmi ka
    naam bhi shayad pata na ho. Pehle aise maal ko app me daalne ka koi rasta
    hi nahi tha: ya to jhootha supplier banao ("Cash", "Local"), ya entry hi
    mat karo. Dono me se ek bhi theek nahi tha — pehle wale se supplier ki
    list kachra ho jati aur uske naam pe jhootha khata banta rehta, doosre se
    stock aur lagat dono galat ho jate.

    Ab supplier khali ho sakta hai. Us halat me KHATA banta hi nahi (kisko
    dena hai? kisi ko nahi), par stock, khep aur lagat — teeno waise hi
    chadhte hain. Paisa Fayda-Nuksan me lagat ke roop me aata hi hai, kyunki
    lagat bikri ke waqt khep se ginte hain, kisi khate se nahi.
  */
  const supplier = payload.supplierId
    ? await Party.findOne({ _id: payload.supplierId, businessId, type: PARTY_TYPES.SUPPLIER }).lean()
    : null;
  if (payload.supplierId && !supplier) {
    throw ApiError.badRequest('Supplier nahi mila — pehle Suppliers page se add karein');
  }

  // Saare item ek saath nikal lo (har row pe alag query nahi)
  const itemIds = payload.items.map((i) => i.itemId);
  const items = await Item.find({ _id: { $in: itemIds }, businessId })
    .select('name unit gstRate purchasePrice').lean();
  const itemMap = new Map(items.map((i) => [String(i._id), i]));

  const lines = payload.items.map((line, idx) => {
    const item = itemMap.get(String(line.itemId));
    if (!item) throw ApiError.badRequest(`Row ${idx + 1}: item nahi mila`);
    return {
      itemId: item._id,
      name: item.name,          // snapshot — item ka naam baad me badle to bill na badle
      unit: item.unit,
      qty: line.qty,
      rate: line.rate,
      discount: line.discount || 0,
      gstRate: line.gstRate ?? item.gstRate ?? 0,
    };
  });

  const totals = computeTotals(lines, { gstEnabled: business?.gstEnabled });

  /*
    Supplier na ho to kharid POORI CHUKTA hai — udhaar kisse?

    Ye chhoti si line ek bade jhoot ko rokti hai. Bina iske nakad wali kharid
    "₹8,000 dena baaki" ban kar "Dena hai" wali list me baith jati, aur wahan
    se hatane ka koi rasta hi na hota — na koi supplier jise paisa de sakein,
    na koi khata jisme entry ho. Dukaandaar rozana ek aisa number dekhta jo
    kisi ka bhi nahi hai.
  */
  const paidAmount = supplier
    ? round2(Math.min(payload.paidAmount || 0, totals.grandTotal))
    : totals.grandTotal;
  const dueAmount = round2(totals.grandTotal - paidAmount);

  const { number: purchaseNo } = await Counter.nextNumber({
    businessId, key: COUNTER_KEYS.PURCHASE, prefix: PREFIX,
    date: payload.purchaseDate || new Date(),
  });

  const purchase = await Purchase.create({
    businessId,
    supplierId: supplier?._id || null,
    purchaseNo,
    supplierBillNo: payload.supplierBillNo,
    purchaseDate: payload.purchaseDate || new Date(),
    items: totals.items,
    subTotal: totals.subTotal,
    discountTotal: totals.discountTotal,
    taxableTotal: totals.taxableTotal,
    taxTotal: totals.taxTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    paidAmount,
    dueAmount,
    paymentStatus: paymentStatusOf(paidAmount, totals.grandTotal),
    /*
      Bechne wale ke bill se taar (item 11).

      Ye sirf tab bharte hain jab kharid kisi DOOSRI dukaan ke bill se bani ho
      (stock intake wala rasta). Haath se banayi gayi kharid me dono khali
      rehte hain — aur wahi theek hai, uska koi doosra sira hai hi nahi.
    */
    sourceInvoiceId: payload.sourceInvoiceId || null,
    sourceBusinessId: payload.sourceBusinessId || null,
    notes: payload.notes,
    createdBy: userId,
  });

  // ---- Stock badhao (har item ka apna movement record) ----
  for (const line of totals.items) {
    await applyStockChange({
      businessId,
      itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.PURCHASE,
      qty: line.qty,
      refType: 'Purchase',
      refId: purchase._id,
      note: `${purchaseNo} · ${supplier?.shopName || supplier?.name || 'Cash kharid'}`,
      userId,
    });

    /*
      Aur is maal ki apni KHEP bhi — apni lagat ke saath.

      Lagat me GST nahi jodte: wo sarkar ka paisa hai, aapki lagat nahi (aur
      wapas bhi mil jata hai). Isliye `taxableValue` — yani discount ke baad,
      GST se pehle wali raqam.

      Tareekh kharid ki hai, aaj ki nahi. Pichhle hafte ka bill aaj entry karo
      to wo khep PURANI hai, aur FIFO me uska number pehle aana chahiye.
    */
    await khepBanao({
      businessId,
      itemId: line.itemId,
      qty: line.qty,
      unitCost: line.qty > 0 ? round2(line.taxableValue / line.qty) : 0,
      source: 'PURCHASE',
      refType: 'Purchase',
      refId: purchase._id,
      refNo: purchaseNo,
      date: purchase.purchaseDate,
      userId,
    });
  }

  // ---- Item ka purchase price update (naya rate mila to) ----
  if (payload.updatePurchasePrice !== false) {
    for (const line of totals.items) {
      const unitCost = round2(line.taxableValue / line.qty);
      const old = itemMap.get(String(line.itemId))?.purchasePrice;
      if (unitCost > 0 && unitCost !== old) {
        await Item.updateOne({ _id: line.itemId, businessId }, { purchasePrice: unitCost });
      }
    }
  }

  // ---- Khata: supplier ka hisaab badha ----
  // Supplier hi na ho to khata banta hi nahi — dena kisko hai?
  if (supplier) {
    await postEntry({
      businessId, partyId: supplier._id, type: LEDGER_TYPES.PURCHASE,
      debit: totals.grandTotal,
      date: purchase.purchaseDate,
      refType: 'Purchase', refId: purchase._id, refNo: purchaseNo,
      note: payload.supplierBillNo ? `Bill ${payload.supplierBillNo}` : 'Maal aaya',
      userId,
    });

    /*
      ---- Turant kuch paisa diya to uski POORI entry ----

      Pehle yahan sirf khate me ek line jati thi, Payment ka record banta hi
      nahi tha. Nateeja: supplier ko diya hua paisa Payment page pe kahin
      dikhta hi nahi tha. Dukaandaar "aaj kitna paisa gaya" dekhne jata to
      wahan aadha sach milta — jo bill ke saath gaya wo gayab.

      Ab wahi Payment banti hai jo haath se banai jati hai — bas uspe
      `sourcePurchaseId` ka nishaan hai, taaki purchase mitane par yahi
      payment bhi hate aur koi anaath entry na bache.

      Khata entry ab bhi `refType: 'Purchase'` hai — jaan-boojh kar. Purane
      data ki entriyan bhi wahi hain, aur `deletePurchase` unhi ko ulta karta
      hai. Naya refType daalne se purana data ka reversal toot jata.
    */
    if (paidAmount > 0) {
      await postEntry({
        businessId, partyId: supplier._id, type: LEDGER_TYPES.PAYMENT_OUT,
        credit: paidAmount,
        date: purchase.purchaseDate,
        refType: 'Purchase', refId: purchase._id, refNo: purchaseNo,
        note: 'Purchase ke saath diya',
        userId,
      });

      const { number: paymentNo } = await Counter.nextNumber({
        businessId, key: COUNTER_KEYS.PAYMENT, prefix: 'PAY',
        date: purchase.purchaseDate,
      });

      await Payment.create({
        businessId, partyId: supplier._id, paymentNo,
        date: purchase.purchaseDate,
        direction: 'OUT',
        amount: paidAmount,
        mode: payload.paymentMode || 'CASH',
        status: 'confirmed',
        confirmedAt: new Date(),
        confirmedBy: userId,
        // Is kharid pe hi laga — allocation likhi hui, taaki hisaab saaf rahe
        allocations: [{ invoiceId: purchase._id, amount: paidAmount }],
        againstInvoiceIds: [purchase._id],
        sourcePurchaseId: purchase._id,
        note: `${purchaseNo} ke saath`,
        recordedBy: userId,
      });
    }

    /*
      SUPPLIER KE PAAS HAMARA PAISA JAMA HO TO WO ISI KHARID PE LAG JAYE.

      Bill wali taraf jo bug tha (jama paisa pada rehta tha aur bill "udhaar"
      dikhta rehta tha), bilkul wahi is taraf bhi tha — bas yahan to koi tick
      bhi nahi tha, rasta hi nahi tha. Advance de kar maal mangwana normal
      dhanda hai: paisa pehle jata hai, maal baad me aata hai. Us maal ka bill
      aaye to "dena hai" me nahi baithna chahiye, wo to pehle hi diya ja chuka.
    */
    await sweepAdvance(businessId, supplier._id, { preferId: purchase._id });
  }

  return getPurchase(businessId, purchase._id);
}

/* ---------------------------------------------------------------- delete */

/**
 * Purchase delete = poora ulta. Stock wapas ghatega aur khata bhi ulta hoga.
 * Agar wo maal bik chuka hai (stock kam pad raha hai) to delete block ho jayega.
 */
export async function deletePurchase(businessId, id, userId) {
  const purchase = await Purchase.findOne({ _id: id, businessId });
  if (!purchase) throw ApiError.notFound('Purchase nahi mili');

  /*
    Is kharid ka maal wapas bheja ja chuka ho to delete nahi.

    `soldLots` wali jaanch ise nahi pakadti: purchase return `khepNikalo` se
    FIFO pe chalta hai, yaani purani khep pehle katti hai aur ISI purchase ki
    khep chhuti reh jati hai. Wahi pehra `cancelInvoice` me pehle se hai —
    yahan chhoot gaya tha.
  */
  const pNote = await ReturnNote.findOne({
    businessId, type: RETURN_TYPES.PURCHASE_RETURN, purchaseId: purchase._id,
  }).select('returnNo').lean();
  if (pNote) {
    throw ApiError.badRequest(
      `Is kharid ka maal wapas bheja ja chuka hai (${pNote.returnNo}) — pehle wo debit note hatayein`,
    );
  }

  // Pehle check: kya sabka stock wapas nikala ja sakta hai?
  const itemIds = purchase.items.map((i) => i.itemId);
  const items = await Item.find({ _id: { $in: itemIds }, businessId }).select('name stockQty unit').lean();
  const stockMap = new Map(items.map((i) => [String(i._id), i]));

  for (const line of purchase.items) {
    const item = stockMap.get(String(line.itemId));
    if (item && item.stockQty < line.qty) {
      throw ApiError.badRequest(
        `${item.name} ka stock ab sirf ${item.stockQty} ${item.unit} hai, ` +
        `is purchase me ${line.qty} aaya tha — pehle wala maal bik chuka hai, isliye delete nahi ho sakta`
      );
    }
  }

  /*
    Doosri, ZYADA SAKHT jaanch: ISI kharid ka maal bika hai ya nahi.

    Upar wali jaanch sirf ginti dekhti hai, aur usme ek chhed hai: 10 kharido,
    10 bech do, 10 aur kharido — ab item ka stock 10 hai, isliye pehli kharid
    delete "ho sakti" thi. Par jo maal bika wo PEHLI wali khep ka tha, aur uski
    lagat un bill pe jam chuki hai. Us kharid ko mita dena us bill ke munafe ko
    hawa me latka deta.

    Khep khud batati hai ki usme se kitna nikal chuka hai — wahi asli jawab hai.
  */
  // Ginti JS me — `$expr` har jagah nahi chalta, aur khep waise bhi ginti ki
  // hoti hain (ek kharid me jitne item, utni)
  const myLots = await StockLot.find({ businessId, refType: 'Purchase', refId: purchase._id })
    .select('itemId qty remaining').lean();
  const soldLots = myLots.filter((l) => round2(l.remaining) < round2(l.qty));

  if (soldLots.length) {
    const first = soldLots[0];
    const item = stockMap.get(String(first.itemId));
    throw ApiError.badRequest(
      `${item?.name || 'Is item'} ka ${round2(first.qty - first.remaining)} ${item?.unit || ''} `
      + 'isi kharid me se bik chuka hai — uski lagat bill pe chadh chuki hai, isliye ye kharid delete nahi ho sakti'
    );
  }

  // Stock wapas nikalo
  //
  // Dono record — "maal aaya" aur "maal wapas gaya" — bane rehte hain.
  // Pehle yahan ke baad `StockMovement.deleteMany({ refType: 'Purchase', refId })`
  // chalta tha jo abhi banaya hua reversal bhi uda deta tha. Nateeja: item ka
  // stock 10 kam ho jata tha aur history me uska koi nishaan hi nahi hota —
  // "stock kahan gaya" ka jawab kabhi nahi milta tha. Isliye ab kuch delete
  // nahi hota; history saaf saaf dikhati hai ki maal aaya tha aur wapas gaya.
  for (const line of purchase.items) {
    await applyStockChange({
      businessId, itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.PURCHASE_RETURN,
      qty: -line.qty,
      refType: 'Purchase', refId: purchase._id,
      note: `${purchase.purchaseNo} delete hui`,
      userId,
    });
  }

  // Is kharid ki khep bhi hat jaye — warna godown me lagat ka bhoot reh jata
  await khepHatao({ businessId, refType: 'Purchase', refId: purchase._id });

  // Khata ulta karo
  await reverseEntriesFor({ businessId, refType: 'Purchase', refId: purchase._id, userId });

  /*
    Kharid ke saath bani payment bhi hategi.

    Uski khata entry `refType: 'Purchase'` wali hai, jo upar wali line pehle
    hi ulta chuki hai — isliye yahan sirf Payment ka record hatana hai. Dobara
    ledger chhedne se ek hi credit do baar ulta ho jata.
  */
  await Payment.deleteMany({ businessId, sourcePurchaseId: purchase._id });

  /*
    Jo payment ALAG SE banayi gayi thi aur is purchase pe lagi thi — wo delete
    nahi hoti (paisa to sach me gaya tha). Bas is purchase ka hissa hata kar
    wo paisa doosri khuli purchase pe laga diya jata hai, aur bacha to jama
    ban jata hai. Bilkul wahi jo `releaseInvoiceFromPayments` bill wali taraf
    karta hai — yahan wo jodidar tha hi nahi, aur wo paisa kahin lagta hi nahi
    tha.
  */
  const stuck = await Payment.find({
    businessId,
    status: PAYMENT_STATUS.CONFIRMED,
    sourcePurchaseId: { $ne: purchase._id },
    'allocations.invoiceId': purchase._id,
  });

  for (const pay of stuck) {
    const rows = (pay.allocations || []).filter((a) => a.invoiceId);
    const freed = round2(rows
      .filter((a) => String(a.invoiceId) === String(purchase._id))
      .reduce((sum, a) => sum + (a.amount || 0), 0));

    pay.allocations = rows.filter((a) => String(a.invoiceId) !== String(purchase._id));

    if (freed > 0) {
      const spread = await applyCredit('Purchase', businessId, pay.partyId, freed);
      pay.allocations = [
        ...pay.allocations,
        ...spread.allocations.map((a) => ({ invoiceId: a.docId, amount: a.amount })),
      ];
    }
    pay.againstInvoiceIds = pay.allocations.map((a) => a.invoiceId);
    await pay.save();
  }

  const no = purchase.purchaseNo;
  await purchase.deleteOne();

  return { deleted: true, message: `${no} delete ho gayi — stock aur khata dono wapas theek kar diye` };
}

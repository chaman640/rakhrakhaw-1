import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import {
  PARTY_TYPES, STOCK_MOVEMENT_TYPES, LEDGER_TYPES, COUNTER_KEYS,
  ORDER_STATUS, NOTIFICATION_TYPES, PAYMENT_STATUS,
} from '../config/constants.js';
import { round2 } from '../utils/money.js';
import { getFinancialYear } from '../utils/financialYear.js';
import { amountInWords } from '../utils/amountInWords.js';
import {
  Invoice, Order, Party, Item, Business, Counter, StockMovement, Payment, ReturnNote,
} from '../models/index.js';
import { scopeByParty, isScoped, canSeeDoc, ownPartyIds, toObjectIds } from '../utils/scope.js';
import { assertInvoiceWithinLimits } from '../utils/limits.js';
import { computeInvoice, decideTaxType, hsnSummary } from './gst.service.js';
import { applyStockChange } from './stock.service.js';
import { postEntry, reverseEntriesFor } from './ledger.service.js';
import { releaseInvoiceFromPayments, removeInlinePayments } from './payment.service.js';
import { resolveRates } from './rate.service.js';
import { notifyRetailer } from './notification.service.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ------------------------------------------------------------------ list */

export async function listInvoices(businessId, q, viewer = null) {
  let filter = { businessId };
  if (q.status === 'active') filter.isCancelled = false;
  else if (q.status === 'cancelled') filter.isCancelled = true;
  if (q.partyId) filter.partyId = q.partyId;
  if (q.paymentStatus !== 'all') filter.paymentStatus = q.paymentStatus;

  if (q.from || q.to) {
    filter.invoiceDate = {};
    if (q.from) filter.invoiceDate.$gte = q.from;
    if (q.to) { const to = new Date(q.to); to.setHours(23, 59, 59, 999); filter.invoiceDate.$lte = to; }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    const parties = await Party.find({ businessId, $or: [{ name: rx }, { shopName: rx }, { phone: rx }] })
      .select('_id').lean();
    filter.$or = [{ invoiceNo: rx }, { partyId: { $in: parties.map((p) => p._id) } }];
  }

  /*
    "SIRF APNA KAAM" WALI HADD.

    Ye line pehle yahan thi hi nahi — aur wo ek asli chhed tha. Ek bill KHOLNE
    par to rok lagti thi (`getInvoice` me `canSeeDoc`), par LIST me sabke bill
    aa jate the: doosre salesman ke retailer ka naam, uski rakam, uska bill
    number — sab. Aadmi ko bill kholne ki zarurat hi nahi thi, list se hi pata
    chal jata tha ki kaun kitna kharid raha hai.

    `alsoMine` isliye ki jo bill usne KHUD banaya hai wo bhi dikhna chahiye,
    chahe wo party baad me kisi aur ke naam ho gayi ho — warna apna hi kaam
    gayab dikhta hai.
  */
  filter = await scopeByParty(filter, businessId, viewer, { alsoMine: true });

  const skip = (q.page - 1) * q.limit;
  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort(q.sort.startsWith('-') ? { [q.sort.slice(1)]: -1 } : { [q.sort]: 1 })
      .skip(skip).limit(q.limit)
      .populate('partyId', 'name shopName phone')
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    invoices: invoices.map((i) => ({
      ...i,
      party: i.partyId ? { _id: i.partyId._id, name: i.partyId.shopName || i.partyId.name, phone: i.partyId.phone } : null,
      partyId: i.partyId?._id || i.partyId,
      itemCount: i.items?.length || 0,
    })),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      dayTotals: await dayTotalsFor(invoices, filter, q),
    },
  };
}

/**
 * "Aaj · ₹42,500 · 8 bill" wali header line ka jod.
 *
 * Ye jod PAGE KI ROWS SE NAHI GINA JATA — aur wahi is function ke hone ki
 * wajah hai. 25 bill ke baad page toot ta hai, aur wo toot aksar din ke beech
 * me padta hai. Page pe gino to aakhri din ka jod aadha dikhega, poore vishwas
 * ke saath. Aisa number na dikhana behtar hai, galat dikhane se.
 *
 * Isliye page pe jo din aaye hain SIRF UNKA poora jod database se dobara
 * poochte hain — usi chhalni (filter) ke saath, taaki "sirf apna kaam" wali
 * hadd aur filter dono waise ke waise lagein.
 *
 * Tareekh ke alawa kisi aur kram (jaise rakam) pe din ka jod ka koi matlab
 * nahi — rows aage-peeche ho jati hain — isliye tab `null` bhejte hain aur
 * client seedhi list dikhata hai.
 */
async function dayTotalsFor(invoices, filter, q) {
  if (!invoices.length) return [];
  if (q.sort !== '-invoiceDate' && q.sort !== 'invoiceDate') return null;

  const times = invoices.map((i) => new Date(i.invoiceDate).getTime());
  const first = new Date(Math.min(...times)); first.setHours(0, 0, 0, 0);
  const last = new Date(Math.max(...times)); last.setHours(23, 59, 59, 999);

  /*
    Yahan id ko HAATH SE ObjectId banana padta hai.

    `find()` me Mongoose khud badal deta hai, isliye upar wali chhalni string
    id ke saath bhi theek chalti hai. `$match` nahi badalta — string kabhi
    ObjectId se match hoti hi nahi, aur jawab bina kisi error ke KHALI aa jata
    hai. Wahi galti Part 15 step 2 me dashboard aur report me pakdi thi
    (`scopeMatch` usi ke liye bana tha); yahan `partyId` bhi seedha query se
    aati hai, isliye dono badalte hain.
  */
  const match = {
    ...filter,
    businessId: new mongoose.Types.ObjectId(String(filter.businessId)),
    invoiceDate: { $gte: first, $lte: last },
  };
  if (match.partyId) match.partyId = new mongoose.Types.ObjectId(String(match.partyId));

  const rows = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } },
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

export async function getStats(businessId, viewer = null) {
  const bid = new mongoose.Types.ObjectId(businessId);
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Ginti bhi utni hi jitna data dikhta hai
  const mine = isScoped(viewer)
    ? { $or: [
      { partyId: { $in: toObjectIds(await ownPartyIds(businessId, viewer)) } },
      { createdBy: viewer._id },
    ] }
    : {};

  const [[all], [month], [today]] = await Promise.all([
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, ...mine } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' }, due: { $sum: '$dueAmount' } } },
    ]),
    // `...mine` teeno me — pehle sirf sabse upar wale me tha, isliye "Is
    // mahine" aur "Aaj" wale tile poori dukaan ka jod dikhate the jabki neeche
    // ki list sirf apni. Aadha sach poore jhooth se zyada uljhata hai.
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, ...mine, invoiceDate: { $gte: monthStart } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
    ]),
    Invoice.aggregate([
      { $match: { businessId: bid, isCancelled: false, ...mine, invoiceDate: { $gte: todayStart } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
    ]),
  ]);

  return {
    totalInvoices: all?.count || 0,
    totalAmount: round2(all?.total || 0),
    totalDue: round2(all?.due || 0),
    monthCount: month?.count || 0,
    monthAmount: round2(month?.total || 0),
    todayCount: today?.count || 0,
    todayAmount: round2(today?.total || 0),
  };
}

/**
 * PARTY-WISE SALE — Home page ka doosra tab.
 *
 * "Kisne kitna kharida" ek hi nazar me. Ye aankda report page me bhi hai, par
 * wo `reports` ki ijazat maangta hai — jo salesman ke paas nahi hoti. Aur
 * apne retailer ka hisaab dekhna salesman ka roz ka kaam hai, mahine ki
 * report nahi. Isliye wahi ginti yahan `invoices:view` ke neeche rakhi hai.
 */
export async function salesByParty(businessId, q = {}, viewer = null) {
  const bid = new mongoose.Types.ObjectId(businessId);

  const match = { businessId: bid, isCancelled: false };
  if (q.from || q.to) {
    match.invoiceDate = {};
    if (q.from) match.invoiceDate.$gte = new Date(q.from);
    if (q.to) { const to = new Date(q.to); to.setHours(23, 59, 59, 999); match.invoiceDate.$lte = to; }
  }

  const scoped = isScoped(viewer)
    ? { $or: [
      { partyId: { $in: toObjectIds(await ownPartyIds(businessId, viewer)) } },
      { createdBy: viewer._id },
    ] }
    : {};

  const rows = await Invoice.aggregate([
    { $match: { ...match, ...scoped } },
    {
      $group: {
        _id: '$partyId',
        shopName: { $first: '$partySnapshot.shopName' },
        name: { $first: '$partySnapshot.name' },
        phone: { $first: '$partySnapshot.phone' },
        bills: { $sum: 1 },
        total: { $sum: '$grandTotal' },
        paid: { $sum: '$paidAmount' },
        due: { $sum: '$dueAmount' },
        lastDate: { $max: '$invoiceDate' },
      },
    },
    { $sort: { total: -1 } },
    { $limit: 200 },
  ]);

  return rows.map((r) => ({
    _id: r._id,
    name: r.shopName || r.name || '—',
    subName: r.shopName ? r.name : '',
    phone: r.phone || '',
    bills: r.bills,
    total: round2(r.total),
    paid: round2(r.paid),
    due: round2(r.due),
    lastDate: r.lastDate,
  }));
}

export async function nextNumber(businessId) {
  const business = await Business.findById(businessId).select('invoicePrefix').lean();
  const fy = getFinancialYear();
  const counter = await Counter.findOne({ businessId, key: COUNTER_KEYS.INVOICE, fy }).lean();
  const seq = (counter?.seq || 0) + 1;
  return { preview: `${business?.invoicePrefix || 'INV'}/${fy}/${String(seq).padStart(4, '0')}` };
}

/* --------------------------------------------------------------- get one */

export async function getInvoice(businessId, id, { partyId = null, viewer = null } = {}) {
  const filter = { _id: id, businessId };
  if (partyId) filter.partyId = partyId;

  const invoice = await Invoice.findOne(filter).populate('partyId', 'name shopName phone gstin address').lean();
  if (!invoice) throw ApiError.notFound('Bill nahi mila');

  // URL me id badal kar doosre ka bill na khul jaye
  if (viewer && !(await canSeeDoc(
    { partyId: invoice.partyId?._id || invoice.partyId, createdBy: invoice.createdBy },
    businessId, viewer
  ))) {
    throw ApiError.notFound('Bill nahi mila');
  }

  return {
    ...invoice,
    party: invoice.partyId,
    partyId: invoice.partyId?._id || invoice.partyId,
    hsnSummary: invoice.gstEnabled ? hsnSummary(invoice.items, invoice.taxType) : [],
    amountInWords: amountInWords(invoice.grandTotal),
  };
}

/* ------------------------------------------------- order se prefill data */

/** "Bill banayein" dabane par form me kya bharna hai */
export async function prefillFromOrder(businessId, orderId) {
  const order = await Order.findOne({ _id: orderId, businessId })
    .populate('partyId', 'name shopName phone gstin address').lean();
  if (!order) throw ApiError.notFound('Order nahi mila');
  if (order.invoiceId) throw ApiError.badRequest('Is order ka bill pehle se ban chuka hai');
  if (order.status === ORDER_STATUS.CANCELLED) throw ApiError.badRequest('Cancel order ka bill nahi banta');

  const items = await Item.find({ _id: { $in: order.items.map((i) => i.itemId) }, businessId })
    .select('name hsn gstRate unit stockQty warrantyMonths warrantyNote').lean();
  const map = new Map(items.map((i) => [String(i._id), i]));

  return {
    orderId: order._id,
    orderNo: order.orderNo,
    party: order.partyId,
    partyId: order.partyId?._id,
    items: order.items.map((l) => {
      const item = map.get(String(l.itemId));
      return {
        itemId: l.itemId,
        name: l.name,
        unit: l.unit,
        qty: l.qty,
        rate: l.rate,                     // order ka rate hi chalega
        discount: 0,
        hsn: item?.hsn || '',
        warrantyMonths: item?.warrantyMonths || 0,
        gstRate: item?.gstRate ?? 0,
        stockQty: item?.stockQty ?? 0,
      };
    }),
  };
}

/* ---------------------------------------------------------------- create */

/**
 * Aadhe bane hue bill ko poori tarah mitana.
 *
 * `createInvoice` beech me fail ho jaye to ye chalta hai. Ulte order me:
 * payment → khata → stock → bill. Har kadam try/catch me alag hai, taaki ek
 * kadam fail hone se baaki kadam na ruk jayen — aadha safai poori gadbad se
 * bhi buri hoti hai.
 *
 * Stock wapas karte waqt movement DELETE nahi hote (Batch 4 wala niyam) —
 * history saaf saaf dikhati hai ki maal gaya tha aur wapas aa gaya.
 */
async function undoHalfInvoice(businessId, state, userId) {
  const { invoice, doneStock = [], inlinePayment, ledgerPosted, invoiceNo } = state;

  const step = async (naam, fn) => {
    try { await fn(); } catch (e) {
      console.error(`[invoice] ${invoiceNo} ka rollback — "${naam}" nahi ho paya:`, e.message);
    }
  };

  if (inlinePayment) {
    await step('bill ke saath wali payment hatana', async () => {
      await reverseEntriesFor({ businessId, refType: 'Payment', refId: inlinePayment._id, userId });
      await Payment.deleteOne({ _id: inlinePayment._id, businessId });
    });
  }

  if (ledgerPosted) {
    await step('khata ulta karna', () =>
      reverseEntriesFor({ businessId, refType: 'Invoice', refId: invoice._id, userId }));
  }

  for (const line of doneStock) {
    await step(`${line.name} ka stock wapas`, () => applyStockChange({
      businessId,
      itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.SALE_RETURN,
      qty: line.qty,
      refType: 'Invoice',
      refId: invoice._id,
      note: `${invoiceNo} adhoora reh gaya — stock wapas`,
      userId,
      allowNegative: true,
    }));
  }

  await step('adhoora bill hatana', () => Invoice.deleteOne({ _id: invoice._id, businessId }));
}

export async function createInvoice(businessId, payload, userId, viewer = null) {
  const business = await Business.findById(businessId).lean();
  if (!business) throw ApiError.notFound('Business nahi mila');

  const party = await Party.findOne({
    _id: payload.partyId, businessId, type: PARTY_TYPES.RETAILER,
  }).lean();
  if (!party) throw ApiError.badRequest('Retailer nahi mila');

  let order = null;
  if (payload.orderId) {
    order = await Order.findOne({ _id: payload.orderId, businessId });
    if (!order) throw ApiError.badRequest('Order nahi mila');
    if (order.invoiceId) throw ApiError.badRequest('Is order ka bill pehle se ban chuka hai');
    if (String(order.partyId) !== String(party._id)) {
      throw ApiError.badRequest('Order kisi aur retailer ka hai');
    }
  }

  // Items ki detail
  const itemIds = payload.items.map((i) => i.itemId);
  const dbItems = await Item.find({ _id: { $in: itemIds }, businessId })
    .select('name hsn gstRate unit stockQty warrantyMonths warrantyNote purchasePrice').lean();
  const itemMap = new Map(dbItems.map((i) => [String(i._id), i]));

  const lines = payload.items.map((l, idx) => {
    const item = itemMap.get(String(l.itemId));
    if (!item) throw ApiError.badRequest(`Row ${idx + 1}: item nahi mila`);
    return {
      itemId: item._id,
      name: item.name,
      hsn: item.hsn || '',
      unit: item.unit,
      warrantyMonths: item.warrantyMonths || 0,
      warrantyNote: item.warrantyNote || '',
      // Aaj ki lagat bill ke saath jam jati hai — Invoice model me wajah likhi hai
      costPrice: item.purchasePrice || 0,
      qty: l.qty,
      rate: l.rate,
      discount: l.discount || 0,
      gstRate: l.gstRate ?? item.gstRate ?? 0,
    };
  });

  /**
   * Stock pehle se check kar lo — aadha bill banakar fail hona theek nahi.
   *
   * Ek hi item do line me daal diya ho to dono JOD kar dekhna padta hai. Pehle
   * har line alag dekhi jati thi: stock 10 tha, do line me 6+6 daal do, dono
   * line alag alag paas ho jati thi aur bill ban jata tha.
   */
  const wantedByItem = new Map();
  for (const line of lines) {
    const key = String(line.itemId);
    wantedByItem.set(key, round2((wantedByItem.get(key) || 0) + Number(line.qty || 0)));
  }
  for (const [itemId, wanted] of wantedByItem) {
    const item = itemMap.get(itemId);
    if (item.stockQty < wanted) {
      throw ApiError.badRequest(
        `${item.name} ka stock sirf ${item.stockQty} ${item.unit} hai, bill me ${wanted} lagaya hai`
      );
    }
  }

  const { documentType, taxType } = decideTaxType({
    gstEnabled: business.gstEnabled,
    businessStateCode: business.address?.stateCode,
    partyStateCode: party.address?.stateCode,
  });

  let totals;
  try {
    totals = computeInvoice(lines, {
      gstEnabled: business.gstEnabled,
      taxType,
      extraDiscount: payload.extraDiscount || 0,
    });
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }

  const paidAmount = round2(Math.min(payload.paidAmount || 0, totals.grandTotal));
  const dueAmount = round2(totals.grandTotal - paidAmount);

  // ---- Paise ki hadd ----
  //
  // Ye jaanch YAHAN hai — number lene se aur stock ghatane se PEHLE. Baad me
  // karte to bill number kharch ho jata aur stock chhu liya jata, aur phir
  // sab ulta karna padta. Sabse sasta rokna wo hai jo shuru me ruk jaye.
  assertInvoiceWithinLimits(viewer, totals, paidAmount);

  const { number: invoiceNo } = await Counter.nextNumber({
    businessId, key: COUNTER_KEYS.INVOICE,
    prefix: business.invoicePrefix || 'INV',
    date: payload.invoiceDate || new Date(),
  });

  const invoice = await Invoice.create({
    businessId,
    partyId: party._id,
    orderId: order?._id || null,
    invoiceNo,
    invoiceDate: payload.invoiceDate || new Date(),

    gstEnabled: Boolean(business.gstEnabled),   // SNAPSHOT — baad me GST le liya to purana bill na badle
    documentType,
    taxType,
    placeOfSupplyStateCode: party.address?.stateCode || business.address?.stateCode || '',

    items: totals.items,
    subTotal: totals.subTotal,
    discountTotal: totals.discountTotal,
    taxableTotal: totals.taxableTotal,
    cgstTotal: totals.cgstTotal,
    sgstTotal: totals.sgstTotal,
    igstTotal: totals.igstTotal,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,

    paidAmount,
    dueAmount,
    paymentStatus: paidAmount <= 0 ? 'unpaid' : paidAmount >= totals.grandTotal ? 'paid' : 'partial',

    businessSnapshot: {
      name: business.name, phone: business.phone, gstin: business.gstin,
      logoUrl: business.logoUrl, address: business.address,
      // Bill pe QR aur "account me daal do" — dono isi snapshot se chhapte hain
      upiId: business.upiId || '', upiName: business.upiName || '',
      bankName: business.bankName || '',
      bankAccountName: business.bankAccountName || '',
      bankAccountNumber: business.bankAccountNumber || '',
      bankIfsc: business.bankIfsc || '',
    },
    partySnapshot: {
      name: party.name, shopName: party.shopName, phone: party.phone,
      gstin: party.gstin, address: party.address,
    },

    notes: payload.notes,
    termsAndConditions: payload.termsAndConditions ?? business.termsAndConditions ?? '',
    createdBy: userId,
  });

  /**
   * YAHAN SE AAGE SAB "SAB YA KUCH NAHI" HAI.
   *
   * Bill ban chuka hai. Ab stock ghatega, khata badhega, shayad payment banegi.
   * Beech me kuch fail ho jaye (aksar: doosre bill ne wahi stock utha liya) to
   * pehle kya hota tha — bill list me pada rehta, do item ka stock kat chuka hota,
   * aur khate me kuch aata hi nahi. User ko ek bill dikhta jo usne banaya hi nahi tha.
   *
   * Ab har kadam yaad rakhte hain aur gadbad hone par ULTE order me sab wapas
   * karke asli error aage bhej dete hain.
   *
   * (MongoDB transaction क्यों नahi: uske liye `session` ko stock.service,
   * ledger.service aur Counter — teeno ke andar tak le jana padta, aur wo teeno
   * poore project ke "ek hi darwaza" wale service hain. Upar wala stock check
   * 99% case pehle hi rok deta hai; ye rollback bache hue case ka jaal hai.)
   */
  const doneStock = [];
  let inlinePayment = null;
  let ledgerPosted = false;

  try {
    // ---- YAHIN STOCK GHATTA HAI (order pe nahi) ----
    for (const line of totals.items) {
      await applyStockChange({
        businessId,
        itemId: line.itemId,
        type: STOCK_MOVEMENT_TYPES.SALE,
        qty: -line.qty,
        refType: 'Invoice',
        refId: invoice._id,
        note: `${invoiceNo} · ${party.shopName || party.name}`,
        userId,
      });
      doneStock.push(line);
    }

    // ---- Khata: retailer ka udhaar badha ----
    await postEntry({
      businessId, partyId: party._id, type: LEDGER_TYPES.INVOICE,
      debit: totals.grandTotal,
      date: invoice.invoiceDate,
      refType: 'Invoice', refId: invoice._id, refNo: invoiceNo,
      note: order ? `Order ${order.orderNo}` : 'Bill',
      userId,
    });
    ledgerPosted = true;

    // ---- Turant paisa mila to payment bhi ----
    if (paidAmount > 0) {
      const { number: paymentNo } = await Counter.nextNumber({
        businessId, key: COUNTER_KEYS.PAYMENT, prefix: 'PAY',
      });

      const payment = await Payment.create({
        businessId, partyId: party._id, paymentNo,
        date: invoice.invoiceDate,
        direction: 'IN',
        amount: paidAmount,
        mode: payload.paymentMode || 'CASH',
        status: PAYMENT_STATUS.CONFIRMED,
        confirmedAt: new Date(),
        confirmedBy: userId,
        allocations: [{ invoiceId: invoice._id, amount: paidAmount }],
        againstInvoiceIds: [invoice._id],
        sourceInvoiceId: invoice._id,      // bill cancel hoga to yahi payment hategi
        note: `${invoiceNo} ke saath`,
        recordedBy: userId,
      });
      inlinePayment = payment;

      /**
       * DHYAN: is entry ka refType 'Payment' hai, 'Invoice' nahi.
       *
       * Pehle yahan 'Invoice' likha tha — aur `deletePayment` 'Payment' dhoondhta tha.
       * Isliye ye payment delete karne pe bill to theek ho jata tha par khate me
       * credit pada reh jata tha (bill 10000 maangta, khata 7000 dikhata).
       * Ab har payment ki entry ek jaisi banti hai.
       */
      await postEntry({
        businessId, partyId: party._id, type: LEDGER_TYPES.PAYMENT_IN,
        credit: paidAmount,
        date: invoice.invoiceDate,
        refType: 'Payment', refId: payment._id, refNo: paymentNo,
        note: `${invoiceNo} ke saath mila`,
        userId,
      });
    }

    // ---- Order ko bill se jodo aur delivered kar do ----
    if (order) {
      order.invoiceId = invoice._id;
      if (![ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED].includes(order.status)) {
        order.status = ORDER_STATUS.DELIVERED;
        order.statusHistory.push({
          status: ORDER_STATUS.DELIVERED, at: new Date(), byUserId: userId,
          note: `Bill ${invoiceNo} ban gaya`,
        });
      }
      await order.save();
    }
  } catch (err) {
    // Jo jo ho chuka tha, ulta kar do — aur asli error hi aage bhejo
    await undoHalfInvoice(businessId, {
      invoice, doneStock, inlinePayment, ledgerPosted, invoiceNo,
    }, userId);
    throw err;
  }

  await notifyRetailer(businessId, party._id, {
    type: NOTIFICATION_TYPES.ORDER_STATUS,
    title: `Bill ban gaya — ${invoiceNo}`,
    body: dueAmount > 0 ? `Kul ${totals.grandTotal}, baaki ${dueAmount}` : `Kul ${totals.grandTotal} — poora ho gaya`,
    link: `/my-bills/${invoice._id}`,
    data: { invoiceId: invoice._id },
  });

  return getInvoice(businessId, invoice._id);
}

/* ---------------------------------------------------------------- cancel */

/**
 * Bill delete nahi hota — cancel hota hai. Number wahin rehta hai (legal record),
 * par stock wapas aa jata hai aur khata ulta ho jata hai.
 */
export async function cancelInvoice(businessId, id, { reason }, userId, viewer = null) {
  if (isScoped(viewer)) {
    const doc = await Invoice.findOne({ _id: id, businessId }).select('partyId createdBy').lean();
    if (!(await canSeeDoc(doc, businessId, viewer))) throw ApiError.notFound('Bill nahi mila');
  }
  const invoice = await Invoice.findOne({ _id: id, businessId });
  if (!invoice) throw ApiError.notFound('Bill nahi mila');
  if (invoice.isCancelled) throw ApiError.badRequest('Ye bill pehle se cancel hai');

  /**
   * Is bill ka maal pehle se wapas aa chuka ho to cancel nahi karne dena.
   *
   * Warna dono ka reversal jud jata hai: credit note ne 4 pcs wapas kiye the aur
   * cancel poore 10 wapas jod deta — stock me 4 ka phantom aur khate me 4000 ka
   * jhootha advance ban jata tha.
   *
   * (Ulta case pehle se roka hua hai: cancel bill ka return nahi ban sakta.)
   */
  const note = await ReturnNote.findOne({ businessId, invoiceId: invoice._id })
    .select('returnNo').lean();
  if (note) {
    throw ApiError.badRequest(
      `Is bill ka maal wapas aa chuka hai (${note.returnNo}) — pehle wo credit note hatayein, phir bill cancel hoga`
    );
  }

  // Stock wapas
  for (const line of invoice.items) {
    await applyStockChange({
      businessId, itemId: line.itemId,
      type: STOCK_MOVEMENT_TYPES.SALE_RETURN,
      qty: line.qty,
      refType: 'Invoice', refId: invoice._id,
      note: `${invoice.invoiceNo} cancel hua`,
      userId,
    });
  }

  const paidBefore = round2(invoice.paidAmount || 0);

  // Bill ke SAATH jo paisa aaya tha — wo entry bill ke saath hi hategi.
  // (Ye reverse karne se PEHLE, taaki purane data me uski ledger entry mil jaye.)
  await removeInlinePayments(businessId, invoice, userId);

  // Bill ko cancel mark karo — iske BAAD hi baaki paisa dobara baantna hai,
  // warna wo isi cancel hue bill pe wapas lag jayega.
  invoice.isCancelled = true;
  invoice.notes = [invoice.notes, `CANCELLED: ${reason || 'wajah nahi batayi'}`].filter(Boolean).join(' | ');
  invoice.paymentStatus = 'unpaid';
  invoice.paidAmount = 0;
  invoice.dueAmount = 0;
  await invoice.save();

  /**
   * Baad me alag se aayi payments jo is bill pe lagi thi — wo DELETE nahi hoti.
   * Paisa to sach me aaya tha. Bas is bill ka hissa hata kar wo paisa doosre
   * khule bill pe laga diya jata hai, aur bacha to advance ban jata hai.
   *
   * Pehle yahan `Payment.deleteMany({ againstInvoiceIds })` tha — wo mahine baad
   * aayi payment ko bhi uda deta tha aur uski khata entry pichhe chhod deta tha.
   */
  const released = await releaseInvoiceFromPayments(businessId, invoice, paidBefore);

  // Bill ka apna khata entry ulta
  await reverseEntriesFor({ businessId, refType: 'Invoice', refId: invoice._id, userId });

  // Order se link hata do taaki naya bill ban sake
  if (invoice.orderId) {
    await Order.updateOne({ _id: invoice.orderId, businessId }, { invoiceId: null });
  }

  await notifyRetailer(businessId, invoice.partyId, {
    type: NOTIFICATION_TYPES.ORDER_STATUS,
    title: `Bill cancel — ${invoice.invoiceNo}`,
    body: reason || 'Wholesaler ne bill cancel kar diya',
    link: `/my-bills/${invoice._id}`,
    data: { invoiceId: invoice._id },
  });

  return {
    cancelled: true,
    released,
    message: released > 0
      ? `${invoice.invoiceNo} cancel ho gaya — stock aur khata theek kar diye. `
        + `Is bill pe lage ${released} doosre bill pe laga diye (ya advance me jama hain).`
      : `${invoice.invoiceNo} cancel ho gaya — stock aur khata dono wapas theek kar diye`,
  };
}

/* --------------------------------------------------------- retailer side */

export async function listMyInvoices(businessId, partyId, q) {
  return listInvoices(businessId, { ...q, partyId: String(partyId) });
}

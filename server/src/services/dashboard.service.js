import mongoose from 'mongoose';
import { round2 } from '../utils/money.js';
import { partyHisaab, businessHisaab } from './balance.service.js';
import { ORDER_STATUS, PARTY_TYPES } from '../config/constants.js';
import { userCan } from '../middleware/auth.js';
import { scopeMatch, scopeByParty, scopeParties } from '../utils/scope.js';
import {
  Invoice, Order, Party, Item, Payment, Purchase, Notification, Business,
} from '../models/index.js';
import { expenseDashboard } from './expense.service.js';

/**
 * Dukaan kholte hi jo dikhna chahiye.
 *
 * Sab kuch ek hi call me — mobile pe 6 alag request bhejna theek nahi.
 */

const oid = (v) => new mongoose.Types.ObjectId(v);

function boundaries() {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
  const yEnd = new Date(yStart); yEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  return { todayStart, todayEnd, yStart, yEnd, monthStart };
}

/*
  CHART KITNE DIN KA — dukaandaar chunta hai, hum tay nahi karte.

  Pehle 14 din pakke the. Wo ek achha default hai par jawab sirf ek sawal ka
  deta hai: "is hafte kaisa chal raha hai". "Pichhle saal is waqt kya tha" ya
  "teen mahine me dhandha badha ya ghata" — un dono ke liye chart bekaar tha,
  aur wahi sawal mahine ke aakhir me sabse zyada poochha jata hai.

  Ek pech: 365 alag-alag din ka chart padha hi nahi jata — bindiyan itni paas
  aa jati hain ki line ek dhabba ban jati hai. Isliye lambe arse me din ki
  jagah HAFTE ya MAHINE jodte hain. Chart ki har bindiya utna hi bada tukda
  dikhati hai jitna aankh se pakda ja sake.
*/
const TREND_RANGES = {
  7: { days: 7, bucket: 'day' },
  14: { days: 14, bucket: 'day' },
  30: { days: 30, bucket: 'day' },
  90: { days: 90, bucket: 'week' },
  365: { days: 365, bucket: 'month' },
};

export const trendRangeOf = (days) => TREND_RANGES[Number(days)] || TREND_RANGES[14];

/**
 * Din wali kataar ko hafte ya mahine me jodo.
 *
 * Har tukde ka `date` uske PEHLE din ka hai — chart pe kram usi se lagta hai,
 * aur click karke aage jana ho to shuruaat ka din haath me hota hai.
 *
 * Aakhri tukda adhoora ho sakta hai (aaj hafte ke beech me hai). Use girate
 * nahi — wahi to sabse taaza baat hai. Bas label me "se" lagakar saaf kar
 * dete hain ki wo abhi chal raha hai.
 */
function bucketTrend(rows, bucket) {
  const out = new Map();
  for (const r of rows) {
    let key;
    let label;
    if (bucket === 'week') {
      const st = new Date(r.d);
      st.setDate(st.getDate() - ((st.getDay() + 6) % 7));   // Somwar
      key = dayKey(st);
      label = st.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } else {
      const st = new Date(r.d.getFullYear(), r.d.getMonth(), 1);
      key = dayKey(st);
      label = st.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
    const cur = out.get(key) || { date: key, label, amount: 0, bills: 0, expense: 0 };
    cur.amount = round2(cur.amount + r.amount);
    cur.bills += r.bills;
    cur.expense = round2(cur.expense + r.expense);
    out.set(key, cur);
  }
  return [...out.values()];
}

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/* ─────────────────────────────────────────────────── wholesaler ka dashboard */

export async function getWholesalerDashboard(businessId, user = null, q = {}) {
  const bid = oid(businessId);
  const { todayStart, todayEnd, yStart, yEnd, monthStart } = boundaries();

  const rangeCfg = trendRangeOf(q.days);
  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - (rangeCfg.days - 1));

  /*
    "SIRF APNA KAAM" WALI HADD — dashboard pe bhi.

    Ye jagah sabse aasani se chhoot jati hai. Bill ki list hadd me aa gayi, par
    dashboard upar hi bata deta tha: "aaj ki sale ₹1,20,000", "sabse zyada
    udhaar — Vinod Traders". Yaani jo list me chhupaya tha, wo pehli hi screen
    pe jod ke roop me dikh raha tha.

    Neeche har ginti do me se ek chhalni se guzarti hai:
      partyScope  — party ki apni list (retailer, udhaar)
      docScope    — bill/payment/order jaisi cheezein (party ya khud banayi hui)

    Item aur stock par koi hadd nahi — maal poori dukaan ka ek hi hota hai.
  */
  const docScope = (match) => scopeMatch(match, businessId, user, { alsoMine: true });
  const partyFilter = (filter) => scopeParties(filter, user);

  const saleSum = async (from, to) => Invoice.aggregate([
    { $match: await docScope({ businessId: bid, isCancelled: false, invoiceDate: { $gte: from, $lte: to } }) },
    { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
  ]);

  const [
    todaySale, yesterdaySale, monthSale,
    todayCollection, monthCollection,
    orderCounts, balances, stockAgg, lowStockItems,
    trendAgg, topItems, topRetailers,
    recentInvoices, recentOrders, recentPayments,
    pendingPayments, pendingRetailers,
    expense, purchaseAgg,
  ] = await Promise.all([
    saleSum(todayStart, todayEnd),
    saleSum(yStart, yEnd),
    saleSum(monthStart, todayEnd),

    Payment.aggregate([
      { $match: await docScope({ businessId: bid, status: 'confirmed', direction: 'IN', date: { $gte: todayStart, $lte: todayEnd } }) },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: await docScope({ businessId: bid, status: 'confirmed', direction: 'IN', date: { $gte: monthStart, $lte: todayEnd } }) },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),

    Order.aggregate([
      { $match: await docScope({ businessId: bid }) },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),

    Party.aggregate([
      { $match: partyFilter({ businessId: bid }) },
      {
        $group: {
          _id: null,
          receivable: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] } },
          /*
            JAMA PAISA — graahak ka paisa jo aapke paas rakha hai.

            Khate me ULTA balance (minus) hi jama paisa hai. Ye number ab tak
            kahin dikhta hi nahi tha: aisi party list se hi gir jati thi
            (`balance > 0` wali chhalni), isliye dukaandaar ko pata hi nahi
            chalta tha ki uske paas kiska kitna paisa pada hai.

            Dhyan: ye KAMAAI NAHI hai. Ye wapas bhi ho sakta hai aur agle bill
            me bhi kat sakta hai — isliye profit me kabhi nahi juda.
          */
          advance: { $sum: { $cond: [{ $lt: ['$balance', 0] }, { $multiply: ['$balance', -1] }, 0] } },
          advanceParties: { $sum: { $cond: [{ $lt: ['$balance', 0] }, 1, 0] } },
          payable: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'supplier'] }, { $gt: ['$balance', 0] }] }, '$balance', 0] } },
          retailers: { $sum: { $cond: [{ $eq: ['$type', 'retailer'] }, 1, 0] } },
          activeRetailers: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'retailer'] }, { $eq: ['$status', 'active'] }] }, 1, 0] } },
        },
      },
    ]),

    Item.aggregate([
      { $match: { businessId: bid, isActive: true } },
      {
        $group: {
          _id: null,
          items: { $sum: 1 },
          stockValue: { $sum: { $multiply: ['$stockQty', '$purchasePrice'] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stockQty', 0] }, 1, 0] } },
          low: { $sum: { $cond: [{ $and: [{ $gt: ['$stockQty', 0] }, { $lte: ['$stockQty', '$lowStockAt'] }] }, 1, 0] } },
        },
      },
    ]),

    Item.find({ businessId, isActive: true, $expr: { $lte: ['$stockQty', '$lowStockAt'] } })
      .sort({ stockQty: 1 }).limit(6).select('name unit stockQty lowStockAt imageUrl').lean(),

    // Pichhle 14 din ka sale — chart ke liye
    Invoice.aggregate([
      { $match: await docScope({ businessId: bid, isCancelled: false, invoiceDate: { $gte: trendStart, $lte: todayEnd } }) },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } },
          amount: { $sum: '$grandTotal' }, bills: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Invoice.aggregate([
      { $match: await docScope({ businessId: bid, isCancelled: false, invoiceDate: { $gte: monthStart } }) },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemId', name: { $first: '$items.name' }, unit: { $first: '$items.unit' },
          qty: { $sum: '$items.qty' }, amount: { $sum: '$items.total' },
        },
      },
      { $sort: { amount: -1 } }, { $limit: 5 },
    ]),

    Invoice.aggregate([
      { $match: await docScope({ businessId: bid, isCancelled: false, invoiceDate: { $gte: monthStart } }) },
      {
        $group: {
          _id: '$partyId', name: { $first: '$partySnapshot.shopName' }, fallback: { $first: '$partySnapshot.name' },
          bills: { $sum: 1 }, amount: { $sum: '$grandTotal' },
        },
      },
      { $sort: { amount: -1 } }, { $limit: 5 },
    ]),

    Invoice.find(await scopeByParty({ businessId, isCancelled: false }, businessId, user, { alsoMine: true }))
      .sort({ createdAt: -1 }).limit(4)
      .select('invoiceNo invoiceDate grandTotal partySnapshot createdAt').lean(),
    Order.find(await scopeByParty({ businessId }, businessId, user, { alsoMine: true }))
      .sort({ createdAt: -1 }).limit(4)
      .select('orderNo status itemsTotal partyId createdAt').populate('partyId', 'name shopName').lean(),
    Payment.find(await scopeByParty({ businessId, status: 'confirmed' }, businessId, user, { alsoMine: true }))
      .sort({ createdAt: -1 }).limit(4)
      .select('paymentNo amount mode direction partyId createdAt').populate('partyId', 'name shopName').lean(),

    Payment.countDocuments(await scopeByParty({ businessId, status: 'pending' }, businessId, user, { alsoMine: true })),
    Party.countDocuments(partyFilter({ businessId, type: PARTY_TYPES.RETAILER, status: 'pending' })),

    // Kharch — aaj ka, mahine ka, aur roz ka (chart me sale ke saath dikhega)
    expenseDashboard(businessId, { todayStart, todayEnd, monthStart, trendStart }, user),

    /*
      "IS MAHINE MAINE KITNA KHAREEDA" (item 16).

      Dashboard poori tarah BECHNE ki taraf jhuka hua tha — sale, munafa,
      udhaar, stock. Kharid ka number kahin tha hi nahi, jabki dukaandaar ke
      liye wo utna hi rozana ka sawal hai: "is mahine maal me kitna paisa
      lagaya?" Uska jawab Purchases page ke andar chhupa tha, teen tap door.

      Ye SALE KE SAAMNE rakhne wala number hai, munafa nahi — dono ek nahi
      hain. Aaj ₹1 lakh ka maal kharida aur kuch nahi becha to nuksaan nahi
      hua; paisa sirf maal me badal gaya. Isliye ye kabhi munafe me se nahi
      ghatta (wo `profitLossReport` alag se, bikey hue maal ki lagat se
      ginta hai).
    */
    Purchase.aggregate([
      {
        $match: {
          businessId: bid,
          purchaseDate: { $gte: monthStart, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: null,
          month: { $sum: '$grandTotal' },
          monthCount: { $sum: 1 },
          today: { $sum: { $cond: [{ $gte: ['$purchaseDate', todayStart] }, '$grandTotal', 0] } },
          todayCount: { $sum: { $cond: [{ $gte: ['$purchaseDate', todayStart] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const statusMap = Object.fromEntries(orderCounts.map((o) => [o._id, o.n]));
  const b = balances[0] || {};
  const st = stockAgg[0] || {};

  // Khule bill ka jod — WAHI ek jagah se jahan se baaki poora app leta hai
  const hisaab = await businessHisaab(businessId);

  // Trend me khali din bhi chahiye, warna chart me gaddha dikhta hai
  const trendMap = Object.fromEntries(trendAgg.map((t) => [t._id, t]));
  const expenseMap = Object.fromEntries((expense.byDay || []).map((e) => [e._id, e.amount]));

  /*
    Din ki ginti se chart banta hai, phir zarurat ho to hafte/mahine me juda
    jata hai (upar TREND_RANGES me wajah likhi hai).

    Jodne ka kaam yahan hota hai, database me nahi — kyunki khali din bhi
    chahiye. Database sirf un dino ke jawab deta hai jinme kuch hua tha, aur
    bina khali dino ke chart jhooth bolta hai: do bikri ke beech ka sannata
    line me dikhta hi nahi.
  */
  const dinWise = [];
  for (let i = rangeCfg.days - 1; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    dinWise.push({
      d,
      date: key,
      label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      amount: round2(trendMap[key]?.amount || 0),
      bills: trendMap[key]?.bills || 0,
      // Us din ka kharch — chart me sale ke neeche doosri line
      expense: round2(expenseMap[key] || 0),
    });
  }

  const trend = rangeCfg.bucket === 'day' ? dinWise.map(({ d: _d, ...rest }) => rest)
    : bucketTrend(dinWise, rangeCfg.bucket);

  const today = round2(todaySale[0]?.amount || 0);
  const yesterday = round2(yesterdaySale[0]?.amount || 0);

  const activity = buildActivity(recentInvoices, recentOrders, recentPayments);

  // Munafa — usi hisaab se jo Reports pe chalta hai
  const { profitLossReport } = await import('./report.service.js');
  const plRes = await profitLossReport(businessId, { from: monthStart, to: todayEnd }, user);
  const pl = {
    month: round2(plRes.meta?.netProfit || 0),
    grossMonth: round2(plRes.meta?.grossProfit || 0),
    sale: round2(plRes.meta?.netSale || 0),
    cost: round2(plRes.meta?.cost || 0),
    expenses: round2(plRes.meta?.expenses || 0),
    marginPct: plRes.meta?.netMarginPct ?? null,
  };

  /**
   * Staff ko sirf wahi dikhe jiski ijazat hai.
   *
   * Ye sirf UI ki baat nahi — salesman ko udhaar ka total dikh jana bhi
   * leak hai. Isliye data yahin se hata dete hain, chhupate nahi.
   */
  const can = (perm) => !user || userCan(user, perm);

  const full = {
    sale: {
      today,
      todayBills: todaySale[0]?.n || 0,
      yesterday,
      // Kal se kitna upar-neeche — % tabhi jab kal kuch bika ho
      changePct: yesterday > 0 ? round2(((today - yesterday) / yesterday) * 100) : null,
      month: round2(monthSale[0]?.amount || 0),
      monthBills: monthSale[0]?.n || 0,
    },
    collection: {
      today: round2(todayCollection[0]?.amount || 0),
      todayCount: todayCollection[0]?.n || 0,
      month: round2(monthCollection[0]?.amount || 0),
    },
    expense: {
      today: expense.today,
      todayCount: expense.todayCount,
      month: expense.month,
      monthCount: expense.monthCount,
    },
    // Is mahine maal me kitna paisa lagaya (item 16)
    purchase: {
      today: round2(purchaseAgg[0]?.today || 0),
      todayCount: purchaseAgg[0]?.todayCount || 0,
      month: round2(purchaseAgg[0]?.month || 0),
      monthCount: purchaseAgg[0]?.monthCount || 0,
    },
    /*
      IS MAHINE KA ASLI FAYDA — dashboard pe hi.

      "Aaj ki sale ₹1,20,000" bada dikhta hai par wo dukaandaar ka sawal nahi
      hai. Uska sawal ye hai: "isme se BACHA kitna?" Uska jawab abhi Reports
      me chhupa tha — teen tap door, aur wo page mahine me ek baar khulta hai.
      Nateeja: bikri roz dikhti thi, munafa kabhi nahi.

      Hisaab yahan DOBARA nahi likha — `profitLossReport` hi bulate hain. Do
      jagah likhne se dono dheere dheere alag ho jate, aur ek din dashboard
      kuch aur kehta aur report kuch aur — dukaandaar dono par bharosa khota.
    */
    profit: pl,
    orders: {
      new: statusMap[ORDER_STATUS.PLACED] || 0,
      packed: statusMap[ORDER_STATUS.PACKED] || 0,
      ready: statusMap[ORDER_STATUS.READY] || 0,
      running: (statusMap[ORDER_STATUS.PLACED] || 0) + (statusMap[ORDER_STATUS.PACKED] || 0)
        + (statusMap[ORDER_STATUS.READY] || 0),
      delivered: statusMap[ORDER_STATUS.DELIVERED] || 0,
    },
    /*
      KHATA — ab TOD KAR bheja jata hai, sirf ek bada number nahi.

      Pehle yahan sirf `receivable` jata tha (khate ka jod). Bills page apna
      alag number dikhata tha (khule bill ka jod). Dono theek the, par ek
      doosre se alag — aur dukaandaar ke liye "baaki" ek hi cheez hai. Wahi
      "ek page kuch aur, doosra kuch aur" wali shikayat thi.

      Ab dono ek saath jate hain, isliye screen khud dikha sakti hai ki bada
      number kis-kis se bana hai. `billsDue` ab `receivable` se ZYADA kabhi
      nahi hoga — jama paisa apne aap bill pe lag jata hai (balance.service).
    */
    khata: {
      receivable: round2(b.receivable || 0),
      payable: round2(b.payable || 0),
      advance: round2(b.advance || 0),
      advanceParties: b.advanceParties || 0,
      net: round2((b.receivable || 0) - (b.payable || 0)),
      retailers: b.retailers || 0,
      activeRetailers: b.activeRetailers || 0,
      // Us bade number ki tod-phod — kitna bill ka, kitna bill ke bahar ka
      billsDue: hisaab.billsDue,
      openBills: hisaab.openBills,
      otherDue: round2(Math.max(0, round2((b.receivable || 0) - hisaab.billsDue))),
      purchasesDue: hisaab.purchasesDue,
    },
    stock: {
      items: st.items || 0,
      value: round2(st.stockValue || 0),
      low: st.low || 0,
      outOfStock: st.outOfStock || 0,
      lowItems: lowStockItems,
    },
    trend,
    topItems: topItems.map((t) => ({
      _id: t._id, name: t.name, unit: t.unit, qty: round2(t.qty), amount: round2(t.amount),
    })),
    topRetailers: topRetailers.map((t) => ({
      _id: t._id, name: t.name || t.fallback || '—', bills: t.bills, amount: round2(t.amount),
    })),
    activity,
    todo: {
      pendingPayments,
      pendingRetailers,
      newOrders: statusMap[ORDER_STATUS.PLACED] || 0,
      lowStock: st.low || 0,
    },
  };

  // Jiski ijazat nahi, wo hissa response se hi nikal do
  if (!can('khata:view')) {
    delete full.khata;
    delete full.collection;
    full.todo.pendingPayments = 0;
  }
  if (!can('items:view')) {
    delete full.stock;
    full.todo.lowStock = 0;
  }
  if (!can('orders:view')) {
    delete full.orders;
    full.todo.newOrders = 0;
  }
  if (!can('parties:view')) {
    delete full.topRetailers;
    full.todo.pendingRetailers = 0;
  }
  if (!can('invoices:view')) {
    delete full.sale;
  }
  /*
    Kharch bhi wahi haal hai jo Part 15 ke step 2 me udhaar ka tha.

    Sirf tile hata dena kaafi NAHI hai — chart ki har din wali line me bhi
    kharch ki rakam padi hai. Counter wale ladke ko dukaan ka kiraya aur
    tankhwah ek graph ki line ke roop me dikh jana bhi utna hi leak hai.
    Isliye dono jagah se nikalte hain, chhupate nahi.
  */
  if (!can('expenses:view')) {
    delete full.expense;
    full.trend = (full.trend || []).map(({ expense: _drop, ...rest }) => rest);
  }
  /*
    Kharid ka number bhi utni hi niji baat hai (item 16).

    "Is mahine ₹4 lakh ka maal aaya" se dukaan ka poora paimana pata chal
    jata hai. Salesman ko wo dikhne ki koi wajah nahi — wo kharid karta hi
    nahi. Wahi hadd jo Purchases page pe lagti hai, yahan bhi.
  */
  if (!can('purchases:view')) delete full.purchase;
  // Mahine ka jod, 14 din ka trend aur top items — ye report wali baat hai.
  //
  // Pehle ye teeno `invoices` pe tike the. Matlab salesman, jise /reports pe
  // jaane ki ijazat nahi hai, dashboard se hi poore mahine ki bikri, 14 din ka
  // graph aur sabse zyada bikne wale item dekh leta tha. Ab dono jagah ek hi
  // niyam hai. "Aaj kitna bika" uske paas rehne dete hain — bill to wo khud
  // banata hai.
  if (!can('reports:view')) {
    delete full.trend;
    delete full.topItems;
    /*
      Munafa sabse sambhal kar rakhne wali baat hai.

      Sale kitni hui ye salesman ko pata hi hota hai — bill wahi banata hai.
      Par "isme se kitna bacha" me lagat hai, aur lagat matlab supplier ka
      rate. Wo poori dukaan ka bhed hai, aur ek tile me chhap kar har us aadmi
      tak pahunch jata jise Reports kholne ki bhi ijazat nahi.
    */
    delete full.profit;
    if (full.sale) {
      delete full.sale.month;
      delete full.sale.monthBills;
    }
  }
  // Activity feed me har cheez mil-jul kar aati hai — jo dekh nahi sakta, wo row hata do
  full.activity = (full.activity || []).filter((a) =>
    (a.type === 'invoice' && can('invoices:view'))
    || (a.type === 'order' && can('orders:view'))
    || (a.type === 'payment' && can('khata:view')));

  return full;
}

/** Teeno list ko ek hi timeline me mila kar naye se purana */
function buildActivity(invoices, orders, payments) {
  const rows = [
    ...invoices.map((i) => ({
      type: 'invoice', at: i.createdAt,
      title: `Bill ${i.invoiceNo}`,
      subtitle: i.partySnapshot?.shopName || i.partySnapshot?.name || '',
      amount: round2(i.grandTotal), link: `/invoices/${i._id}`,
    })),
    ...orders.map((o) => ({
      type: 'order', at: o.createdAt,
      title: `Order ${o.orderNo}`,
      subtitle: o.partyId?.shopName || o.partyId?.name || '',
      amount: round2(o.itemsTotal), link: `/orders/${o._id}`, status: o.status,
    })),
    ...payments.map((p) => ({
      type: 'payment', at: p.createdAt,
      title: p.direction === 'IN' ? `Paisa aaya ${p.paymentNo}` : `Paisa diya ${p.paymentNo}`,
      subtitle: `${p.partyId?.shopName || p.partyId?.name || ''} · ${p.mode}`,
      amount: round2(p.amount), link: '/payments', direction: p.direction,
    })),
  ];
  return rows.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);
}

/* ───────────────────────────────────────────────────── retailer ka dashboard */

export async function getRetailerDashboard(businessId, partyId, userId = null) {
  const { monthStart } = boundaries();

  const [party, orderCounts, monthSpend, openInvoices, recentOrders, unread, shop] = await Promise.all([
    Party.findById(partyId).select('name shopName balance creditLimit').lean(),
    Order.aggregate([
      { $match: { businessId: oid(businessId), partyId: oid(partyId) } },
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]),
    Invoice.aggregate([
      { $match: { businessId: oid(businessId), partyId: oid(partyId), isCancelled: false, invoiceDate: { $gte: monthStart } } },
      { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: '$grandTotal' } } },
    ]),
    Invoice.find({ businessId, partyId, isCancelled: false, dueAmount: { $gt: 0 } })
      .sort({ invoiceDate: 1 }).limit(5)
      .select('invoiceNo invoiceDate grandTotal dueAmount').lean(),
    Order.find({ businessId, partyId }).sort({ createdAt: -1 }).limit(4)
      .select('orderNo status itemsTotal createdAt').lean(),
    // Sirf ISI user ki. Pehle yahan `userId` tha hi nahi — matlab retailer ko
    // poore business ki bin-padhi notifications ka number dikhta tha (jisme
    // malik ke low-stock aur naye-order wale alert bhi gine jate the), aur list
    // kholne pe kuch nahi milta tha. Notification.service har jagah userId se
    // hi chhanta hai — sirf yahan chhoot gaya tha.
    userId
      ? Notification.countDocuments({ businessId, userId, isRead: false })
      : Promise.resolve(0),
    // Kis dukaan ka hisaab dikh raha hai — ab ek se zyada ho sakti hain
    Business.findById(businessId).select('name').lean(),
  ]);

  const statusMap = Object.fromEntries(orderCounts.map((o) => [o._id, o.n]));

  /*
    HISAAB KI TOD-PHOD — aur JAMA PAISA KISKE PAAS HAI (item 13).

    Buy-mode aane ke baad ek hi retailer kai dukaano se maal le sakta hai.
    Uske Home pe "₹2,000 jama hai" likh dena ab bekaar hai — sawal to yahi
    hai ki KISKE paas jama hai. Isliye dukaan ka naam saath jata hai, aur
    `advanceFrom` me ye bhi ki wo paisa aaya kahan se (kaunsi wapasi, kaunsi
    payment) — user ki seedhi shikayat yahi thi.
  */
  const hisaab = await partyHisaab(businessId, partyId, { withSources: true });

  return {
    balance: round2(party?.balance || 0),
    hisaab,
    shopName: shop?.name || '',
    creditLimit: party?.creditLimit || 0,
    overLimit: party?.creditLimit > 0 && party.balance > party.creditLimit,
    monthSpend: round2(monthSpend[0]?.amount || 0),
    monthBills: monthSpend[0]?.n || 0,
    orders: {
      running: (statusMap[ORDER_STATUS.PLACED] || 0) + (statusMap[ORDER_STATUS.PACKED] || 0)
        + (statusMap[ORDER_STATUS.READY] || 0),
      ready: statusMap[ORDER_STATUS.READY] || 0,
      delivered: statusMap[ORDER_STATUS.DELIVERED] || 0,
    },
    openInvoices,
    recentOrders,
    unread,
  };
}

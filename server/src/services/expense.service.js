import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { COUNTER_KEYS, STOCK_MOVEMENT_TYPES } from '../config/constants.js';
import {
  EXPENSE_CATEGORIES, WASTE_STOCK_CATEGORY, slugifyCategory, categoryLabel,
} from '../config/expenseCategories.js';
import { round2 } from '../utils/money.js';
import { Expense, Counter, Item } from '../models/index.js';
import { applyStockChange } from './stock.service.js';
import { khepNikalo } from './lot.service.js';
import { isScoped } from '../utils/scope.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * KHARCH KI HADD.
 *
 * Kharch kisi party se nahi juda, isliye "apne retailer" wali hadd yahan
 * lagti hi nahi. Par hadd ka matlab yahan bhi hai — aur shayad zyada:
 * counter wale ladke ne chai ka ₹40 likha, iska matlab ye nahi ki use dukaan
 * ka kiraya aur maalik ki tankhwah bhi dikhni chahiye.
 *
 * Isliye hadd wale aadmi ko sirf WAHI kharch dikhta hai jo usne khud likha.
 */
function scopeFilter(filter, viewer) {
  if (!isScoped(viewer)) return filter;
  return { ...filter, createdBy: viewer._id };
}

function buildFilter(businessId, q = {}, viewer = null) {
  const filter = { businessId };

  if (q.category && q.category !== 'all') filter.category = slugifyCategory(q.category);
  if (q.mode && q.mode !== 'all') filter.mode = q.mode;

  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = new Date(q.from);
    if (q.to) { const to = new Date(q.to); to.setHours(23, 59, 59, 999); filter.date.$lte = to; }
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ paidTo: rx }, { note: rx }, { expenseNo: rx }, { category: rx }];
  }

  return scopeFilter(filter, viewer);
}

/* ------------------------------------------------------------------ list */

export async function listExpenses(businessId, q, viewer = null) {
  const filter = buildFilter(businessId, q, viewer);
  const skip = (q.page - 1) * q.limit;

  const [rows, total, [sum]] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(q.limit)
      .populate('createdBy', 'name').lean(),
    Expense.countDocuments(filter),
    // Jitni list dikh rahi hai, uska poora jod — sirf is page ka nahi.
    // Page ka jod dikhana galat samajh deta hai ("mahine me sirf itna?").
    Expense.aggregate([
      { $match: { ...filter, businessId: oid(businessId) } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    expenses: rows.map((e) => ({
      ...e,
      categoryLabel: categoryLabel(e.category),
      byName: e.createdBy?.name || '',
      createdBy: e.createdBy?._id || e.createdBy,
    })),
    meta: {
      page: q.page, limit: q.limit, total,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      filteredAmount: round2(sum?.amount || 0),
    },
  };
}

/* ----------------------------------------------------------------- stats */

export async function getStats(businessId, viewer = null) {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const base = scopeFilter({ businessId: oid(businessId) }, viewer);

  const [[month], [today], byCategory] = await Promise.all([
    Expense.aggregate([
      { $match: { ...base, date: { $gte: monthStart } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { ...base, date: { $gte: todayStart } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: { ...base, date: { $gte: monthStart } } },
      { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
      { $limit: 6 },
    ]),
  ]);

  return {
    monthAmount: round2(month?.amount || 0),
    monthCount: month?.count || 0,
    todayAmount: round2(today?.amount || 0),
    todayCount: today?.count || 0,
    topCategories: byCategory.map((c) => ({
      category: c._id,
      label: categoryLabel(c._id),
      amount: round2(c.amount),
      count: c.count,
    })),
  };
}

/* ------------------------------------------------------------ categories */

/**
 * Chip me kya dikhana hai.
 *
 * Jaani-pehchani shreniyan hamesha, aur uske baad WO shreniyan jo is dukaan me
 * pehle likhi ja chuki hain. Isse doosri baar "generator ka diesel" type karne
 * ki zarurat nahi padti — wo chip banke saamne aa jata hai.
 */
export async function listCategories(businessId, viewer = null) {
  const used = await Expense.aggregate([
    { $match: scopeFilter({ businessId: oid(businessId) }, viewer) },
    { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 }, last: { $max: '$date' } } },
    { $sort: { count: -1 } },
    { $limit: 40 },
  ]);

  const known = new Set(EXPENSE_CATEGORIES.map((c) => c.value));
  const usedMap = Object.fromEntries(used.map((u) => [u._id, u]));

  const standard = EXPENSE_CATEGORIES.map((c) => ({
    ...c,
    count: usedMap[c.value]?.count || 0,
    amount: round2(usedMap[c.value]?.amount || 0),
  }));

  const custom = used
    .filter((u) => !known.has(u._id))
    .map((u) => ({
      value: u._id,
      label: categoryLabel(u._id),
      hint: '',
      count: u.count,
      amount: round2(u.amount),
    }));

  return { standard, custom };
}

/* ------------------------------------------------------------------ CRUD */

export async function getExpense(businessId, id, viewer = null) {
  const expense = await Expense.findOne(scopeFilter({ _id: id, businessId }, viewer))
    .populate('createdBy', 'name').lean();
  if (!expense) throw ApiError.notFound('Ye kharch nahi mila');
  return {
    ...expense,
    categoryLabel: categoryLabel(expense.category),
    byName: expense.createdBy?.name || '',
  };
}

export async function createExpense(businessId, payload, userId) {
  const category = slugifyCategory(payload.category) || 'other';
  const date = payload.date ? new Date(payload.date) : new Date();

  let amount = round2(payload.amount);
  let wasteItemId = null;
  let wasteQty = 0;
  let stockAlreadyDeducted = false;

  try {
    /*
     * WASTE / DAMAGED STOCK — ek hi jagah jahan kharch stock ko chhuta hai
     * (Expense.js me poori wajah likhi hai).
     *
     * Amount YAHAN KHUD nikalta hai — khud type nahi karte — kyunki jo maal
     * gaya uski FIFO lagat hi asli nuksan hai. Isi wajah se `applyStockChange`
     * pehle (stock kam hai to yahin rukega — "current stock se zyada nahi"
     * wala niyam isi se poora hota hai), phir `khepNikalo` (sahi lagat).
     */
    if (category === WASTE_STOCK_CATEGORY) {
      wasteItemId = payload.wasteItemId;
      wasteQty = round2(payload.wasteQty);
      if (!wasteItemId) throw ApiError.badRequest('Item chunein');
      if (!(wasteQty > 0)) throw ApiError.badRequest('Quantity 0 se zyada honi chahiye');

      const item = await Item.findOne({ _id: wasteItemId, businessId })
        .select('name unit purchasePrice').lean();
      if (!item) throw ApiError.badRequest('Item nahi mila');

      await applyStockChange({
        businessId,
        itemId: item._id,
        type: STOCK_MOVEMENT_TYPES.WASTE,
        qty: -wasteQty,
        note: `Waste/damaged — ${item.name}`,
        userId,
      });
      stockAlreadyDeducted = true;

      const { cost } = await khepNikalo({
        businessId, itemId: item._id, qty: wasteQty, fallbackCost: item.purchasePrice || 0,
      });
      amount = round2(cost);
    } else if (!(amount > 0)) {
      throw ApiError.badRequest('Rakam 0 se zyada honi chahiye');
    }

    const { number: expenseNo } = await Counter.nextNumber({
      businessId, key: COUNTER_KEYS.EXPENSE, prefix: 'EXP', date,
    });

    const expense = await Expense.create({
      businessId,
      expenseNo,
      date,
      category,
      amount,
      mode: payload.mode || 'CASH',
      paidTo: payload.paidTo || '',
      note: payload.note || '',
      wasteItemId,
      wasteQty,
      createdBy: userId || null,
    });

    return { ...expense.toObject(), categoryLabel: categoryLabel(category) };
  } catch (err) {
    // Stock ghat chuka tha par expense save nahi hua — wapas chadha do
    if (stockAlreadyDeducted) {
      await applyStockChange({
        businessId, itemId: wasteItemId, type: STOCK_MOVEMENT_TYPES.WASTE,
        qty: wasteQty, note: 'Waste expense save nahi hua — wapas', allowNegative: true,
      }).catch(() => {});
    }
    throw err;
  }
}

export async function updateExpense(businessId, id, payload, viewer = null) {
  const expense = await Expense.findOne(scopeFilter({ _id: id, businessId }, viewer));
  if (!expense) throw ApiError.notFound('Ye kharch nahi mila');

  /*
   * Waste/Damaged Stock ka amount aur category BADALTE nahi — inke peeche
   * stock pehle hi ghat chuka hai, aur amount usi lagat se bandha hai. Note,
   * tareekh, mode, paidTo badalna theek hai; sirf VAASTAVIK badlaav rokte
   * hain (payload me wahi purani value bhej di ho to wo rukna nahi chahiye).
   */
  const wasWaste = expense.category === WASTE_STOCK_CATEGORY;
  const switchingIntoWaste = payload.category !== undefined
    && !wasWaste && slugifyCategory(payload.category) === WASTE_STOCK_CATEGORY;
  const movingAwayFromWaste = wasWaste
    && payload.category !== undefined && slugifyCategory(payload.category) !== WASTE_STOCK_CATEGORY;
  const changingWasteAmount = wasWaste
    && payload.amount !== undefined && round2(payload.amount) !== expense.amount;

  if (switchingIntoWaste || movingAwayFromWaste || changingWasteAmount) {
    throw ApiError.badRequest('Waste/Damaged Stock ka amount ya category badla nahi ja sakta — hata kar dobara banayein');
  }

  if (payload.amount !== undefined) {
    const amount = round2(payload.amount);
    if (!(amount > 0)) throw ApiError.badRequest('Rakam 0 se zyada honi chahiye');
    expense.amount = amount;
  }
  if (payload.category !== undefined) expense.category = slugifyCategory(payload.category) || 'other';
  if (payload.date !== undefined) expense.date = new Date(payload.date);
  if (payload.mode !== undefined) expense.mode = payload.mode;
  if (payload.paidTo !== undefined) expense.paidTo = payload.paidTo;
  if (payload.note !== undefined) expense.note = payload.note;

  await expense.save();
  return { ...expense.toObject(), categoryLabel: categoryLabel(expense.category) };
}

/**
 * Kharch sach me mit jata hai — bill ki tarah "cancel" nahi hota.
 *
 * Farak samajhne layak hai: bill ka number sarkari record hai, isliye wo mitta
 * nahi, ulta ho jata hai. Kharch ki apni koi legal shakal nahi hai — galat
 * likha to hata dena hi seedha hai. Par kisne hataya, ye register me zaroor
 * chadhta hai (controller me), taaki baad me sawal ka jawab ho.
 *
 * Waste/Damaged Stock ho to stock bhi WAPAS chadhta hai — warna maal hamesha
 * ke liye kho jata, sirf isliye ki kisi ne galti se entry kar di thi.
 */
export async function deleteExpense(businessId, id, viewer = null) {
  const expense = await Expense.findOne(scopeFilter({ _id: id, businessId }, viewer));
  if (!expense) throw ApiError.notFound('Ye kharch nahi mila');

  if (expense.category === WASTE_STOCK_CATEGORY && expense.wasteItemId && expense.wasteQty > 0) {
    await applyStockChange({
      businessId,
      itemId: expense.wasteItemId,
      type: STOCK_MOVEMENT_TYPES.WASTE,
      qty: expense.wasteQty,
      note: `${expense.expenseNo} hata diya — stock wapas`,
      allowNegative: true,
    });
  }

  await Expense.deleteOne({ _id: expense._id });
  return { expenseNo: expense.expenseNo, amount: expense.amount, message: `${expense.expenseNo} hata diya` };
}

/* ------------------------------------------- P&L ke liye jod (report me) */

/** Diye hue samay me kitna kharch — shreni ke hisaab se */
/**
 * Dashboard ke liye kharch — aaj ka, is mahine ka, aur roz ka (chart ke liye).
 *
 * Teen alag call ki jagah ek `$facet`, kyunki dashboard already ek hi request
 * me sab kuch bhejta hai. Aur hadd (`scopeFilter`) yahin lagti hai — dashboard
 * apna alag niyam na banaye, warna ek jagah badalne pe doosri chhoot jayegi.
 */
export async function expenseDashboard(businessId, { todayStart, todayEnd, monthStart, trendStart }, viewer = null) {
  const match = scopeFilter({ businessId: oid(businessId) }, viewer);

  /*
    Ek hi baar din-din ka jod nikalte hain, phir teeno jawab usi se bante hain.

    Teen alag aggregate ya `$facet` bhi likha ja sakta tha, par ye behtar hai:
    database pe ek hi pass, aur din ka bucket hi wo cheez hai jo chart ko waise
    ka waisa chahiye. Range dono me se jo pehle shuru ho — mahine ki pehli
    tareekh (mahine ka jod) ya 14 din peeche (chart) — kyunki mahine ke shuru
    me chart pichhle mahine tak chala jata hai, aur mahine ke aakhir me mahina
    chart se lamba ho jata hai.
  */
  const from = trendStart < monthStart ? trendStart : monthStart;

  const rows = await Expense.aggregate([
    { $match: { ...match, date: { $gte: from, $lte: todayEnd } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        amount: { $sum: '$amount' },
        n: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const key = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  const todayKey = key(todayStart);
  const monthKey = key(monthStart);
  const trendKey = key(trendStart);

  const today = rows.find((r) => r._id === todayKey);
  const month = rows.filter((r) => r._id >= monthKey);

  return {
    today: round2(today?.amount || 0),
    todayCount: today?.n || 0,
    month: round2(month.reduce((s, r) => s + r.amount, 0)),
    monthCount: month.reduce((s, r) => s + r.n, 0),
    byDay: rows.filter((r) => r._id >= trendKey).map((r) => ({ _id: r._id, amount: round2(r.amount) })),
  };
}

export async function expenseTotals(businessId, { start, end } = {}, viewer = null) {
  const match = scopeFilter({ businessId: oid(businessId) }, viewer);
  if (start || end) {
    match.date = {};
    if (start) match.date.$gte = start;
    if (end) match.date.$lte = end;
  }

  const rows = await Expense.aggregate([
    { $match: match },
    { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { amount: -1 } },
  ]);

  return {
    total: round2(rows.reduce((s, r) => s + r.amount, 0)),
    count: rows.reduce((s, r) => s + r.count, 0),
    byCategory: rows.map((r) => ({
      category: r._id,
      label: categoryLabel(r._id),
      amount: round2(r.amount),
      count: r.count,
    })),
  };
}

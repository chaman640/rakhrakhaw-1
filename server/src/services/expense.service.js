import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import { COUNTER_KEYS } from '../config/constants.js';
import {
  EXPENSE_CATEGORIES, slugifyCategory, categoryLabel,
} from '../config/expenseCategories.js';
import { round2 } from '../utils/money.js';
import { Expense, Counter } from '../models/index.js';
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
  const amount = round2(payload.amount);
  if (!(amount > 0)) throw ApiError.badRequest('Rakam 0 se zyada honi chahiye');

  const category = slugifyCategory(payload.category) || 'other';
  const date = payload.date ? new Date(payload.date) : new Date();

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
    createdBy: userId || null,
  });

  return { ...expense.toObject(), categoryLabel: categoryLabel(category) };
}

export async function updateExpense(businessId, id, payload, viewer = null) {
  const expense = await Expense.findOne(scopeFilter({ _id: id, businessId }, viewer));
  if (!expense) throw ApiError.notFound('Ye kharch nahi mila');

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
 */
export async function deleteExpense(businessId, id, viewer = null) {
  const expense = await Expense.findOne(scopeFilter({ _id: id, businessId }, viewer));
  if (!expense) throw ApiError.notFound('Ye kharch nahi mila');

  await Expense.deleteOne({ _id: expense._id });
  return { expenseNo: expense.expenseNo, amount: expense.amount, message: `${expense.expenseNo} hata diya` };
}

/* ------------------------------------------- P&L ke liye jod (report me) */

/** Diye hue samay me kitna kharch — shreni ke hisaab se */
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

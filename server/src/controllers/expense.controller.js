import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as service from '../services/expense.service.js';
import { logAction, diff } from '../services/audit.service.js';
import { categoryLabel } from '../config/expenseCategories.js';

export const list = asyncHandler(async (req, res) => {
  const { expenses, meta } = await service.listExpenses(req.businessId, req.query, req.user);
  return res.json({ success: true, message: 'OK', data: expenses, meta });
});

export const stats = asyncHandler(async (req, res) =>
  ok(res, await service.getStats(req.businessId, req.user)));

export const categories = asyncHandler(async (req, res) =>
  ok(res, await service.listCategories(req.businessId, req.user)));

export const detail = asyncHandler(async (req, res) =>
  ok(res, await service.getExpense(req.businessId, req.params.id, req.user)));

export const create = asyncHandler(async (req, res) => {
  const expense = await service.createExpense(req.businessId, req.body, req.user._id);
  await logAction(req, {
    action: 'expense.create',
    entityType: 'Expense', entityId: expense._id, entityLabel: expense.expenseNo,
    summary: `${expense.expenseNo} — ₹${expense.amount} (${categoryLabel(expense.category)})`,
  });
  return created(res, expense, `₹${expense.amount} ka kharch likh liya`);
});

/* Paise wali cheezein register me zaroor jani chahiye */
const FIELDS = {
  amount: 'Rakam',
  category: 'Kis cheez ka',
  date: 'Tareekh',
  mode: 'Kaise diya',
  paidTo: 'Kisko diya',
};

export const update = asyncHandler(async (req, res) => {
  const before = await service.getExpense(req.businessId, req.params.id, req.user).catch(() => null);
  const expense = await service.updateExpense(req.businessId, req.params.id, req.body, req.user);

  const changes = diff(before, expense, FIELDS);
  if (changes.length) {
    await logAction(req, {
      action: 'expense.update',
      entityType: 'Expense', entityId: req.params.id, entityLabel: expense.expenseNo,
      changes,
      summary: `${expense.expenseNo} me ${changes.map((c) => c.label).join(', ')} badla`,
    });
  }
  return ok(res, expense, 'Save ho gaya');
});

export const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteExpense(req.businessId, req.params.id, req.user);
  await logAction(req, {
    action: 'expense.delete',
    entityType: 'Expense', entityId: req.params.id, entityLabel: result.expenseNo,
    summary: `${result.expenseNo} (₹${result.amount}) mitaya`,
  });
  return ok(res, result, result.message);
});

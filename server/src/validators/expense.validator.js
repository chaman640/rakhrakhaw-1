import { z } from 'zod';
import { EXPENSE_MODES } from '../config/expenseCategories.js';

const money = z.coerce.number().min(0.01, 'Rakam 0 se zyada honi chahiye').max(100000000);

export const createExpenseSchema = z.object({
  date: z.coerce.date().optional(),
  category: z.string().trim().min(1, 'Kharch kis cheez ka hai, ye chunein').max(60),
  amount: money,
  mode: z.enum(EXPENSE_MODES).optional().default('CASH'),
  paidTo: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
}).strict();

export const updateExpenseSchema = z.object({
  date: z.coerce.date().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  amount: money.optional(),
  mode: z.enum(EXPENSE_MODES).optional(),
  paidTo: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
}).strict();

export const listExpensesQuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(''),
  category: z.string().trim().max(60).optional().default('all'),
  mode: z.enum([...EXPENSE_MODES, 'all']).optional().default('all'),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Galat id'),
});

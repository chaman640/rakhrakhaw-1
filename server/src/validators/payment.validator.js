import { z } from 'zod';
import { PAYMENT_MODES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const money = z.coerce.number().gt(0, 'Amount 0 se zyada hona chahiye').max(100000000);

export const createPaymentSchema = z.object({
  partyId: objectId,
  direction: z.enum(['IN', 'OUT']).optional().default('IN'),
  amount: money,
  mode: z.enum(Object.values(PAYMENT_MODES)).optional().default('CASH'),
  date: z.coerce.date().optional(),
  reference: z.string().trim().max(60).optional().default(''),
  note: z.string().trim().max(300).optional().default(''),
});

export const claimPaymentSchema = z.object({
  amount: money,
  reference: z.string().trim().max(60).optional().default(''),
  note: z.string().trim().max(300).optional().default(''),
});

export const listPaymentsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  partyId: objectId.or(z.literal('')).optional().default(''),
  direction: z.enum(['IN', 'OUT', 'all']).optional().default('all'),
  mode: z.enum([...Object.values(PAYMENT_MODES), 'all']).optional().default('all'),
  status: z.enum(['pending', 'confirmed', 'failed', 'all']).optional().default('all'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const khataQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  type: z.enum(['retailer', 'supplier', 'all']).optional().default('retailer'),
  filter: z.enum(['all', 'due', 'clear']).optional().default('all'),
  sort: z.enum(['-balance', 'balance', 'name']).optional().default('-balance'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const ledgerQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().min(1).max(500).optional().default(200),
});

export const rejectSchema = z.object({
  reason: z.string().trim().max(300).optional().default(''),
});

export const idParamSchema = z.object({ id: objectId });
export const partyIdParamSchema = z.object({ partyId: objectId });

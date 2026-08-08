import { z } from 'zod';
import { RETURN_TYPES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const money = z.coerce.number().min(0).max(100000000);

const returnLineSchema = z.object({
  itemId: objectId,
  qty: z.coerce.number().gt(0, 'Quantity 0 se zyada honi chahiye').max(1000000),
  rate: money,
  discount: money.optional().default(0),
  gstRate: z.coerce.number().min(0).max(28).optional(),
  reason: z.string().trim().max(200).optional().default(''),
});

export const createReturnSchema = z.object({
  type: z.enum(Object.values(RETURN_TYPES), {
    errorMap: () => ({ message: 'Return ka type galat hai' }),
  }),
  partyId: objectId,
  invoiceId: objectId.or(z.literal('')).nullable().optional(),
  purchaseId: objectId.or(z.literal('')).nullable().optional(),
  returnDate: z.coerce.date().optional(),
  items: z.array(returnLineSchema).min(1, 'Kam se kam ek item daalein'),
  extraDiscount: money.optional().default(0),
  reason: z.string().trim().max(300).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
});

export const listReturnsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  type: z.enum([...Object.values(RETURN_TYPES), 'all']).optional().default('all'),
  partyId: objectId.or(z.literal('')).optional().default(''),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const prefillParamSchema = z.object({
  type: z.enum(Object.values(RETURN_TYPES)),
  docId: objectId,
});

export const idParamSchema = z.object({ id: objectId });

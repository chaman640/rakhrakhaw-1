import { z } from 'zod';
import { PAYMENT_MODES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const money = z.coerce.number().min(0).max(100000000);

export const invoiceItemSchema = z.object({
  itemId: objectId,
  qty: z.coerce.number().gt(0, 'Quantity 0 se zyada honi chahiye').max(10000000),
  rate: money,
  discount: money.optional().default(0),
  gstRate: z.coerce.number().min(0).max(28).optional(),
});

export const createInvoiceSchema = z.object({
  partyId: objectId,
  orderId: objectId.or(z.literal('')).nullable().optional(),
  invoiceDate: z.coerce.date().optional(),
  items: z.array(invoiceItemSchema).min(1, 'Kam se kam ek item daalein').max(200),
  extraDiscount: money.optional().default(0),
  paidAmount: money.optional().default(0),
  // Bill se zyada paisa — rok ke baad "haan, jama kar dein"
  allowAdvance: z.boolean().optional().default(false),
  // Party ka pehle se jama paisa isi bill me se kaat lein
  /*
    ULTA TICK. Pehle `useAdvance: true` bhejna padta tha, warna jama paisa
    bill pe lagta hi nahi tha — aur koi kabhi nahi bhejta tha. Ab jama paisa
    apne aap lagta hai; ye tick use ROKNE ke liye hai.
  */
  keepAdvance: z.boolean().optional().default(false),
  paymentMode: z.enum(Object.values(PAYMENT_MODES)).optional().default('CASH'),
  notes: z.string().trim().max(500).optional().default(''),
  termsAndConditions: z.string().trim().max(2000).optional(),
});

export const listInvoicesQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  partyId: objectId.or(z.literal('')).optional().default(''),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'all']).optional().default('all'),
  status: z.enum(['active', 'cancelled', 'all']).optional().default('active'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['-invoiceDate', 'invoiceDate', '-grandTotal', 'grandTotal']).optional().default('-invoiceDate'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const cancelInvoiceSchema = z.object({
  reason: z.string().trim().max(300).optional().default(''),
});

export const idParamSchema = z.object({ id: objectId });
export const orderIdParamSchema = z.object({ orderId: objectId });

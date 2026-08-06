import { z } from 'zod';
import { UNITS } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const money = z.coerce.number().min(0).max(100000000);

export const purchaseItemSchema = z.object({
  itemId: objectId,
  qty: z.coerce.number().gt(0, 'Quantity 0 se zyada honi chahiye').max(10000000),
  rate: money,
  discount: money.optional().default(0),
  gstRate: z.coerce.number().min(0).max(28).optional().default(0),
});

export const createPurchaseSchema = z.object({
  supplierId: objectId,
  supplierBillNo: z.string().trim().max(40).optional().default(''),
  purchaseDate: z.coerce.date().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Kam se kam ek item daalein').max(200),
  paidAmount: money.optional().default(0),
  notes: z.string().trim().max(500).optional().default(''),
  // Naya rate mila to item ka purchase price bhi update kar do
  updatePurchasePrice: z.boolean().optional().default(true),
});

export const listPurchasesQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  supplierId: objectId.or(z.literal('')).optional().default(''),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid', 'all']).optional().default('all'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['-purchaseDate', 'purchaseDate', '-grandTotal', 'grandTotal']).optional().default('-purchaseDate'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const idParamSchema = z.object({ id: objectId });

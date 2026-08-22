import { z } from 'zod';
import { ORDER_PAYMENT_MODES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  categoryId: objectId.or(z.literal('')).or(z.literal('none')).optional().default(''),
  stock: z.enum(['all', 'in']).optional().default('all'),
  sort: z.enum(['name', '-name', 'rate', '-rate', '-createdAt']).optional().default('name'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(24),
});

export const cartItemSchema = z.object({
  itemId: objectId,
  qty: z.coerce.number().gt(0, 'Quantity 0 se zyada honi chahiye').max(1000000),
});

export const cartQtySchema = z.object({
  qty: z.coerce.number().min(0).max(1000000),
});

export const itemIdParamSchema = z.object({ itemId: objectId });

export const placeOrderSchema = z.object({
  note: z.string().trim().max(500).optional().default(''),
  /*
    Purane app se aaya order is field ke bina aayega, aur wo bilkul theek hai —
    tab wahi matlab lagta hai jo pehle chup-chaap lagta tha: udhaar.
  */
  paymentMode: z.enum(Object.values(ORDER_PAYMENT_MODES))
    .optional().default(ORDER_PAYMENT_MODES.UDHAAR),
});

export const idParamSchema = z.object({ id: objectId });

export const myOrdersQuerySchema = z.object({
  status: z.enum(['PLACED', 'PACKED', 'READY', 'DELIVERED', 'CANCELLED', 'all']).optional().default('all'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

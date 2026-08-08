import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

export const reportNameParamSchema = z.object({
  name: z.enum(['sale', 'purchase', 'stock', 'outstanding', 'gst', 'payment'], {
    errorMap: () => ({ message: 'Aisi koi report nahi hai' }),
  }),
});

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(['day', 'item', 'party', 'supplier']).optional(),
  filter: z.enum(['all', 'low', 'out', 'dead']).optional(),
  type: z.enum(['retailer', 'supplier']).optional(),
  partyId: objectId.or(z.literal('')).optional(),
  categoryId: objectId.or(z.literal('')).optional(),
});

export const reminderSchema = z.object({
  message: z.string().trim().max(300).optional().default(''),
});

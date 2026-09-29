import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

// Ya dukaan ka item, ya likh kar maanga hua maal — dono me se ek
export const addWishSchema = z.object({
  itemId: objectId.optional(),
  text: z.string().trim().max(200).optional(),
}).refine((v) => v.itemId || (v.text && v.text.length >= 2), {
  message: 'Kya chahiye, thoda likh dijiye',
});

export const idParamSchema = z.object({ id: objectId });
export const itemIdParamSchema = z.object({ itemId: objectId });

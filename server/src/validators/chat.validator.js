import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

export const partyIdParamSchema = z.object({
  partyId: objectId,
});

/*
 * Type ke hisaab se kya zaroori hai:
 *   text        — text bharna hi hoga
 *   photo       — file (multer se `req.file`, yahan check nahi hota)
 *   item/order  — refId zaroori hai (Item/Order ki id)
 */
export const sendMessageSchema = z.object({
  type: z.enum(['text', 'photo', 'item', 'order']).optional().default('text'),
  text: z.string().trim().max(2000).optional().default(''),
  refId: objectId.optional(),
}).refine((v) => v.type !== 'text' || v.text.length > 0, {
  message: 'Kuch to likhein',
  path: ['text'],
}).refine((v) => !['item', 'order'].includes(v.type) || v.refId, {
  message: 'Kaunsa item/order bhejna hai, ye nahi mila',
  path: ['refId'],
});

export const chatSearchQuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(''),
});

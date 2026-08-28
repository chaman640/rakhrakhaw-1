import { z } from 'zod';
import { UNITS } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const money = z.coerce.number().min(0).max(100000000);

export const idParamSchema = z.object({ id: objectId });

export const lineParamSchema = z.object({
  id: objectId,
  index: z.coerce.number().int().min(0).max(500),
});

export const listIntakeQuerySchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'CANCELLED', 'all']).optional().default('PENDING'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

/**
 * Ek line ka faisla.
 *
 * `sellingPrice` ki jaanch service me hai, yahan nahi — aur wo jaan-boojh kar
 * hai. Chhod dene wali line (`skip: true`) pe rate maangna bemaani hai, aur
 * zod me "is halat me zaroori, us halat me nahi" likhna padhne me itna ulajh
 * jata hai ki agli baar koi use theek karne se darta hai. Ek hi jagah, seedhi
 * bhasha me: `skip` nahi hai to rate chahiye.
 */
export const decideLineSchema = z.object({
  skip: z.boolean().optional().default(false),

  // Purana item mila
  itemId: objectId.or(z.literal('')).optional(),

  // Ya naya banao — jo na bhejo wo bill se hi utha liya jayega
  /*
    ITEM KI POORI PEHCHAN — YAHIN, MAAL AATE WAQT (item 9).

    Ye wahi ek pal hai jab ye sab saamne hota hai: dabba haath me hai, uspe
    MRP chhapa hai, code likha hai, warranty ka card andar pada hai. Baad me
    Items page pe jaakar ye bharna kisi ne kabhi nahi kiya — aur us se do
    cheezein hoti thin: MRP ke bina retailer ko bechte waqt "kitne me dena
    hai" ka koi sahara nahi rehta, aur warranty ka jhagda mahine baad hota
    hai jab kuch likha hi nahi hota.

    Sab MARZI KA hai. Maal aane par dukaandaar jaldi me hota hai; ek bhi
    zaroori khaana lagane ka matlab hai ki wo poora kaam hi rok dega.
  */
  newItem: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    sku: z.string().trim().max(40).optional(),
    unit: z.enum(UNITS).optional(),
    hsn: z.string().trim().max(10).optional(),
    gstRate: z.coerce.number().min(0).max(28).optional(),
    categoryId: objectId.or(z.literal('')).nullable().optional(),
    // Maal aate waqt hi bhar dene wali baaki cheezein
    mrp: z.coerce.number().min(0).max(10000000).optional(),
    brand: z.string().trim().max(60).optional(),
    imageUrl: z.string().trim().max(500).optional(),
    warrantyMonths: z.coerce.number().int().min(0).max(240).optional(),
    warrantyNote: z.string().trim().max(200).optional(),
  }).optional(),

  sellingPrice: money.optional().default(0),
});

export const finishIntakeSchema = z.object({
  // Turant kitna diya — khali chhod do to poora udhaar (wahi aam baat hai)
  paidAmount: money.optional().default(0),
  notes: z.string().trim().max(500).optional().default(''),
});

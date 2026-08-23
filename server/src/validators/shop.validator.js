import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

/*
  Number POORA daalna zaroori hai.

  Aadha number allow karte to ye khoj nahi, taad-bin ban jati: koi bhi 9-8-7...
  chala kar ek ek dukaan ka naam aur catalog dekh leta. Poora 10 ank maangne se
  wo rasta band hai — jise sach me kaam hai uske paas number pehle se hota hai
  (bill pe chhapa hota hai).
*/
const phone = z.string().trim().min(10, 'Poora 10 digit ka number daalein').max(15);

export const shopLookupQuerySchema = z.object({ phone });

export const shopConnectSchema = z
  .object({
    phone: phone.optional(),
    businessId: objectId.optional(),
  })
  .refine((v) => Boolean(v.phone || v.businessId), {
    message: 'Dukaan ka number daalein',
    path: ['phone'],
  });

export const shopIdParamSchema = z.object({ id: objectId });

export const savedShopsQuerySchema = z.object({
  // `all=1` — save hatayi hui dukaanein bhi dikhao (khata purana hai to kaam aata hai)
  all: z.enum(['0', '1']).optional().default('0'),
});

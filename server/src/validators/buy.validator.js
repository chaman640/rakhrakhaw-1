import { z } from 'zod';
import { ORDER_PAYMENT_MODES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

/**
 * Har dukaan ka apna order — isliye paise ka irada aur note bhi HAR DUKAAN KA
 * APNA.
 *
 * Ek hi chunaav sab pe laga dena aasan tha, par wo ek jhooth bolta: ek
 * wholesaler ko "cash pe lunga" bola jata aur doosre ko bhi wahi — jabki
 * dukaandaar aksar ek se udhaar leta hai aur doosre ko nakad deta hai. Order
 * ke saath ye baat bechne wale tak jati hai aur wo maal isi hisaab se tayyar
 * karta hai, isliye yahan andaza lagana mehnga padta.
 */
export const checkoutSchema = z.object({
  orders: z.array(z.object({
    shopId: objectId,
    paymentMode: z.enum(Object.values(ORDER_PAYMENT_MODES))
      .optional().default(ORDER_PAYMENT_MODES.UDHAAR),
    note: z.string().trim().max(500).optional().default(''),
  })).min(1, 'Kam se kam ek dukaan chunni hogi').max(20),
});

import { z } from 'zod';
import { PAID_PLANS } from '../config/billing.js';

const codes = PAID_PLANS.map((p) => p.code);

export const checkoutSchema = z.object({
  planCode: z.enum(codes, { errorMap: () => ({ message: 'Aisa koi plan nahi hai' }) }),
  // 12 se zyada nahi — ek galti se saal bhar ka paisa kat jana bahut mehnga hai
  months: z.coerce.number().int().min(1).max(12).optional().default(1),
});

export const verifySchema = z.object({
  orderId: z.string().trim().min(4).max(80),
  paymentId: z.string().trim().min(4).max(80),
  signature: z.string().trim().min(16).max(200),
});

/* ── Autopay ── */

export const planOnlySchema = z.object({
  planCode: z.enum(codes, { errorMap: () => ({ message: 'Aisa koi plan nahi hai' }) }),
});

/*
  Mandate ke jawab me `subscriptionId` aata hai, `orderId` nahi — aur signature
  bhi doosre kram se banta hai. Isliye alag schema, purane wale me ek aur
  khaana thoos dene se nahi.
*/
export const subVerifySchema = z.object({
  subscriptionId: z.string().trim().min(4).max(80),
  paymentId: z.string().trim().min(4).max(80),
  signature: z.string().trim().min(16).max(200),
});

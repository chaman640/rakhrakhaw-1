import { z } from 'zod';
import { PAID_PLANS } from '../config/billing.js';

const codes = PAID_PLANS.map((p) => p.code);

export const checkoutSchema = z.object({
  planCode: z.enum(codes, { errorMap: () => ({ message: 'Aisa koi plan nahi hai' }) }),
  /*
    Sirf DO raste — 1 (mahina) ya 12 (saal). Beech ka kuch nahi: "7 mahine"
    jaisa sawal dukaandaar ko uljhata tha (config/billing.js — PERIODS).
  */
  months: z.coerce.number().int().refine((m) => m === 1 || m === 12, {
    message: 'Sirf mahine ya saal ka plan le sakte hain',
  }).optional().default(1),
});

export const verifySchema = z.object({
  orderId: z.string().trim().min(4).max(80),
  paymentId: z.string().trim().min(4).max(80),
  signature: z.string().trim().min(16).max(200),
});

/* ── Autopay ── */

export const planOnlySchema = z.object({
  planCode: z.enum(codes, { errorMap: () => ({ message: 'Aisa koi plan nahi hai' }) }),
  // Har mahine kate ya har saal — na bheja to mahina (purana client)
  period: z.enum(['monthly', 'yearly']).optional().default('monthly'),
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

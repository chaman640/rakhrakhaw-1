import { z } from 'zod';
import { STATES } from '../config/states.js';

const stateNames = STATES.map((s) => s.name);

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(2, 'Dukaan ka naam daalein').max(120).optional(),
    phone: z.string().trim().max(15).optional(),
    email: z.string().trim().email('Email galat hai').or(z.literal('')).optional(),

    address: z
      .object({
        line1: z.string().trim().max(150).optional(),
        line2: z.string().trim().max(150).optional(),
        city: z.string().trim().max(80).optional(),
        state: z.enum(stateNames).or(z.literal('')).optional(),
        pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode 6 digit ka hota hai').or(z.literal('')).optional(),
      })
      .optional(),

    gstEnabled: z.boolean().optional(),
    gstin: z.string().trim().toUpperCase().or(z.literal('')).optional(),

    upiId: z.string().trim().max(64).or(z.literal('')).optional(),
    upiName: z.string().trim().max(80).optional(),

    // Bank ka khata — bill pe likhne ke liye (QR isse nahi banta, Business
    // model me wajah likhi hai)
    bankName: z.string().trim().max(80).optional(),
    bankAccountName: z.string().trim().max(120).optional(),
    bankAccountNumber: z.string().trim().max(30).optional(),
    bankIfsc: z.string().trim().toUpperCase().max(11).or(z.literal('')).optional(),
    invoicePrefix: z.string().trim().max(10).optional(),
    orderPrefix: z.string().trim().max(10).optional(),
    termsAndConditions: z.string().max(2000).optional(),
    invoiceFooterNote: z.string().max(500).optional(),
    lowStockThreshold: z.coerce.number().min(0).max(100000).optional(),
    autoApproveRetailers: z.boolean().optional(),
    inviteEnabled: z.boolean().optional(),
  })
  .strict();

export const partyIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Galat id'),
});

export const retailerListQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'blocked', 'all']).optional().default('all'),
});

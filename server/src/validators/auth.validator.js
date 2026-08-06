import { z } from 'zod';

const phone = z.string().trim().min(10, 'Phone number 10 digit ka hona chahiye');
const password = z.string().min(6, 'Password kam se kam 6 character ka rakhein');
const name = z.string().trim().min(2, 'Naam kam se kam 2 akshar ka hona chahiye').max(80);

export const wholesalerSignupSchema = z.object({
  name,
  phone,
  password,
  businessName: z.string().trim().min(2, 'Dukaan ka naam daalein').max(120),
});

export const loginSchema = z.object({
  phone,
  password: z.string().min(1, 'Password daalein'),
});

export const retailerSignupSchema = z.object({
  inviteCode: z.string().trim().min(4, 'Invite code galat hai'),
  name,
  shopName: z.string().trim().max(120).optional().default(''),
  phone,
  password,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Purana password daalein'),
  newPassword: password,
});

export const inviteCodeParamSchema = z.object({
  code: z.string().trim().min(4),
});

export const updateProfileSchema = z
  .object({
    name: name.optional(),
    shopName: z.string().trim().max(120).optional(),
    gstin: z.string().trim().toUpperCase().or(z.literal('')).optional(),
    address: z
      .object({
        line1: z.string().trim().max(150).optional(),
        city: z.string().trim().max(80).optional(),
        state: z.string().trim().max(80).optional(),
        pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode 6 digit ka hota hai').or(z.literal('')).optional(),
      })
      .optional(),
  })
  .strict();

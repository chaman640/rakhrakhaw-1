import { z } from 'zod';
import { PAYOUT_MODES } from '../config/partner.js';

const phone = z.string().trim().min(10, 'Poora 10 ank ka number daalein').max(15);
const password = z.string().min(6, 'Password kam se kam 6 akshar ka rakhein').max(72);

/*
  Do me se EK — UPI ya bank. Poori jaanch service me hoti hai (regex ke saath);
  yahan sirf shakal dekhi jati hai. Do jagah poori jaanch likhne ka matlab
  hota ek din ek jagah badalna aur doosri jagah bhool jana.
*/
const payout = z.object({
  mode: z.enum([PAYOUT_MODES.UPI, PAYOUT_MODES.BANK]),
  upiId: z.string().trim().max(80).optional(),
  accountName: z.string().trim().max(80).optional(),
  accountNumber: z.string().trim().max(24).optional(),
  ifsc: z.string().trim().max(15).optional(),
});

export const partnerSignupSchema = z.object({
  name: z.string().trim().min(2, 'Apna naam daalein').max(80),
  phone,
  password,
  payout,
});

export const partnerLoginSchema = z.object({ phone, password: z.string().min(1, 'Password daalein') });

export const partnerPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Purana password daalein'),
  newPassword: password,
});

export const payoutSchema = z.object({ payout });

export const adminLoginSchema = z.object({
  email: z.string().trim().email('Email theek nahi hai').max(120),
  password: z.string().min(1, 'Password daalein'),
});

export const adminPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Purana password daalein'),
  newPassword: z.string().min(8, 'Naya password kam se kam 8 akshar ka rakhein').max(72),
});

export const markPaidSchema = z.object({
  /*
    Minus bhi chalta hai — sudhaar ke liye.

    Galti se ₹300 ki jagah ₹3000 mark ho jaye to use theek karne ka koi rasta
    hona chahiye. Bina iske hisaab hamesha ke liye galat reh jata aur salesman
    ko uski agli asli kamai bhi nahi dikhti.
  */
  amountRupees: z.coerce.number().refine((n) => n !== 0, 'Rakam theek nahi hai')
    .refine((n) => Math.abs(n) <= 1000000, 'Rakam bahut badi hai'),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
});

/*
  Bina iske `req.body?.active` undefined aa jata tha aur `Boolean(undefined)`
  = false — yaani khali POST bhejne se salesman ka account band ho jata.
*/
export const toggleSchema = z.object({ active: z.boolean() });

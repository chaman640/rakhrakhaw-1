import { z } from 'zod';

const phone = z.string().trim().min(10, 'Phone number 10 digit ka hona chahiye');
const password = z.string().min(6, 'Password kam se kam 6 character ka rakhein');
const name = z.string().trim().min(2, 'Naam kam se kam 2 akshar ka hona chahiye').max(80);

/*
  `otpToken` — OTP verify hone ka saboot.

  Signup ke saath bhejna ZAROORI hai. Bina iske koi bhi kisi ka bhi number daal
  kar account bana leta, aur us number wale ko pata bhi na chalta.
*/
const otpToken = z.string().min(10, 'Pehle apna number OTP se verify karein');

export const wholesalerSignupSchema = z.object({
  name,
  phone,
  password,
  otpToken,
  businessName: z.string().trim().min(2, 'Dukaan ka naam daalein').max(120),

  /*
    Salesman ka code — marzi se. Galat ya khali ho to signup phir bhi hota
    hai, bas kisi ke naam nahi chadhta. Signup ko is ek cheez pe rokna sabse
    bada nuksan hota.
  */
  refCode: z.string().trim().max(12).optional(),
});

export const loginSchema = z.object({
  phone,
  password: z.string().min(1, 'Password daalein'),
});

export const retailerSignupSchema = z.object({
  // Khaali chhoda ja sakta hai — retailer ab bina kisi dukaan ke invite link
  // ke bhi seedha signup kar sakta hai, aur baad me Buy me number search
  // karke jitni chahe dukaanon se jud sakta hai.
  //
  // `.refine()` isliye, `.optional().min(4)` ki jagah: khaali STRING (form se
  // aa sakti hai) aur bilkul GAYAB field (`undefined`) — dono ko ek jaisa
  // "nahi diya" maanna hai. `.optional()` sirf `undefined` ko chhodta hai;
  // khaali string '' ab bhi andar wale `.min(4)` se guzar kar reject ho jati.
  inviteCode: z.string().trim().optional().default('').refine(
    (v) => !v || v.length >= 4,
    { message: 'Invite code galat hai' },
  ),
  name,
  shopName: z.string().trim().max(120).optional().default(''),
  phone,
  password,
  otpToken,
});

/* ─────────────────────────── OTP ─────────────────────────── */

const purpose = z.enum(['SIGNUP', 'RESET'], { message: 'Ye kaam pata nahi' });

export const sendOtpSchema = z.object({ phone, purpose });

export const verifyOtpSchema = z.object({
  phone,
  purpose,
  code: z.string().trim().regex(/^\d{6}$/, 'OTP 6 ank ka hota hai'),
});

export const resetPasswordSchema = z.object({
  phone,
  otpToken,
  newPassword: password,
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

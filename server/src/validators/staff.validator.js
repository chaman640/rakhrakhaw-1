import { z } from 'zod';
import {
  STAFF_ROLES, ALL_PERMISSIONS, SCOPES,
} from '../config/permissions.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

// Malik ko yahan se nahi bana sakte — wo signup se hi banta hai
const assignableRoles = Object.values(STAFF_ROLES).filter((r) => r !== STAFF_ROLES.OWNER);

const permissionList = z.array(z.enum(ALL_PERMISSIONS)).max(ALL_PERMISSIONS.length);

/**
 * Hadd ke dabbe.
 *
 * `nullable` isliye ki khali dabbe ka matlab "koi hadd nahi" hota hai — 0
 * nahi. 0 ka matlab hota "kuch bhi nahi", jo bilkul ulti baat hai.
 */
const limits = z.object({
  maxDiscountPercent: z.number().min(0).max(100).nullable().optional(),
  maxInvoiceAmount: z.number().min(0).nullable().optional(),
  canSellOnCredit: z.boolean().optional(),
}).optional();

export const addStaffSchema = z.object({
  name: z.string().trim().min(2, 'Naam kam se kam 2 akshar ka').max(80),
  phone: z.string().trim().min(10, 'Phone number 10 digit ka hota hai'),
  password: z.string().min(6, 'Password kam se kam 6 character ka rakhein').max(72),
  staffRole: z.enum(assignableRoles, {
    errorMap: () => ({ message: 'Role galat hai' }),
  }),
  permissions: permissionList.optional(),
  scope: z.enum(Object.values(SCOPES)).optional(),
  limits,
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(10).optional(),
  password: z.string().min(6).max(72).optional(),
  staffRole: z.enum(assignableRoles).optional(),
  permissions: permissionList.optional(),
  scope: z.enum(Object.values(SCOPES)).optional(),
  limits,
  isActive: z.boolean().optional(),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Purana password daalein'),
  newPassword: z.string().min(6, 'Naya password kam se kam 6 character ka rakhein').max(72),
});

export const idParamSchema = z.object({ id: objectId });

/* ─────────────────────────── invite link ─────────────────────────── */

export const createInviteSchema = z.object({
  label: z.string().trim().max(60).optional().default(''),
  staffRole: z.enum(assignableRoles, { errorMap: () => ({ message: 'Role galat hai' }) }),
  permissions: permissionList.optional(),
  scope: z.enum(Object.values(SCOPES)).optional(),
  limits,
  // Chahein to number pehle se baandh dein — phir usi number wala hi jud sakta hai
  phone: z.string().trim().min(10).optional(),
  // Link kitne din chalega
  validDays: z.number().int().min(1).max(30).optional().default(7),
});

export const inviteTokenParamSchema = z.object({
  token: z.string().min(20, 'Link poora nahi hai').max(200),
});

export const acceptInviteSchema = z.object({
  name: z.string().trim().min(2, 'Naam kam se kam 2 akshar ka').max(80),
  phone: z.string().trim().min(10, 'Phone number 10 digit ka hota hai'),
  password: z.string().min(6, 'Password kam se kam 6 character ka rakhein').max(72),
});

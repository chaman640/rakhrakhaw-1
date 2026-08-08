import { z } from 'zod';
import { STAFF_ROLES, PERMISSIONS } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

// Malik ko yahan se nahi bana sakte — wo signup se hi banta hai
const assignableRoles = Object.values(STAFF_ROLES).filter((r) => r !== STAFF_ROLES.OWNER);

export const addStaffSchema = z.object({
  name: z.string().trim().min(2, 'Naam kam se kam 2 akshar ka').max(80),
  phone: z.string().trim().min(10, 'Phone number 10 digit ka hota hai'),
  password: z.string().min(6, 'Password kam se kam 6 character ka rakhein').max(72),
  staffRole: z.enum(assignableRoles, {
    errorMap: () => ({ message: 'Role galat hai' }),
  }),
  permissions: z.array(z.enum(Object.values(PERMISSIONS))).optional(),
});

export const updateStaffSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(10).optional(),
  password: z.string().min(6).max(72).optional(),
  staffRole: z.enum(assignableRoles).optional(),
  permissions: z.array(z.enum(Object.values(PERMISSIONS))).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Purana password daalein'),
  newPassword: z.string().min(6, 'Naya password kam se kam 6 character ka rakhein').max(72),
});

export const idParamSchema = z.object({ id: objectId });

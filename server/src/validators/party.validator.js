import { z } from 'zod';
import { PARTY_TYPES, PARTY_STATUS } from '../config/constants.js';
import { STATES } from '../config/states.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const stateNames = STATES.map((s) => s.name);

const addressSchema = z.object({
  line1: z.string().trim().max(150).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.enum(stateNames).or(z.literal('')).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode 6 digit ka hota hai').or(z.literal('')).optional(),
}).optional();

export const createPartySchema = z.object({
  type: z.enum(Object.values(PARTY_TYPES)),
  name: z.string().trim().min(2, 'Naam kam se kam 2 akshar ka hona chahiye').max(80),
  shopName: z.string().trim().max(120).optional().default(''),
  phone: z.string().trim().min(10, 'Phone number 10 digit ka hona chahiye'),
  email: z.string().trim().email('Email galat hai').or(z.literal('')).optional().default(''),
  address: addressSchema,
  gstin: z.string().trim().toUpperCase().or(z.literal('')).optional().default(''),
  openingBalance: z.coerce.number().min(-100000000).max(100000000).optional().default(0),
  creditLimit: z.coerce.number().min(0).max(100000000).optional().default(0),
  notes: z.string().trim().max(500).optional().default(''),
});

export const updatePartySchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  shopName: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(10).optional(),
  email: z.string().trim().email('Email galat hai').or(z.literal('')).optional(),
  address: addressSchema,
  gstin: z.string().trim().toUpperCase().or(z.literal('')).optional(),
  creditLimit: z.coerce.number().min(0).max(100000000).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();

export const listPartiesQuerySchema = z.object({
  type: z.enum([...Object.values(PARTY_TYPES), 'all']).optional().default('retailer'),
  status: z.enum([...Object.values(PARTY_STATUS), 'all']).optional().default('all'),
  q: z.string().trim().max(100).optional().default(''),
  sort: z.enum(['name', '-name', '-createdAt', 'createdAt', '-balance', 'balance']).optional().default('name'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const statusSchema = z.object({
  status: z.enum(Object.values(PARTY_STATUS)),
});

export const idParamSchema = z.object({ id: objectId });

export const rateParamSchema = z.object({ id: objectId, itemId: objectId });

export const setRateSchema = z.object({
  rate: z.coerce.number().min(0).max(100000000).nullable(),
  note: z.string().trim().max(200).optional().default(''),
});

export const listRatesQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  categoryId: objectId.or(z.literal('')).or(z.literal('none')).optional().default(''),
  onlyCustom: z.enum(['true', 'false']).optional().default('false'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const bulkRateSchema = z.object({
  mode: z.enum(['percentOffWholesale', 'percentOffSale', 'percentOnPurchase', 'clear']),
  value: z.coerce.number().min(-100).max(1000).optional().default(0),
  categoryId: objectId.or(z.literal('')).nullable().optional(),
  roundTo: z.enum(['none', '1', '0.5', '5', '10']).optional().default('none'),
});

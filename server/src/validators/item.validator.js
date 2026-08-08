import { z } from 'zod';
import { UNITS, STOCK_MOVEMENT_TYPES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');
const money = z.coerce.number().min(0, 'Price negative nahi ho sakta').max(100000000);
const qty = z.coerce.number().min(-1000000).max(10000000);

export const createItemSchema = z.object({
  name: z.string().trim().min(1, 'Item ka naam daalein').max(120),
  sku: z.string().trim().max(40).optional().default(''),
  description: z.string().trim().max(1000).optional().default(''),
  categoryId: objectId.or(z.literal('')).nullable().optional(),
  unit: z.enum(UNITS).optional().default('PCS'),

  // Part 11 — pehchan, warranty, godown
  brand: z.string().trim().max(60).optional().default(''),
  modelNo: z.string().trim().max(60).optional().default(''),
  barcode: z.string().trim().max(60).optional().default(''),
  warrantyMonths: z.coerce.number().min(0).max(240).optional().default(0),
  warrantyNote: z.string().trim().max(200).optional().default(''),
  rack: z.string().trim().max(40).optional().default(''),
  minOrderQty: z.coerce.number().min(0).max(100000).optional().default(0),
  mrp: money.optional().default(0),

  purchasePrice: money.optional().default(0),
  salePrice: money.optional().default(0),
  wholesalePrice: money.optional().default(0),

  openingStock: qty.optional().default(0),
  lowStockAt: z.coerce.number().min(0).max(1000000).optional().default(5),

  hsn: z.string().trim().max(10).optional().default(''),
  gstRate: z.coerce.number().min(0).max(28).optional().default(0),
  priceIncludesGst: z.boolean().optional().default(false),

  visibleToRetailers: z.boolean().optional().default(true),
});

export const updateItemSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sku: z.string().trim().max(40).optional(),
  description: z.string().trim().max(1000).optional(),
  categoryId: objectId.or(z.literal('')).nullable().optional(),
  unit: z.enum(UNITS).optional(),

  brand: z.string().trim().max(60).optional(),
  modelNo: z.string().trim().max(60).optional(),
  barcode: z.string().trim().max(60).optional(),
  warrantyMonths: z.coerce.number().min(0).max(240).optional(),
  warrantyNote: z.string().trim().max(200).optional(),
  rack: z.string().trim().max(40).optional(),
  minOrderQty: z.coerce.number().min(0).max(100000).optional(),
  mrp: money.optional(),

  purchasePrice: money.optional(),
  salePrice: money.optional(),
  wholesalePrice: money.optional(),

  lowStockAt: z.coerce.number().min(0).max(1000000).optional(),

  hsn: z.string().trim().max(10).optional(),
  gstRate: z.coerce.number().min(0).max(28).optional(),
  priceIncludesGst: z.boolean().optional(),

  visibleToRetailers: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).strict();

export const listItemsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  categoryId: objectId.or(z.literal('')).or(z.literal('none')).optional().default(''),
  brand: z.string().trim().max(60).optional().default(''),
  stock: z.enum(['all', 'low', 'out', 'in']).optional().default('all'),
  status: z.enum(['active', 'inactive', 'all']).optional().default('active'),
  sort: z.enum(['name', '-name', 'stockQty', '-stockQty', 'createdAt', '-createdAt', 'salePrice', '-salePrice'])
    .optional().default('name'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const adjustStockSchema = z.object({
  mode: z.enum(['add', 'remove', 'set']),
  qty: z.coerce.number().min(0, 'Quantity negative nahi ho sakti').max(10000000),
  note: z.string().trim().max(200).optional().default(''),
  type: z.enum(Object.values(STOCK_MOVEMENT_TYPES)).optional().default('ADJUSTMENT'),
});

export const bulkActionSchema = z.object({
  ids: z.array(objectId).min(1, 'Kam se kam ek item chunein').max(500),
  action: z.enum(['activate', 'deactivate', 'delete', 'setCategory', 'showToRetailers', 'hideFromRetailers']),
  categoryId: objectId.or(z.literal('')).nullable().optional(),
});

export const importSchema = z.object({
  csv: z.string().min(1, 'CSV khali hai').max(2_000_000),
  commit: z.boolean().optional().default(false),
});

export const idParamSchema = z.object({
  id: objectId,
});

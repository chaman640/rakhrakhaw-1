import { z } from 'zod';
import { ORDER_STATUS, NOTIFICATION_TYPES } from '../config/constants.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

export const listOrdersQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  status: z.enum([...Object.values(ORDER_STATUS), 'all', 'open']).optional().default('all'),
  partyId: objectId.or(z.literal('')).optional().default(''),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['-createdAt', 'createdAt', '-itemsTotal', 'itemsTotal']).optional().default('-createdAt'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(25),
});

export const statusSchema = z.object({
  status: z.enum([ORDER_STATUS.PACKED, ORDER_STATUS.READY, ORDER_STATUS.DELIVERED]),
  note: z.string().trim().max(300).optional().default(''),
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional().default(''),
});

export const updateItemsSchema = z.object({
  items: z.array(z.object({
    itemId: objectId,
    qty: z.coerce.number().min(0).max(10000000),
  })).min(1, 'Kam se kam ek item rakhna hoga').max(200),
  note: z.string().trim().max(300).optional().default(''),
});

export const idParamSchema = z.object({ id: objectId });

export const notificationQuerySchema = z.object({
  onlyUnread: z.enum(['true', 'false']).optional().default('false'),
  type: z.enum([...Object.values(NOTIFICATION_TYPES), 'all']).optional().default('all'),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(30),
});

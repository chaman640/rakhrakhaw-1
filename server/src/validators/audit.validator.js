import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  // `invoice` likhne se invoice.create, invoice.cancel — dono aa jate hain
  action: z.string().trim().max(40).optional().default('all'),
  entityType: z.string().trim().max(30).optional().default('all'),
  userId: objectId.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const entityParamSchema = z.object({
  entityType: z.string().trim().min(2).max(30),
  entityId: objectId,
});

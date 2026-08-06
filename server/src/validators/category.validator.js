import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category ka naam daalein').max(60),
  description: z.string().trim().max(300).optional().default(''),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category ka naam daalein').max(60).optional(),
  description: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Galat id'),
});

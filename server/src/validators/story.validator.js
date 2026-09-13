import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Galat id');

export const storyIdParamSchema = z.object({
  id: objectId,
});

export const createStorySchema = z.object({
  caption: z.string().trim().max(200).optional().default(''),
});

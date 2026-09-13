import { z } from 'zod';

// YouTube ka URL ho ya khali — khud se link check nahi karte (URL hi kaafi hai)
const videoUrl = z.string().trim().max(500).optional().default('');

export const upsertTutorialSchema = z.object({
  key: z.string().trim().min(1, 'Key zaroori hai').max(80),
  title: z.string().trim().min(1, 'Naam likhein').max(120),
  order: z.coerce.number().int().min(0).max(1000).optional().default(0),
  inOnboardingTour: z.boolean().optional().default(false),
  videos: z.object({
    hi: videoUrl,
    en: videoUrl,
  }).optional().default({}),
});

export const tutorialKeyParamSchema = z.object({
  key: z.string().trim().min(1).max(80),
});

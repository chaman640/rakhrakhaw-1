import mongoose from 'mongoose';
import {
  CONTENT_CATEGORIES, CONTENT_USER_TYPES, CONTENT_PLATFORMS, CONTENT_STATUS,
} from '../config/contentOptions.js';

/**
 * Help content — video, help article ya FAQ. Kahan dikhe (placement), kise
 * (user type, plan, platform) aur kis bhasha me — sab admin panel se, code se nahi.
 * Ek tutorial ke Hindi/English do version; chuni bhasha na ho to doosri dikhti hai.
 */
const tutorialVideoSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    kind: { type: String, enum: ['video', 'article', 'faq'], default: 'video' },
    title: { type: String, required: true, trim: true },
    titleHi: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    body: { type: String, trim: true, maxlength: 10000, default: '' },
    bodyHi: { type: String, trim: true, maxlength: 10000, default: '' },
    thumbnailUrl: { type: String, trim: true, default: '' },
    videos: {
      hi: { type: String, default: '' },
      en: { type: String, default: '' },
    },
    category: { type: String, enum: [...CONTENT_CATEGORIES, ''], default: '' },
    placements: { type: [String], default: [] },
    userTypes: { type: [{ type: String, enum: CONTENT_USER_TYPES }], default: [] },
    plans: { type: [String], default: [] },
    platforms: { type: [{ type: String, enum: CONTENT_PLATFORMS }], default: [] },
    status: { type: String, enum: CONTENT_STATUS, default: 'published' },
    publishAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    inOnboardingTour: { type: Boolean, default: false },
  },
  { timestamps: true },
);

tutorialVideoSchema.index({ inOnboardingTour: 1, order: 1 });
tutorialVideoSchema.index({ status: 1, placements: 1, order: 1 });

export default mongoose.model('TutorialVideo', tutorialVideoSchema);

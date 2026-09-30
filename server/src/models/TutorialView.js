import mongoose from 'mongoose';

// Kaun sa tutorial sach me dekha ja raha hai — ek dekhne ka ek record
const tutorialViewSchema = new mongoose.Schema(
  {
    tutorialId: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorialVideo', required: true },
    viewer: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lang: { type: String, default: '' },
    platform: { type: String, default: '' },
    seconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

tutorialViewSchema.index({ tutorialId: 1, createdAt: -1 });

export default mongoose.model('TutorialView', tutorialViewSchema);

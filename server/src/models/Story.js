import mongoose from 'mongoose';

/**
 * STORY — WhatsApp Status jaisa (Part 25).
 *
 * Sirf wholesaler lagata hai, jude hue retailer dekhte hain — apni dukaan ke
 * logo ke around ring isi se bharti hai. 24 GHANTE ME KHUD MIT JATA HAI, TTL
 * index se (Message.js jaisa hi tarika, wahan wajah likhi hai).
 *
 * `viewedBy` me sirf ek chhota sa string rakha hai (jaise "user:<id>" ya
 * "biz:<id>") — poora sub-document banane ki zarurat nahi thi, bas itna
 * jaanna hai ki "isne dekh li" ya nahi.
 */
const storySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    imageUrl: { type: String, required: true },
    imagePublicId: { type: String, required: true },
    caption: { type: String, trim: true, maxlength: 200, default: '' },
    viewedBy: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

storySchema.index({ businessId: 1, createdAt: -1 });
// 24 ghante = 24*60*60 second
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export default mongoose.model('Story', storySchema);

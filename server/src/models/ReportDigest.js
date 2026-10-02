import mongoose from 'mongoose';

/**
 * Hafte/mahine ka hisaab ek dukaan ko ek hi baar jaye — `period` jaise
 * "W:2026-09-21" ya "M:2026-09". Unique index se do server ek saath chalein
 * tab bhi doosri baar nahi jata.
 */
const reportDigestSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    period: { type: String, required: true },
  },
  { timestamps: true }
);

reportDigestSchema.index({ businessId: 1, period: 1 }, { unique: true });
reportDigestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 86400 });

export default mongoose.model('ReportDigest', reportDigestSchema);

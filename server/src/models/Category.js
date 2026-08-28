import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ businessId: 1, name: 1 }, { unique: true });

export default mongoose.model('Category', categorySchema);

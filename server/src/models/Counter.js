import mongoose from 'mongoose';
import { getFinancialYear } from '../utils/financialYear.js';
import { padNumber } from '../utils/generateCode.js';

/**
 * Document numbering. Har business ka apna series, har financial year me reset.
 * Result: RB/26-27/0001
 */
const counterSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    key: { type: String, required: true },  // 'invoice' | 'order' | 'purchase' | 'payment'
    fy: { type: String, required: true },   // '26-27'
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ businessId: 1, key: 1, fy: 1 }, { unique: true });

// Atomic increment — do orders ek saath aayen tab bhi number duplicate nahi hoga
counterSchema.statics.nextNumber = async function ({ businessId, key, prefix = '', date = new Date(), width = 4 }) {
  const fy = getFinancialYear(date);
  const doc = await this.findOneAndUpdate(
    { businessId, key, fy },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const parts = [prefix, fy, padNumber(doc.seq, width)].filter(Boolean);
  return { number: parts.join('/'), seq: doc.seq, fy };
};

export default mongoose.model('Counter', counterSchema);

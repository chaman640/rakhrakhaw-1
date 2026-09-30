import mongoose from 'mongoose';

// Apna ledger account (jaise "HDFC Loan", "Furniture") — system wale accounts code me hain
const accountHeadSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    group: { type: String, enum: ['asset', 'liability', 'equity', 'income', 'expense'], required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

accountHeadSchema.index({ businessId: 1, name: 1 });

export default mongoose.model('AccountHead', accountHeadSchema);

import mongoose from 'mongoose';

/**
 * Haath se entry — journal, contra (cash↔bank), capital, loan, asset.
 * Dr aur Cr ka jod barabar hona zaroori hai. Galat ho to cancel, mitao mat.
 */
const lineSchema = new mongoose.Schema(
  {
    account: { type: String, required: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const journalVoucherSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    voucherNo: { type: String, required: true },
    kind: { type: String, enum: ['journal', 'contra'], default: 'journal' },
    date: { type: Date, required: true },
    lines: { type: [lineSchema], validate: (v) => v.length >= 2 },
    narration: { type: String, trim: true, maxlength: 300, default: '' },
    cancelled: { type: Boolean, default: false },
    cancelReason: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

journalVoucherSchema.index({ businessId: 1, date: -1 });

export default mongoose.model('JournalVoucher', journalVoucherSchema);

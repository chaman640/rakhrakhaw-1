import mongoose from 'mongoose';

/** Bank / UPI-linked account in the books; money docs point here via bankAccountId */
const bankAccountSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, trim: true, maxlength: 60, required: true },
    bankName: { type: String, trim: true, maxlength: 60, default: '' },
    accountNo: { type: String, trim: true, maxlength: 30, default: '' },
    ifsc: { type: String, trim: true, uppercase: true, maxlength: 11, default: '' },
    openingBalance: { type: Number, default: 0 },
    openingDate: { type: Date, default: null },
    isDefault: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('BankAccount', bankAccountSchema);

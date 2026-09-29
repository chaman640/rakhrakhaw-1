import mongoose from 'mongoose';

// Advance kharch NAHI hai — payroll me salary se katta hai; tab salary ka poora kharch banta hai
const salaryAdvanceSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, default: Date.now },
    mode: { type: String, default: 'CASH' },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    recoveredInPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

salaryAdvanceSchema.index({ businessId: 1, userId: 1, recoveredInPayrollId: 1 });

export default mongoose.model('SalaryAdvance', salaryAdvanceSchema);

import mongoose from 'mongoose';

export const PAYROLL_STATUS = ['draft', 'approved', 'paid', 'cancelled'];

/**
 * Ek employee, ek mahina. Paid hone ke baad badla nahi ja sakta — galti ho to
 * cancel (register me) aur naya. Salary ka kharch (Expense) isi se banta hai.
 */
const payrollSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    period: { type: String, required: true },
    payrollNo: { type: String, required: true },
    status: { type: String, enum: PAYROLL_STATUS, default: 'draft' },

    workingDays: { type: Number, default: 0 },
    paidDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },

    basic: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    incentive: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    commissionSales: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    leaveDeduction: { type: Number, default: 0 },
    otherDeduction: { type: Number, default: 0 },
    advanceAdjusted: { type: Number, default: 0 },
    gross: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    note: { type: String, trim: true, maxlength: 500, default: '' },

    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paymentMode: { type: String, default: '' },
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true },
);

payrollSchema.index({ businessId: 1, period: 1, userId: 1 });

export default mongoose.model('Payroll', payrollSchema);

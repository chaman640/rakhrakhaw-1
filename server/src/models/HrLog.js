import mongoose from 'mongoose';

// HR ka register — employee/salary/attendance ke har badlav ka purana aur naya
const hrLogSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    employeeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: '' },
    action: { type: String, required: true },
    summary: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

hrLogSchema.index({ businessId: 1, employeeUserId: 1, createdAt: -1 });

const readOnly = () => { throw new Error('HR register badla ya mitaya nahi ja sakta'); };
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace']) {
  hrLogSchema.pre(op, readOnly);
}

export default mongoose.model('HrLog', hrLogSchema);

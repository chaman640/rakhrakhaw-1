import mongoose from 'mongoose';

/**
 * ADMIN KA REGISTER — har zaroori admin kaam ka record.
 *
 * "Rahul Admin ne Ramesh Traders ka plan ₹100 se ₹500 kiya, 12 Sep 3:10 baje"
 * — purana aur naya dono ke saath. Platform ke paise aur dukaan ke haq yahi
 * badalte hain, isliye ye record MITAYA ya BADLA nahi ja sakta: model khud
 * update/delete pe mana karta hai, aur koi route bhi nahi hai.
 */
const adminAuditSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, default: null },
    adminEmail: { type: String, default: '' },
    action: { type: String, required: true },            // 'business.suspend', 'plan.change'...
    targetType: { type: String, default: '' },           // 'Business', 'PlatformConfig'...
    targetId: { type: String, default: '' },
    targetLabel: { type: String, default: '' },          // dukaan ka naam — padhne me aasan
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    note: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminAuditSchema.index({ createdAt: -1 });

const readOnly = function readOnly() {
  throw new Error('Admin ka register badla ya mitaya nahi ja sakta');
};
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne',
  'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace']) {
  adminAuditSchema.pre(op, readOnly);
}

export default mongoose.model('AdminAudit', adminAuditSchema);

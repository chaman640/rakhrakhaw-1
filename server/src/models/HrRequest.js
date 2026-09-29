import mongoose from 'mongoose';

/**
 * Employee ki har arzi ek jagah: chhutti, attendance sudhaar, HR/help request.
 * Manager/HR manzoor ya mana karta hai; employee khud record nahi badal sakta.
 */
const hrRequestSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['leave', 'correction', 'help'], required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'closed'], default: 'pending' },

    leaveType: { type: String, trim: true, default: '' },
    paid: { type: Boolean, default: true },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    days: { type: Number, default: 0 },

    day: { type: String, default: '' },
    wantStatus: { type: String, default: '' },

    category: { type: String, trim: true, default: '' },
    subject: { type: String, trim: true, maxlength: 160, default: '' },

    reason: { type: String, trim: true, maxlength: 1000, default: '' },
    messages: {
      type: [{
        byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        byName: { type: String, default: '' },
        text: { type: String, trim: true, maxlength: 1000 },
        at: { type: Date, default: Date.now },
      }],
      default: [],
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true },
);

hrRequestSchema.index({ businessId: 1, kind: 1, status: 1, createdAt: -1 });
hrRequestSchema.index({ businessId: 1, userId: 1, kind: 1 });

export default mongoose.model('HrRequest', hrRequestSchema);

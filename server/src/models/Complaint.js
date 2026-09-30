import mongoose from 'mongoose';

const oid = mongoose.Schema.Types.ObjectId;
export const COMPLAINT_STATUS = ['new', 'assigned', 'processing', 'resolved', 'closed'];
export const COMPLAINT_PRIORITY = ['urgent', 'medium', 'normal'];
export const COMPLAINT_CATEGORY = ['damaged', 'short_supply', 'wrong_item', 'quality', 'late_delivery', 'billing', 'other'];

const complaintSchema = new mongoose.Schema(
  {
    businessId: { type: oid, ref: 'Business', required: true },
    complaintNo: { type: String, required: true },
    partyId: { type: oid, ref: 'Party', required: true },
    invoiceId: { type: oid, ref: 'Invoice', default: null },
    invoiceNo: { type: String, default: '' },
    subject: { type: String, trim: true, maxlength: 160, required: true },
    detail: { type: String, trim: true, maxlength: 2000, default: '' },
    category: { type: String, enum: COMPLAINT_CATEGORY, default: 'other' },
    priority: { type: String, enum: COMPLAINT_PRIORITY, default: 'normal' },
    status: { type: String, enum: COMPLAINT_STATUS, default: 'new' },
    assignedToUserId: { type: oid, ref: 'User', default: null },
    resolution: { type: String, trim: true, maxlength: 2000, default: '' },
    resolvedAt: { type: Date, default: null },
    createdBy: { type: oid, ref: 'User', default: null },
    history: {
      type: [{
        _id: false,
        at: { type: Date, default: Date.now },
        byName: { type: String, default: '' },
        action: { type: String, default: '' },
        note: { type: String, default: '' },
      }],
      default: [],
    },
  },
  { timestamps: true },
);

complaintSchema.index({ businessId: 1, status: 1, createdAt: -1 });
complaintSchema.index({ businessId: 1, partyId: 1 });

export default mongoose.model('Complaint', complaintSchema);

import mongoose from 'mongoose';

const oid = mongoose.Schema.Types.ObjectId;

/** Call / meeting / visit notes on a customer */
const crmNoteSchema = new mongoose.Schema(
  {
    businessId: { type: oid, ref: 'Business', required: true },
    partyId: { type: oid, ref: 'Party', required: true },
    kind: { type: String, enum: ['note', 'call', 'meeting', 'visit'], default: 'note' },
    text: { type: String, trim: true, maxlength: 1000, required: true },
    nextFollowUpAt: { type: Date, default: null },
    taskId: { type: oid, ref: 'CrmTask', default: null },
    byUserId: { type: oid, ref: 'User', default: null },
    byName: { type: String, default: '' },
  },
  { timestamps: true },
);

crmNoteSchema.index({ businessId: 1, partyId: 1, createdAt: -1 });

export default mongoose.model('CrmNote', crmNoteSchema);

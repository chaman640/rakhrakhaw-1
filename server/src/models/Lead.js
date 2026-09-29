import mongoose from 'mongoose';

/**
 * LEAD — sambhavit grahak, jo abhi retailer nahi bana.
 *
 * "Amit Mobile mila, abhi hamara grahak nahi" — CRM me lead banta hai, stage
 * aage badhti hai (naya → baat hui → interest → quotation → mol-bhav → jeeta
 * ya haara). Jeetne pe usi se Party (retailer) ban jati hai — dobara naam,
 * phone likhna nahi padta, aur lead ka poora itihaas `partyId` se juda rehta.
 */
export const LEAD_STAGES = ['new', 'contacted', 'interested', 'quotation', 'negotiation', 'won', 'lost'];
export const LEAD_SOURCES = ['walkin', 'referral', 'whatsapp', 'instagram', 'website', 'salesman', 'call', 'other'];

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, maxlength: 1000, required: true },
    kind: { type: String, enum: ['note', 'call', 'meeting', 'visit'], default: 'note' },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const leadSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    shopName: { type: String, trim: true, maxlength: 120, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    city: { type: String, trim: true, maxlength: 60, default: '' },
    source: { type: String, enum: LEAD_SOURCES, default: 'other' },
    stage: { type: String, enum: LEAD_STAGES, default: 'new' },
    expectedValue: { type: Number, min: 0, default: 0 },
    lostReason: { type: String, trim: true, maxlength: 200, default: '' },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    nextFollowUpAt: { type: Date, default: null },
    notes: { type: [noteSchema], default: [] },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },   // jeetne ke baad
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    stageChangedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

leadSchema.index({ businessId: 1, stage: 1, updatedAt: -1 });
leadSchema.index({ businessId: 1, assignedToUserId: 1 });

export default mongoose.model('Lead', leadSchema);

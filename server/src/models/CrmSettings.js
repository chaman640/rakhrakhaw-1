import mongoose from 'mongoose';

const oid = mongoose.Schema.Types.ObjectId;

/** CRM rules per business — thresholds, automation, lead routing, territories */
const crmSettingsSchema = new mongoose.Schema(
  {
    businessId: { type: oid, ref: 'Business', required: true, unique: true },
    vipAmount: { type: Number, min: 0, default: 1000000 },
    highValueAmount: { type: Number, min: 0, default: 200000 },
    inactiveDays: { type: Number, min: 7, max: 365, default: 60 },
    newDays: { type: Number, min: 1, max: 180, default: 30 },
    quotationFollowUpDays: { type: Number, min: 1, max: 60, default: 3 },
    leadNoResponseDays: { type: Number, min: 1, max: 60, default: 3 },
    automation: {
      enabled: { type: Boolean, default: true },
      reorder: { type: Boolean, default: true },
      inactivity: { type: Boolean, default: true },
      quotation: { type: Boolean, default: true },
      leadEscalation: { type: Boolean, default: true },
    },
    leadAssign: {
      mode: { type: String, enum: ['none', 'round_robin', 'rules'], default: 'none' },
      userIds: { type: [{ type: oid, ref: 'User' }], default: [] },
      rules: {
        type: [{
          _id: false,
          city: { type: String, trim: true, default: '' },
          source: { type: String, trim: true, default: '' },
          minValue: { type: Number, min: 0, default: 0 },
          userId: { type: oid, ref: 'User', required: true },
        }],
        default: [],
      },
      cursor: { type: Number, default: 0 },
    },
    complaintAssigneeUserId: { type: oid, ref: 'User', default: null },
    territories: {
      type: [{
        name: { type: String, trim: true, maxlength: 60, required: true },
        cities: { type: [String], default: [] },
        userId: { type: oid, ref: 'User', default: null },
      }],
      default: [],
    },
    lastAutoRunAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('CrmSettings', crmSettingsSchema);

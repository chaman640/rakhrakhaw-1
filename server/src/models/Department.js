import mongoose from 'mongoose';

// kind: department | designation — dono ek jaise simple list hain, ek collection
const orgUnitSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    kind: { type: String, enum: ['department', 'designation'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    managerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

orgUnitSchema.index({ businessId: 1, kind: 1, name: 1 });

export default mongoose.model('OrgUnit', orgUnitSchema);

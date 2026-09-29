import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    leaderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    memberIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    monthlyTarget: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Team', teamSchema);

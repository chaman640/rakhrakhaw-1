import mongoose from 'mongoose';

// Party-wise item rate: "Suresh ko bearing 95 me dena hai, baaki sabko 100"
const partyItemRateSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    rate: { type: Number, required: true, min: 0 },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

partyItemRateSchema.index({ businessId: 1, partyId: 1, itemId: 1 }, { unique: true });

export default mongoose.model('PartyItemRate', partyItemRateSchema);

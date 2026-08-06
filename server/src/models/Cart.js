import mongoose from 'mongoose';

/**
 * Retailer ka cart server pe rehta hai (localStorage me nahi) — teen wajah:
 *   1. Phone pe daal kar laptop pe kholo, cart wahin rehta hai
 *   2. Har baar padhte waqt rate dobara resolve hota hai — purana rate atak nahi jata
 *   3. Part 7 me "cart chhod diya" jaise cheezein dekhi ja sakti hain
 *
 * Sirf itemId + qty store hota hai. Rate/total kabhi store nahi hote —
 * wo hamesha rate.service se abhi ka nikalta hai.
 */
const cartItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    qty: { type: Number, required: true, min: 0.01 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    items: { type: [cartItemSchema], default: [] },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

cartSchema.index({ businessId: 1, partyId: 1 }, { unique: true });

export default mongoose.model('Cart', cartSchema);

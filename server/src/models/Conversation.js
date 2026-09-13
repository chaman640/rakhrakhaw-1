import mongoose from 'mongoose';

/**
 * CHAT — ek dukaan aur ek retailer ke beech (Part 25).
 *
 * `(businessId, partyId)` ka jodi — bilkul waisi hi jaisi Invoice/LedgerEntry
 * me hoti hai. Ek Conversation TABHI banti hai jab pehla message bhej diya
 * jaaye — isi wajah se contact list WhatsApp jaisi rehti hai: sirf unhi ka
 * naam dikhta hai jinse baat ho chuki hai, sabki list nahi.
 */
const conversationSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },

    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSnippet: { type: String, default: '' },
    lastMessageBy: { type: String, enum: ['wholesaler', 'retailer'], default: 'retailer' },

    // Neeli bindi ki ginti — dono taraf alag alag, kyunki dono alag waqt padhte hain
    unreadForWholesaler: { type: Number, default: 0 },
    unreadForRetailer: { type: Number, default: 0 },
  },
  { timestamps: true },
);

conversationSchema.index({ businessId: 1, partyId: 1 }, { unique: true });

export default mongoose.model('Conversation', conversationSchema);

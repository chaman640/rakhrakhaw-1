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
    /**
     * DAALTE WAQT jo rate DIKHA tha.
     *
     * Ye rate hisaab me kabhi nahi lagta — order aaj ke rate pe hi jata hai,
     * aur wahi theek hai. Ye sirf ye batane ke liye hai ki BADAL GAYA HAI.
     *
     * Bina iske ek chup-chaap dhokha hota tha: retailer ne ₹100 dekh kar cart
     * me daala, wholesaler ne beech me rate ₹120 kar diya, aur checkout pe
     * ₹120 likha aa gaya — bina kisi ishare ke. Retailer ko lagta tha usne
     * galat padha tha, ya app jhooth bol raha hai. Ab wo saaf dikhta hai:
     * "pehle ₹100 tha".
     */
    addedRate: { type: Number, default: 0 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    items: { type: [cartItemSchema], default: [] },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

cartSchema.index({ businessId: 1, partyId: 1 }, { unique: true });

export default mongoose.model('Cart', cartSchema);

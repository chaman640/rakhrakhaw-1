import mongoose from 'mongoose';

/**
 * STOCK KI EK KHEP — jitna maal ek baar me aaya, apni LAGAT ke saath.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ye kyun chahiye tha
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ab tak har item pe ek hi `purchasePrice` tha, aur har nayi kharid us par
 * likh deti thi. Dukaan me iska matlab ye nikalta tha:
 *
 *   Jan me 100 bolt ₹80 me aaye.  50 bike, 50 pade hain.
 *   Feb me 100 aur aaye, par ab rate ₹100 hai.
 *
 * App turant maan leta tha ki DUKAAN ME PADA HAR BOLT ₹100 ka hai — wo 50
 * bhi jo ₹80 me aaye the. Yani wo 50 bechne par har piece pe ₹20 ka fayda
 * kam dikhta tha. Maal wahi, paisa wahi, sirf hisaab galat.
 *
 * Ab har khep alag rehti hai, apni lagat ke saath, aur maal PEHLE AAYA
 * PEHLE JAYE (FIFO) ke hisaab se nikalta hai. Wahi 50 purane bolt ₹80 ki
 * lagat pe hi bikenge, chahe godown me naya maal kitne ka bhi aaya ho.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Kram `date` se chalta hai, `createdAt` se nahi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Purani kharid aaj bhi entry ho sakti hai ("pichhle hafte ka bill reh gaya
 * tha"). Us halat me wo khep PURANI hai, chahe app me abhi bani ho. Isliye
 * FIFO ka kram document ki tareekh se lagta hai — aur ek hi din ki do khep
 * ho to `createdAt` se, taaki kram kabhi dagmagaye nahi.
 *
 * `remaining` alag isliye hai ki `qty` kabhi badalti nahi — "kitna aaya tha"
 * ek itihaas hai. Kitna bacha, wo `remaining` batati hai.
 */
const stockLotSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },

    unitCost: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 0 },        // kitna aaya tha — kabhi nahi badalta
    remaining: { type: Number, required: true, min: 0 },  // kitna bacha hai

    source: {
      type: String,
      enum: ['PURCHASE', 'OPENING', 'ADJUSTMENT', 'SALE_RETURN'],
      default: 'PURCHASE',
    },
    refType: { type: String, default: null },
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refNo: { type: String, default: '' },

    date: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// FIFO ki asli query: "is item ki khali na hui khep, purani pehle"
stockLotSchema.index({ businessId: 1, itemId: 1, remaining: 1, date: 1, createdAt: 1 });
// Document delete hone par uski khep dhoondhne ke liye
stockLotSchema.index({ businessId: 1, refType: 1, refId: 1 });

export default mongoose.model('StockLot', stockLotSchema);

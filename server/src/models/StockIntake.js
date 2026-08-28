import mongoose from 'mongoose';
import { UNITS } from '../config/constants.js';

/**
 * KHAREEDA HUA MAAL APNI DUKAAN ME.
 *
 * Ye us jagah ka pul hai jahan pehle kuch tha hi nahi.
 *
 * Bada wholesaler bill banata hai. Us bill me maal ka naam, ginti, rate aur GST
 * sab likha hota hai — poora sach, uske apne hisaab me. Par kharidne wale ke
 * yahan wo bill sirf ek KAGAZ hai: uska apna stock waise ka waisa pada rehta
 * hai, aur use wahi maal DOBARA haath se banana padta hai — naam likho, unit
 * chuno, rate daalo, HSN daalo, quantity daalo. Bees item ka bill matlab bees
 * baar wahi kaam, aur har baar ek nayi galti ka mauka.
 *
 * Ab bill bante hi kharidne wale ke yahan ye kaam apne aap ban jata hai, poora
 * bhara hua. Use sirf do baat batani hoti hai, wo bhi ek ek item pe:
 *
 *      1. Ye mera kaunsa item hai?  (ya naya bana do)
 *      2. Ise bechunga kitne me?     (bechne ka rate)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * YE STOCK KHUD NAHI BADHATA — Purchase banata hai.
 *
 * Sabse aasan raasta ye hota ki yahin se stock badha diya jaye. Wo bahut bura
 * hota: stock badhne ke saath khep (FIFO ki lagat), supplier ka khata, GST ka
 * input credit aur purchase ka number — sab ek saath banne chahiye, aur wo
 * poora hisaab pehle se `purchase.service.js` me ek hi jagah likha hai.
 *
 * Isliye ye file sirf FAISLE yaad rakhti hai. Aakhir me wahi purana
 * `createPurchase()` chalta hai. Faayda: return, GST report, Fayda-Nuksan aur
 * FIFO — kisi me ek line badalni nahi padi, aur is raste se aaya maal bilkul
 * waise hi bartaav karta hai jaise haath se ki hui kharid.
 * ─────────────────────────────────────────────────────────────────────────
 */

const intakeLineSchema = new mongoose.Schema(
  {
    /* ---- Bechne wale ke bill ka SNAPSHOT (isse kabhi nahi badalte) ---- */
    sourceName: { type: String, required: true },
    /*
      SKU yahan JAAN-BOOJH KAR nahi hai.

      Bill pe bechne wale ka apna code chhapta hai. Wo uske apne godown ka code
      hai — kharidne wale ke code se uska koi rishta nahi. Us par milaan karne
      se app aksar bilkul galat item ko "pakka yahi hai" bata deti, aur
      dukaandaar bina padhe haan kar deta. Naam aur HSN hi wo do cheezein hain
      jo dono taraf ek matlab rakhti hain.
    */
    hsn: { type: String, default: '' },
    unit: { type: String, enum: UNITS, default: 'PCS' },
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    /**
     * Ek piece kitne ka pada — DO number, aur dono zaroori hain.
     *
     * GST WALE ke liye lagat me tax nahi jodte: wo sarkar ka paisa hai, aapki
     * lagat nahi, aur input credit me wapas mil jata hai.
     *
     * BINA GST WALE ke liye wahi tax ek asli kharch hai — use kabhi wapas nahi
     * milega. Uski lagat me tax jodna hi sach hai.
     *
     * Ek hi number rakhne ki koshish ki thi. Tab GST on/off karte hi purani
     * entry ki lagat jhooth bolne lagti thi. Dono likh dena sasta pada — aur
     * kaun sa dikhana hai ye padhte waqt tay hota hai, likhte waqt nahi.
     */
    unitCostExTax: { type: Number, default: 0 },
    unitCostIncTax: { type: Number, default: 0 },

    /* ---- Kharidne wale ka FAISLA ---- */
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
    sellingPrice: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['PENDING', 'ADDED', 'SKIPPED'],
      default: 'PENDING',
    },
    // Naya item bana tha ya purana mila — sirf batane ke liye
    createdNewItem: { type: Boolean, default: false },
    decidedAt: { type: Date, default: null },
  },
  { _id: false }
);

const stockIntakeSchema = new mongoose.Schema(
  {
    // KHARIDNE WALI dukaan — ye poora record isi ke andar rehta hai
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },

    // Bechne wali dukaan (doosre tenant me hai — isliye sirf pehchan rakhte hain)
    sellerBusinessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    sellerName: { type: String, default: '' },

    /**
     * Bechne wala, KHARIDNE WALI dukaan ke andar supplier ke roop me.
     *
     * Khata isi pe banta hai. Ye Party kharidne wale ke apne business me hoti
     * hai — doosre tenant ki Party yahan kabhi nahi aati, warna multi-tenancy
     * ka poora bandobast wahin toot jata.
     */
    supplierPartyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },

    // Kis bill se aaya (bechne wale ke yahan ka bill)
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    sourceInvoiceNo: { type: String, default: '' },
    invoiceDate: { type: Date, default: Date.now },

    taxableTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    gstEnabled: { type: Boolean, default: false },

    lines: { type: [intakeLineSchema], default: [] },

    status: {
      type: String,
      enum: ['PENDING', 'DONE', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    // Bechne wale ne bill cancel kar diya — kyun ruka, ye likha rehta hai
    cancelReason: { type: String, default: '' },

    // Jab poora ho gaya
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
    completedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/*
  Ek bill ka ek hi kaam.

  Bina is rok ke wahi bill do baar aata (network dobara try kar leta hai, ya
  seller bill banate waqt error dekh kar dobara dabata hai) aur kharidne wale ke
  yahan DO baar wahi maal chadh jata — stock dugna, khep dugni, aur supplier ka
  khata bhi dugna. Ye galti pakadna mahino baad, stock ginte waqt hota hai.
*/
stockIntakeSchema.index({ businessId: 1, sourceInvoiceId: 1 }, { unique: true });
stockIntakeSchema.index({ businessId: 1, status: 1, createdAt: -1 });
// Bechne wale ne bill cancel kiya — us bill ka kaam isi raste se dhoondha jata hai
stockIntakeSchema.index({ sellerBusinessId: 1, sourceInvoiceId: 1 });

export default mongoose.model('StockIntake', stockIntakeSchema);

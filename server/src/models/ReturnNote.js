import mongoose from 'mongoose';
import { RETURN_TYPES, TAX_TYPES, UNITS } from '../config/constants.js';

/**
 * Maal wapas aane ka document.
 *
 * SALE_RETURN     — retailer ne humein maal wapas kiya  -> CREDIT NOTE
 *                   stock BADHTA hai, uska udhaar GHATTA hai
 * PURCHASE_RETURN — humne supplier ko maal wapas kiya    -> DEBIT NOTE
 *                   stock GHATTA hai, supplier ko dena GHATTA hai
 *
 * Ye Invoice se alag model hai (usme milane se dono gande ho jate).
 * GST me bhi credit note ka apna alag number series hota hai.
 */
const returnItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true },
    hsn: { type: String, default: '' },
    unit: { type: String, enum: UNITS, default: 'PCS' },
    // Bill jaisa hi snapshot — wajah Invoice.js me likhi hai
    costPrice: { type: Number, default: 0 },
    // Aur wahi khep ka nishaan — wajah Invoice.js me likhi hai.
    // Sale return me: maal kis khep me WAPAS gaya.
    // Purchase return me: maal kis khep se NIKLA.
    /**
     * Poori line ki lagat — `qty × costPrice` se ye BEHTAR hai.
     *
     * Ek line do khep se ban sakti hai (40 @ ₹80 + 20 @ ₹100 = ₹5,200), aur
     * uski per-piece lagat ₹86.67 par tootti hai. 60 × 86.67 wapas guna karo
     * to ₹5,200.20 milta hai — har aisi line pe kuch paise ka jhooth, aur
     * mahine bhar ke report me wo paise jud kar dikhne lagte hain.
     *
     * Isliye asli jod yahin likha jata hai. `costPrice` sirf "ek piece kitne
     * ka pada" batane ke liye rehti hai, hisaab ke liye nahi.
     */
    costTotal: { type: Number, default: 0 },

    lots: {
      type: [{
        lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockLot', default: null },
        qty: Number,
        unitCost: Number,
        _id: false,
      }],
      default: [],
    },
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    reason: { type: String, default: '' },   // is line ka apna karan
  },
  { _id: false }
);

const returnNoteSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },

    type: { type: String, enum: Object.values(RETURN_TYPES), required: true, index: true },
    returnNo: { type: String, required: true },
    returnDate: { type: Date, default: Date.now },

    // Kis bill/purchase ka maal wapas aaya (marzi se — bina bill ke bhi ho sakta hai)
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },
    againstNo: { type: String, default: '' },   // dikhane ke liye

    // GST ka snapshot — bill ki tarah
    gstEnabled: { type: Boolean, default: false },
    taxType: { type: String, enum: Object.values(TAX_TYPES), default: TAX_TYPES.NONE },

    items: { type: [returnItemSchema], default: [] },

    subTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    businessSnapshot: { type: Object, default: () => ({}) },
    partySnapshot: { type: Object, default: () => ({}) },

    /**
     * Is wapasi ka credit KIS BILL pe laga — aur kitna.
     *
     * Ye pehle tha hi nahi, aur wahi sabse badi galti thi. Wapasi khate me
     * credit daal deti thi (party ka balance ghat jata tha) par bill ka
     * `dueAmount` waise ka waisa pada rehta tha. Nateeja: Payment page kehta
     * "kuch baaki nahi" aur Home kehta "₹4,000 baaki" — dono sach maan kar
     * dukaandaar do baar wasooli karne nikalta tha.
     *
     * Likhna isliye bhi zaroori hai ki wapasi MITAYI bhi ja sakti hai. "Kitna
     * laga tha" yaad na ho to "kitna wapas karna hai" ka jawab bhi nahi hota,
     * aur mitane pe bill hamesha ke liye galat reh jata.
     *
     * `docId` bill ka ya purchase ka — type se pata chal jata hai.
     */
    allocations: {
      type: [{
        _id: false,
        docId: { type: mongoose.Schema.Types.ObjectId, default: null },
        amount: { type: Number, default: 0 },
      }],
      default: [],
    },

    /** Jo credit kisi bill pe nahi laga — wo party ka jama paisa ban gaya */
    advance: { type: Number, default: 0 },

    reason: { type: String, default: '' },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

returnNoteSchema.index({ businessId: 1, returnNo: 1 }, { unique: true });
returnNoteSchema.index({ businessId: 1, returnDate: -1 });
returnNoteSchema.index({ businessId: 1, partyId: 1 });

export default mongoose.model('ReturnNote', returnNoteSchema);

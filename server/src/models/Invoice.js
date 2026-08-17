import mongoose from 'mongoose';
import { DOCUMENT_TYPES, TAX_TYPES, UNITS } from '../config/constants.js';

const invoiceItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true },
    hsn: { type: String, default: '' },
    // Part 11 — warranty ka SNAPSHOT. Baad me item ki warranty badle to
    // purana bill nahi badalna chahiye — customer usi bill pe claim karega.
    warrantyMonths: { type: Number, default: 0 },
    warrantyNote: { type: String, default: '' },
    unit: { type: String, enum: UNITS, default: 'PCS' },

    /* ---- Maal ki LAGAT ka snapshot (Part 15 step 3) ----
     *
     * Bill banate waqt is item ka purchase price kya tha.
     *
     * Ye jodna zaroori tha, aur wajah ek asli galti thi: pehle munafa item ke
     * AAJ ke purchase price se ginte the. Matlab supplier ne rate badha diya
     * aur aapne app me naya rate daal diya — to PICHHLE mahine ka munafa bhi
     * apne aap ghat gaya. Jo hisaab kabhi badalna hi nahi chahiye tha, wo
     * chup-chaap badal jata tha.
     *
     * Ab lagat bill ke saath hi jam jati hai. Purane bill (jinme ye nahi hai)
     * ke liye aaj ka rate hi maan lete hain — usse behtar kuch hai nahi, par
     * naye bill ka hisaab pakka rehta hai.
     */
    costPrice: { type: Number, default: 0 },

    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

// Business ka snapshot — 6 mahine baad address badla to purana invoice na badle
const businessSnapshotSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    gstin: String,
    logoUrl: String,
    address: {
      line1: String, line2: String, city: String,
      state: String, stateCode: String, pincode: String,
    },

    /* ---- Paisa kahan bhejna hai (Part 15) ----
     *
     * Ye bhi SNAPSHOT hai, live nahi.
     *
     * Socha ye tha ki QR hamesha aaj wale UPI se bane — "paisa to naye khate
     * me hi aana chahiye". Par bill ek kagaz hai jo ja chuka hai: retailer ke
     * paas jo chhapa hua bill pada hai usme purana QR hai. Agar app naya QR
     * dikhaye aur kagaz purana, to do alag pate ho jate hain aur jhagda usi
     * din hota hai jis din paisa galat jagah chala jata hai.
     *
     * Isliye bill ke saath uska apna pata bhi jam jata hai. UPI badalna ho to
     * naye bill se badlega — purane waise hi rahenge.
     */
    upiId: String,
    upiName: String,
    bankName: String,
    bankAccountName: String,
    bankAccountNumber: String,
    bankIfsc: String,
  },
  { _id: false }
);

const partySnapshotSchema = new mongoose.Schema(
  { name: String, shopName: String, phone: String, gstin: String, address: Object },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

    invoiceNo: { type: String, required: true },
    invoiceDate: { type: Date, default: Date.now },
    dueDate: { type: Date, default: null },

    // ---- GST OPTIONAL ----
    // gstEnabled invoice banne ke waqt ka SNAPSHOT hai. Wholesaler baad me GST le le,
    // to purane bill "Bill of Supply" hi rahenge — yahi legally sahi hai.
    gstEnabled: { type: Boolean, default: false },
    documentType: {
      type: String,
      enum: Object.values(DOCUMENT_TYPES),
      default: DOCUMENT_TYPES.BILL_OF_SUPPLY,
    },
    taxType: { type: String, enum: Object.values(TAX_TYPES), default: TAX_TYPES.NONE },
    placeOfSupplyStateCode: { type: String, default: '' },

    items: { type: [invoiceItemSchema], default: [] },

    subTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxableTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid', index: true },

    businessSnapshot: { type: businessSnapshotSchema, default: () => ({}) },
    partySnapshot: { type: partySnapshotSchema, default: () => ({}) },

    notes: { type: String, default: '' },
    termsAndConditions: { type: String, default: '' },
    isCancelled: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

invoiceSchema.index({ businessId: 1, invoiceNo: 1 }, { unique: true });
invoiceSchema.index({ businessId: 1, invoiceDate: -1 });
invoiceSchema.index({ businessId: 1, partyId: 1, paymentStatus: 1 });

export default mongoose.model('Invoice', invoiceSchema);

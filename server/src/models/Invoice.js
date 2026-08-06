import mongoose from 'mongoose';
import { DOCUMENT_TYPES, TAX_TYPES, UNITS } from '../config/constants.js';

const invoiceItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true },
    hsn: { type: String, default: '' },
    unit: { type: String, enum: UNITS, default: 'PCS' },
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

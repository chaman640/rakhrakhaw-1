import mongoose from 'mongoose';
import { UNITS } from '../config/constants.js';

const oid = mongoose.Schema.Types.ObjectId;
export const QUOTE_STATUS = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

const lineSchema = new mongoose.Schema(
  {
    itemId: { type: oid, ref: 'Item', required: true },
    name: { type: String, required: true },
    hsn: { type: String, default: '' },
    unit: { type: String, enum: UNITS, default: 'PCS' },
    qty: { type: Number, required: true, min: 0.001 },
    rate: { type: Number, required: true, min: 0 },
    discountPct: { type: Number, min: 0, max: 100, default: 0 },
    gstRate: { type: Number, min: 0, max: 28, default: 0 },
    taxable: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const quotationSchema = new mongoose.Schema(
  {
    businessId: { type: oid, ref: 'Business', required: true },
    quoteNo: { type: String, required: true },
    partyId: { type: oid, ref: 'Party', default: null },
    leadId: { type: oid, ref: 'Lead', default: null },
    customer: { name: String, shopName: String, phone: String, city: String, gstin: String },
    quoteDate: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },
    items: { type: [lineSchema], default: [] },
    subTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    terms: { type: String, trim: true, maxlength: 2000, default: '' },
    deliveryTerms: { type: String, trim: true, maxlength: 300, default: '' },
    paymentTerms: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: QUOTE_STATUS, default: 'draft' },
    sentAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    rejectReason: { type: String, trim: true, maxlength: 300, default: '' },
    orderId: { type: oid, ref: 'Order', default: null },
    revisionOf: { type: oid, ref: 'Quotation', default: null },
    assignedToUserId: { type: oid, ref: 'User', default: null },
    createdBy: { type: oid, ref: 'User', default: null },
  },
  { timestamps: true },
);

quotationSchema.index({ businessId: 1, quoteNo: 1 }, { unique: true });
quotationSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export default mongoose.model('Quotation', quotationSchema);

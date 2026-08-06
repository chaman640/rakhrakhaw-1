import mongoose from 'mongoose';
import { hasValidChecksum } from '../utils/gstin.js';

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    stateCode: { type: String, trim: true, default: '' }, // GST state code, jaise "09" UP
    pincode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: addressSchema, default: () => ({}) },

    // ---- GST OPTIONAL ----
    // Har wholesaler GST registered nahi hota. Ye toggle poori app ka behaviour badalta hai:
    //   true  -> Tax Invoice, HSN + CGST/SGST/IGST breakup, GST reports
    //   false -> Bill of Supply, koi tax column nahi, sirf item rate x qty
    gstEnabled: { type: Boolean, default: false },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      validate: {
        validator(v) {
          if (!this.gstEnabled) return true;      // GST off hai to koi check nahi
          if (!v) return false;                   // GST on hai to GSTIN chahiye
          return hasValidChecksum(v);             // format + official checksum
        },
        message: 'GST on hai to sahi 15-digit GSTIN daalna zaroori hai',
      },
    },

    logoUrl: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },

    // ---- Retailer invite (ek hi shared link, phir approve) ----
    // Ramesh Bhai ek link WhatsApp pe bhejte hain; jo bhi join kare wo 'pending' me
    // aata hai aur approve hone tak catalog nahi dekh sakta.
    inviteCode: { type: String, index: true, sparse: true, default: null },
    inviteEnabled: { type: Boolean, default: true },
    autoApproveRetailers: { type: Boolean, default: false },

    // ---- UPI (Part 9) ----
    // Retailer ko QR aur "pay" link isi se banta hai. Khali chhod do to
    // sirf cash/manual entry chalegi.
    upiId: {
      type: String, trim: true, default: '',
      validate: {
        validator: (v) => !v || /^[\w.\-]{2,64}@[a-zA-Z]{2,32}$/.test(v),
        message: 'UPI ID aisi hoti hai: naam@bank',
      },
    },
    upiName: { type: String, trim: true, default: '' },

    // Invoice settings (Part 8 me use honge)
    invoicePrefix: { type: String, default: 'INV', trim: true },
    orderPrefix: { type: String, default: 'ORD', trim: true },
    termsAndConditions: { type: String, default: '' },
    invoiceFooterNote: { type: String, default: '' },

    // Defaults
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    currency: { type: String, default: 'INR' },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// GST off karne par GSTIN saaf kar do, taaki invoice pe purana number na chhap jaye
businessSchema.pre('save', function (next) {
  if (!this.gstEnabled) this.gstin = '';
  next();
});

export default mongoose.model('Business', businessSchema);

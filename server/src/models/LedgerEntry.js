import mongoose from 'mongoose';
import { LEDGER_TYPES } from '../config/constants.js';

/**
 * KHATA. Har party ka har lena-dena ek row.
 *
 * debit  = party pe udhaar badha  (invoice banaya)
 * credit = party ne paisa diya    (payment aaya)
 * balanceAfter = us entry ke baad ka running balance
 *
 * Party.balance isi collection ki aakhri entry ka mirror hai (fast read ke liye).
 */
const ledgerEntrySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },

    date: { type: Date, default: Date.now },
    type: { type: String, enum: Object.values(LEDGER_TYPES), required: true },

    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, required: true },

    refType: { type: String, default: null },  // 'Invoice' | 'Payment' | 'Purchase'
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    refNo: { type: String, default: '' },      // dikhane ke liye, jaise "INV/26-27/0012"

    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ businessId: 1, partyId: 1, date: -1, createdAt: -1 });
ledgerEntrySchema.index({ businessId: 1, refType: 1, refId: 1 });

export default mongoose.model('LedgerEntry', ledgerEntrySchema);

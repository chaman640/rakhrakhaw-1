import mongoose from 'mongoose';
import { PAYMENT_MODES, PAYMENT_STATUS } from '../config/constants.js';

const paymentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },

    paymentNo: { type: String, required: true },
    date: { type: Date, default: Date.now },

    direction: { type: String, enum: ['IN', 'OUT'], default: 'IN' }, // IN = retailer se aaya
    amount: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: Object.values(PAYMENT_MODES), default: PAYMENT_MODES.CASH },

    reference: { type: String, default: '' },  // UPI txn id / cheque number

    // UPI se retailer ne "paid" mark kiya -> pending. Wholesaler confirm kare -> confirmed.
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.CONFIRMED },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    againstInvoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],

    note: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ businessId: 1, paymentNo: 1 }, { unique: true });
paymentSchema.index({ businessId: 1, partyId: 1, date: -1 });
paymentSchema.index({ businessId: 1, status: 1 });

export default mongoose.model('Payment', paymentSchema);

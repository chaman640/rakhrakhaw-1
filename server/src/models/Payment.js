import mongoose from 'mongoose';
import { PAYMENT_MODES, PAYMENT_STATUS } from '../config/constants.js';

const paymentSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },

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

    /**
     * Kis bill pe KITNA laga.
     *
     * Pehle sirf `againstInvoiceIds` tha — yaani "kaunse bill", "kitna" nahi.
     * Delete karte waqt code ko andaza lagana padta tha, aur do payment ek hi
     * bill pe lagi hon to hisaab galat ho jata tha.
     *
     * `againstInvoiceIds` abhi bhi rakha hai — purani entries usi pe hain, aur
     * query/index bhi usi pe hai. Nayi payments me dono saath saath likhte hain.
     */
    allocations: [{
      _id: false,
      invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
      amount: { type: Number, required: true, min: 0 },
    }],
    againstInvoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],

    /**
     * KIS WAPASI KA PAISA WAPAS KIYA.
     *
     * Wapasi (credit note) khate me credit daal deti hai, par paisa haath se
     * nikla ya nahi — ye kahin likha hi nahi jata tha. Isliye dukaandaar ek hi
     * wapasi ka paisa do baar wapas kar sakta tha, aur app rok bhi nahi sakta
     * tha (uske paas ginne ko kuch tha hi nahi).
     */
    returnNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReturnNote', default: null },

    /**
     * Kharid ke SAATH diya hua paisa.
     *
     * Ab tak aise paise ki sirf khata entry banti thi, Payment ka record nahi
     * — isliye supplier ko diya hua paisa Payment page pe kabhi dikhta hi
     * nahi tha. "Aaj kitna paisa gaya" ka jawab aadha rehta tha.
     *
     * Ye nishaan isliye ki purchase mitne par yahi payment bhi hat jaye aur
     * koi anaath entry na bache.
     */
    sourcePurchaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase', default: null },

    // Bill banate waqt "abhi itna mila" wali payment — bill cancel hoga to yahi hategi.
    // Baad me alag se aayi payments cancel pe delete NAHI hoti, sirf dusre bill pe lag jati hain.
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },

    note: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ businessId: 1, paymentNo: 1 }, { unique: true });
paymentSchema.index({ businessId: 1, partyId: 1, date: -1 });
paymentSchema.index({ businessId: 1, status: 1 });
paymentSchema.index({ businessId: 1, returnNoteId: 1 });
paymentSchema.index({ businessId: 1, sourcePurchaseId: 1 });
paymentSchema.index({ businessId: 1, 'allocations.invoiceId': 1 });
paymentSchema.index({ businessId: 1, againstInvoiceIds: 1 });

export default mongoose.model('Payment', paymentSchema);

import mongoose from 'mongoose';

/**
 * HAR MAHINE KA PAISA — ITIHAAS (Part 28).
 *
 * `Subscription.lastPayment` sirf AAKHRI payment ka nishaan rakhta hai — ek
 * record, dobara likha jata hai. Wo "abhi kya haalat hai" ke liye theek hai,
 * par "pichhle 6 mahine me kab-kab paisa aaya, kab nahi" jaisa sawal iska
 * jawab nahi de sakta.
 *
 * Ye alag collection isi ke liye hai — HAR MAHINE ka apna EK record, kabhi
 * mita nahi jata. Malik ko apni Autopay page pe poora itihaas dikhta hai:
 * kaunsa mahine chukta hua, kaunsa fail hua.
 *
 * Status:
 *   paid    — paisa mil gaya, mohlat aage badh gayi
 *   failed  — koshish hui par paisa nahi aaya (card/UPI/mandate ki wajah se)
 */
const billingCycleSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },

    status: { type: String, enum: ['paid', 'failed'], required: true },
    amountPaise: { type: Number, default: 0 },
    planCode: { type: String, default: '' },

    provider: { type: String, default: 'razorpay' },
    providerSubId: { type: String, default: '' },   // Razorpay subscription id
    paymentId: { type: String, default: '' },        // sirf 'paid' ke liye
    failureReason: { type: String, default: '' },     // sirf 'failed' ke liye — Razorpay ka apna sandesh

    chargedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Autopay page pe "is dukaan ka itihaas" — naye upar
billingCycleSchema.index({ businessId: 1, chargedAt: -1 });

export default mongoose.model('BillingCycle', billingCycleSchema);

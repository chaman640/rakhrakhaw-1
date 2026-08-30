import mongoose from 'mongoose';

/**
 * Har payment ki koshish ka record — rasid bhi yahi banti hai.
 *
 * `status` ko `findOneAndUpdate` ke FILTER me rakh kar badla jata hai, isliye
 * ek hi order do baar activate nahi ho sakta. Ye zaroori hai kyunki paisa
 * chukne ki khabar DO raste se aati hai — browser se (verify) aur Razorpay ke
 * webhook se — aur dono ek saath aa sakte hain.
 */
const billingOrderSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Business',
      required: true, index: true,
    },

    planCode: { type: String, required: true },
    months: { type: Number, default: 1 },
    amountPaise: { type: Number, required: true },

    provider: { type: String, default: 'razorpay' },
    /*
      DEFAULT KHALI STRING NAHI — `undefined`.

      Neeche is khaane pe `unique + sparse` index hai. Sparse SIRF un doc ko
      chhodta hai jinme khaana HAI HI NAHI; khali string to maujood hai, yaani
      wo bhi index me jati hai. Matlab do adhoore order ek saath bane to
      dusra E11000 se gir jata — aur ek baar koi order Razorpay ki gadbad se
      '' pe atak gaya, to us ke baad HAR dukaan ka checkout hamesha ke liye
      fail hone lagta.
    */
    providerOrderId: { type: String, default: undefined },
    providerPaymentId: { type: String, default: '' },

    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },

    paidAt: { type: Date, default: null },
    failReason: { type: String, default: '' },

    // Kisne shuru kiya — jhagde me sabse pehla sawal yahi hota hai
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    receiptNo: { type: String, default: '' },
  },
  { timestamps: true },
);

billingOrderSchema.index({ businessId: 1, createdAt: -1 });
billingOrderSchema.index({ providerOrderId: 1 }, { unique: true, sparse: true });

export default mongoose.model('BillingOrder', billingOrderSchema);

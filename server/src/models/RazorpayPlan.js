import mongoose from 'mongoose';

/**
 * HAMARE PLAN KA RAZORPAY WALA JODIDAAR.
 *
 * Mandate banane ke liye Razorpay ka apna `plan_id` chahiye. Wo banana ek
 * baar ka kaam hai, par uska id yaad rakhna zaroori hai — warna har baar naya
 * plan banta rahega aur Razorpay ka dashboard sau ek jaise plan se bhar
 * jayega.
 *
 * KUNJI ME DAAM BHI HAI, sirf code nahi.
 *
 * Kal ko aap ₹100 wala plan ₹120 kar dein, to Razorpay ka purana plan wahi
 * ₹100 hi kaatta rahega — uska daam badla nahi ja sakta. Isliye kunji
 * `code + pricePaise` hai: daam badalte hi ye apne aap naya plan bana lega,
 * aur purane grahak apne purane daam pe chalte rahenge (jo theek bhi hai —
 * unhone usi daam pe haan kaha tha).
 */
const razorpayPlanSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },          // hamara plan — CHOTI, BADHTI...
    pricePaise: { type: Number, required: true },
    planId: { type: String, required: true },        // Razorpay ka plan_id
  },
  { timestamps: true },
);

razorpayPlanSchema.index({ code: 1, pricePaise: 1 }, { unique: true });

export default mongoose.model('RazorpayPlan', razorpayPlanSchema);

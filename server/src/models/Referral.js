import mongoose from 'mongoose';

/**
 * "YE DUKAAN IS SALESMAN NE LAAYI THI."
 *
 * Ek dukaan ka ek hi salesman hota hai, hamesha ke liye. Ye rishta SIGNUP KE
 * PAL bandh jata hai aur uske baad kabhi nahi badalta.
 *
 * Ye sabse zaroori niyam hai, aur wajah paisa hai: agar baad me badla ja sakta
 * to do salesman ek hi dukaan pe daawa karte, ya ek salesman purane grahak
 * apne naam kar leta jinhe wo laaya hi nahi tha. `businessId` pe unique index
 * isi ek baat ko database ke level pe pakka karta hai — code me bhool ho jaye
 * to bhi database mana kar dega.
 */
const referralSchema = new mongoose.Schema(
  {
    salesmanId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Salesman',
      required: true, index: true,
    },

    // Ek dukaan = ek hi referral. Database khud rok deta hai.
    businessId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Business',
      required: true, unique: true,
    },

    shopName: { type: String, default: '' },
    ownerPhone: { type: String, default: '' },

    /*
      Kitne mahine ka commission chadh chuka — hadd 12.

      Ye ginti Commission ki table se nahi nikali jati; yahi asli sach hai.
      Ginti alag jagah se nikalne ka matlab hota ki ek din wo do jagah se do
      alag jawab de.
    */
    monthsCredited: { type: Number, default: 0 },
    earnedPaise: { type: Number, default: 0 },

    /*
      DO BAAR PAISA NA CHADHE — iski poori zimmedari isi khaane ki hai.

      Razorpay ka webhook ek hi payment ki khabar do-teen baar bhejta hai (aur
      ye bilkul aam hai — wo tab tak bhejta hai jab tak 200 na mile). Har
      payment ka apna id yahan likh jata hai, aur agla wahi id lekar aaye to
      chadhta hi nahi.

      Ginti 12 tak hi hai, isliye ye list kabhi badi nahi hoti.
    */
    creditedSources: { type: [String], default: [] },

    firstPaidAt: { type: Date, default: null },
    lastPaidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

referralSchema.index({ salesmanId: 1, createdAt: -1 });

export default mongoose.model('Referral', referralSchema);

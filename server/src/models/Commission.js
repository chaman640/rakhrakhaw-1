import mongoose from 'mongoose';

/**
 * HAR CHADHE HUE PAISE KI EK LINE — sirf dikhane ke liye.
 *
 * Asli hisaab `Salesman.earnedPaise` aur `Referral.monthsCredited` me hai. Ye
 * table uska bahi-khata hai: kab, kis dukaan se, kitna. Isse salesman apna
 * hisaab khud mila sakta hai, aur shikayat aane pe jawab dene ko kuch hota
 * hai.
 *
 * Ye table sach nahi banati, sach LIKHTI hai. Ye ek line kisi wajah se na bhi
 * bane to bhi kisi ka paisa nahi marta — isliye ise banate waqt koi rok nahi
 * lagayi jati.
 */
const commissionSchema = new mongoose.Schema(
  {
    salesmanId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Salesman',
      required: true, index: true,
    },
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'Referral', required: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },

    shopName: { type: String, default: '' },
    months: { type: Number, default: 1 },
    amountPaise: { type: Number, required: true },

    // Razorpay ka payment/subscription id — kis payment se chadha
    sourceId: { type: String, default: '' },
  },
  { timestamps: true },
);

commissionSchema.index({ salesmanId: 1, createdAt: -1 });

export default mongoose.model('Commission', commissionSchema);

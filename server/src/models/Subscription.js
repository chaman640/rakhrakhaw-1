import mongoose from 'mongoose';
import { SUB_STATUS } from '../config/billing.js';

/**
 * EK DUKAAN, EK SUBSCRIPTION.
 *
 * Ye jaan-boojh kar `Business` ke andar nahi rakha gaya, jabki rishta 1:1 hai.
 * Do wajah, aur dono baad me dikhti hain:
 *
 *   1. Business har request pe padha jata hai — tenant nikalne ke liye. Usme
 *      billing ka saara samaan (payment id, webhook ka nishaan, purane period)
 *      ghusa dene ka matlab hai ki har request pe wo bhi padha jaye. Ek lakh
 *      user pe ye chhota sa faisla bade bill me badal jata hai.
 *
 *   2. Paise ka record kabhi delete nahi hota, dukaan ho sakti hai. Alag rakhne
 *      se dono ki apni umar hoti hai.
 *
 * `paidTill` hi asli sach hai — status usi se nikalta hai. Status ko alag se
 * sambhalna (cron chala kar "ab expire kar do") ek aur cheez hai jo toot
 * sakti hai; tareekh se nikala hua jawab kabhi purana nahi hota.
 */
const subscriptionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Business',
      required: true, unique: true, index: true,
    },

    planCode: { type: String, required: true, default: 'FREE' },

    /*
      Plan ka daam aur seat DONO yahan copy hote hain — snapshot.

      Kal daam badhe to jo aaj paisa de chuka hai uska plan mahine ke beech me
      mehnga nahi ho jana chahiye. Bill ka snapshot jis wajah se rakha jata
      hai, thik usi wajah se ye bhi.
    */
    pricePaise: { type: Number, default: 0 },
    seats: { type: Number, default: 3 },   // null = jitne chahein

    /*
      YAHI ASLI SACH HAI.

      "Is tareekh tak paisa diya hua hai." Status isse nikalta hai, alag se
      rakha nahi jata — warna ek cron ke fail hone se poori dukaan band ho
      jati (ya band hi na hoti, jo isse bhi bura hai).
    */
    paidTill: { type: Date, default: null },

    startedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    /*
      Aakhri payment ka nishaan — sirf itna jitna wapas milane ke kaam aaye.

      Card ka number, UPI id, kuch bhi aisa yahan NAHI aata. Wo Razorpay ke
      paas hai aur wahin rehna chahiye; hamare paas rakhne ka matlab sirf ye
      hai ki ek din wo hamare yahan se leak ho.
    */
    lastPayment: {
      provider: { type: String, default: '' },      // 'razorpay'
      orderId: { type: String, default: '' },
      paymentId: { type: String, default: '' },
      amountPaise: { type: Number, default: 0 },
      at: { type: Date, default: null },
    },

    // Malik ne khud band kiya to aage renew nahi hoga
    autoRenew: { type: Boolean, default: true },

    /*
      ─────────────────────── AUTOPAY (mandate) ───────────────────────

      `providerSubId` Razorpay ka subscription id hai. Yahi ek dhaaga hai jo
      hamari dukaan ko us mandate se jodta hai jisse har mahine paisa katta
      hai. Ye kho gaya to plan badalna ya band karna dono namumkin ho jayenge.
    */
    providerSubId: { type: String, default: '', index: true },
    providerPlanId: { type: String, default: '' },

    /*
      Mandate KIS plan ke liye banaya gaya — abhi tak MILA nahi hai.

      Ye `planCode` se alag hona bahut zaroori hai. `planCode` ka matlab hai
      "ye plan chal raha hai" — usse seat aur bechne ka haq milta hai. Agar
      mandate banate hi wahi likh dein, to aadmi Razorpay ka parda band karke
      bhi bina paise ke bada plan pa jata: unlimited seat, poore mahine.

      Isliye chuna hua plan yahan rakha jata hai. `planCode` sirf tab badalta
      hai jab paisa SACH ME kat jaye.
    */
    mandatePlanCode: { type: String, default: '' },

    /*
      Mandate ki apni halat — hamare plan ki halat se ALAG hai.

      Ek grahak ka plan chalu ho sakta hai (paisa diya hua hai) par uska
      mandate toota hua ho (agla paisa nahi katega). Dono ko ek hi khaane me
      milane se ye halat chhup jati hai, aur agle mahine achanak sab band ho
      jata hai — bina kisi chetavni ke.

        created   — bana hai, grahak ne abhi mandate diya nahi
        active    — chalu, har mahine paisa katega
        halted    — paisa kai baar fail hua, Razorpay ne rok diya
        cancelled — band ho gaya
    */
    mandateStatus: { type: String, default: '' },

    /*
      AAGE LAGNE WALA PLAN — chhota plan lene par.

      Chhota plan turant lagana galat hai: grahak ne poore mahine ka paisa de
      diya hai, to poore mahine ka fayda bhi milna chahiye. Isliye faisla
      yahan likha jata hai aur mahine ke aakhir me apne aap lag jata hai.

      Ye khaana khali hone ka matlab — koi badlav rukka hua nahi hai.
    */
    pendingPlanCode: { type: String, default: '' },
    pendingFrom: { type: Date, default: null },

    note: { type: String, default: '' },
  },
  { timestamps: true },
);

/*
  "Kiski mohlat khatam hone wali hai" — yaad dilane wale kaam ke liye.

  Ye ek hi index poore billing ke rozana ke sawal ka jawab de deta hai, aur
  bina iske wo query har roz poori table padhti — jo ek lakh user pe seedha
  paise ka nuksan hai.
*/
subscriptionSchema.index({ paidTill: 1 });

export default mongoose.model('Subscription', subscriptionSchema);

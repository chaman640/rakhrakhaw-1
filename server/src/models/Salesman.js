import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { PAYOUT_MODES } from '../config/partner.js';

/**
 * SALESMAN — jo grahak laata hai.
 *
 * Ye `User` se ALAG rakha gaya hai, jaan-boojh kar. `User` dukaan chalane wale
 * log hain (malik, staff, retailer) aur wo poore app ke pehre, permission aur
 * tenant ke saath bandha hua hai. Salesman un me se kuch bhi nahi hai — wo
 * dukaan ka aadmi hai hi nahi. Use `User` me thoos dene ka matlab hota har
 * pehre me ek aur "agar salesman hai to..." — aur ek din unme se koi ek
 * chhoot jata, aur salesman ko kisi dukaan ka khata dikh jata.
 *
 * OTP NAHI. Salesman ka number verify karne se hume kuch nahi milta — paisa
 * tabhi banta hai jab wo asli grahak laaye, aur wo apne aap me sabse badi
 * jaanch hai. Bina zarurat ke OTP maangne se aadha aadmi wahin chhod deta hai.
 */
const salesmanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },

    /*
      Apna link isi se banta hai — /signup?ref=XXXXXX

      Chhota aur bina uljhan wala rakha hai: WhatsApp pe bheja jata hai aur
      log use haath se bhi likhte hain. 0/O aur 1/I/l isme hain hi nahi.
    */
    refCode: { type: String, required: true, unique: true, index: true },

    /*
      PAISA KAHAN BHEJNA HAI — do me se ek zaroori.

      Ye signup pe hi maanga jata hai. Baad me maangne ka matlab hota ki
      paisa dete waqt aadmi milta hi nahi, aur wo baat sabse bure waqt pe
      pata chalti hai.
    */
    payout: {
      mode: { type: String, enum: Object.values(PAYOUT_MODES), required: true },
      upiId: { type: String, default: '', trim: true },
      accountName: { type: String, default: '', trim: true },
      accountNumber: { type: String, default: '', trim: true },
      ifsc: { type: String, default: '', trim: true, uppercase: true },
    },

    /*
      KAMAI KA JOD — yahin rakha hai, har baar gina nahi jata.

      Har baar Commission ki poori table jodna ek lakh row pe seedha paise ka
      nuksan hai. Ye do khaane hamesha `$inc` se badalte hain, isliye do
      request ek saath aayein to bhi ginti kabhi galat nahi hoti.

      `earnedPaise` kabhi ghatta nahi. `paidPaise` sirf admin ke "de diya"
      se badhta hai. Baaki hamesha inka antar hai — use alag rakhne ka matlab
      hota ek din teeno ka mel na baithna.
    */
    earnedPaise: { type: Number, default: 0 },
    paidPaise: { type: Number, default: 0 },
    joinedCount: { type: Number, default: 0 },

    // Password badalte hi purane token band — dekho PartnerAdmin.tokenSeq
    tokenSeq: { type: Number, default: 0 },

    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

salesmanSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

salesmanSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(String(plain || ''), this.passwordHash);
};

export default mongoose.model('Salesman', salesmanSchema);

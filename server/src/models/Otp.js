import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * OTP — number sach me uska hai ya nahi.
 *
 * Do jagah lagta hai: naya account banate waqt, aur password bhool jane par.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CODE SEEDHA NAHI RAKHA JATA — uska HASH rakha jata hai.
 *
 * Password ki tarah hi. Wajah wahi hai: database ka backup, ek galat query, ya
 * koi bhi log — kisi bhi raste se agar wo chhah ank bahar nikal gaye, to jiske
 * haath lage wo kisi bhi number ka password badal sakta hai. Hash rakhne se
 * bahar nikal kar bhi kisi kaam ka nahi rehta.
 *
 * Ek hi number ke ek hi kaam ka ek hi code rehta hai — naya bhejne pe purana
 * mit jata hai. Do zinda code kabhi nahi rehte.
 * ─────────────────────────────────────────────────────────────────────────
 */
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, trim: true },

    // SIGNUP — naya account; RESET — password bhool gaye
    purpose: { type: String, enum: ['SIGNUP', 'RESET'], required: true },

    codeHash: { type: String, required: true },

    /**
     * Kitni baar galat daala.
     *
     * Bina is ginti ke chhah ank sirf 10 lakh me se ek hain — aur ek script
     * unhe kuch hi minute me ek ek karke aazma sakti hai. Paanch koshish ke baad
     * code mar jata hai, aur naya bhejna padta hai.
     */
    attempts: { type: Number, default: 0 },

    /**
     * Ek ghante me kitni baar bheja.
     *
     * Har SMS ka paisa lagta hai. Bina rok ke koi bhi "dobara bhejein" dabata
     * reh sakta hai — na sirf paisa jata hai, us number wale ko bhi raat bhar
     * message aate rehte hain.
     */
    sentCount: { type: Number, default: 1 },
    windowStartedAt: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: Date.now },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Ek number, ek kaam — ek hi zinda code
otpSchema.index({ phone: 1, purpose: 1 }, { unique: true });

/*
  Waqt poora hote hi entry KHUD mit jati hai (MongoDB ka TTL index).

  Isse do faayde hain: mare hue code database me jama nahi hote, aur unka hash
  bhi wahin rehne ke bajaye hat jata hai. Safai ke liye koi alag script nahi
  chalani padti — bhoolne ki gunjaish hi nahi.
*/
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

otpSchema.methods.setCode = async function (code) {
  this.codeHash = await bcrypt.hash(String(code), 10);
};

otpSchema.methods.checkCode = function (code) {
  return bcrypt.compare(String(code), this.codeHash);
};

export default mongoose.model('Otp', otpSchema);

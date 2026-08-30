import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * ADMIN — sirf aap.
 *
 * Ek hi record rehta hai. Pehli baar `.env` se ban jata hai, uske baad
 * password panel se badla ja sakta hai — aur badalne ke baad `.env` wala
 * purana password chalta NAHI.
 *
 * Ye wahi hona chahiye: agar `.env` hamesha chalta rehta, to password badalne
 * ka koi matlab hi nahi hota — purana rasta khula rehta aur aadmi ko lagta ki
 * usne band kar diya.
 */
const partnerAdminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },

    // .env wala password abhi tak chal raha hai ya khud badal liya gaya
    passwordChanged: { type: Boolean, default: false },

    /*
      Password badalte hi ye badhta hai, aur purane sab token bekaar ho jate
      hain. Bina iske password badalna sirf NAYE login rokta tha — jo token
      pehle ban chuka, wo 2 din aur chalta rehta.
    */
    tokenSeq: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

partnerAdminSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

partnerAdminSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(String(plain || ''), this.passwordHash);
};

export default mongoose.model('PartnerAdmin', partnerAdminSchema);

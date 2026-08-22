import mongoose from 'mongoose';
import { PARTY_TYPES, PARTY_STATUS } from '../config/constants.js';

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    stateCode: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

/**
 * Party = retailer YA supplier. Dono ka structure same hai, sirf `type` alag.
 * Retailer ka balance +ve  => usne hamara paisa dena hai (udhaar)
 * Supplier ka balance +ve   => humne uska paisa dena hai
 */
const partySchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    type: { type: String, enum: Object.values(PARTY_TYPES), required: true },

    name: { type: String, required: true, trim: true },
    shopName: { type: String, trim: true, default: '' },
    /*
      Phone MARZI SE — mandi ka aadha graahak number deta hi nahi.

      Pehle ye zaroori tha, aur uska nateeja ulta nikalta tha: dukaandaar ya to
      jhootha number bhar deta (9999999999, ya apna hi number) ya bill app me
      daalta hi nahi. Pehle se party ki list me nakli number bhar jate aur
      WhatsApp wali yaad-dahani galat aadmi ko chali jati; doosre se stock aur
      khata dono se wo bikri gayab ho jati.

      Ab khali chal jata hai. Naam hi pehchaan hai — aur bill pe wahi chhapta
      hai.
    */
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    gstin: { type: String, trim: true, uppercase: true, default: '' },

    openingBalance: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },       // ledger se auto update hoga (Part 9)
    creditLimit: { type: Number, default: 0 },   // 0 = koi limit nahi (V2 feature, field ready)

    status: { type: String, enum: Object.values(PARTY_STATUS), default: PARTY_STATUS.ACTIVE },

    // ---- Retailer invite (Part 4) ----
    inviteCode: { type: String, default: null, index: true, sparse: true },
    inviteExpiresAt: { type: Date, default: null },
    inviteUsedAt: { type: Date, default: null },
    linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /**
     * Ye retailer kiske naam hai.
     *
     * Jis salesman ko "sirf apna kaam" wali hadd lagi hai, use wahi retailer
     * dikhte hain jo uske naam hain (ya jo usne khud jode). Isi ek field se
     * uske order, bill aur khata bhi tay hote hain — kyunki wo sab retailer
     * ke saath chalte hain.
     *
     * Khali chhod dein to retailer "sabka" hai — sirf hadd wale staff ko wo
     * nahi dikhega, baaki sabko dikhega.
     */
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // Kisne jodha — jab tak kisi ke naam na ho, isi se maalikana tay hota hai
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/*
  Ek business me ek phone number ek hi baar (retailer aur supplier alag alag).

  `partialFilterExpression` yahan zaroori hai. Phone ab khali ho sakta hai, aur
  bina is chhalni ke DOOSRI hi bina-number wali party "duplicate phone" kehke
  ruk jati — kyunki dono ka phone `''` hota. Ye rok un par lagni chahiye
  jinke paas number HAI.
*/
partySchema.index(
  { businessId: 1, type: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $gt: '' } } },
);
partySchema.index({ businessId: 1, name: 1 });
// "Mere retailer" har list pe nikalte hain — isliye ye do sath me
partySchema.index({ businessId: 1, assignedToUserId: 1 });
partySchema.index({ businessId: 1, createdBy: 1 });

export default mongoose.model('Party', partySchema);

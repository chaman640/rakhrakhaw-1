import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/constants.js';
import {
  STAFF_ROLES, SCOPES, DEFAULT_LIMITS, isValidPermission, userCan,
} from '../config/permissions.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: Object.values(ROLES), required: true },

    // Wholesaler ke liye: apna business.
    // Retailer ke liye: jis wholesaler se juda hai uska business (1:1 lock).
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null, index: true },

    // Sirf retailer ke liye: wholesaler ke data me uski Party entry
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },

    // ---- Staff (Part 11) ----
    // role: 'wholesaler' wale saare users dukaan ke andar ke hain.
    // Unme se ek OWNER hai (jisne signup kiya), baaki uske staff.
    staffRole: {
      type: String,
      enum: Object.values(STAFF_ROLES),
      default: STAFF_ROLES.OWNER,
    },
    /**
     * Ijazat ki poori list — `module:kaam` ki shakal me (jaise `invoices:create`).
     *
     * Role se shuruaat hoti hai, par malik har aadmi ke liye alag se ghata-badha
     * sakta hai. Isliye asli sach YAHI list hai, role nahi — role sirf naam hai.
     */
    permissions: {
      type: [{
        type: String,
        validate: {
          validator: isValidPermission,
          message: (p) => `"${p.value}" naam ki koi ijazat hai hi nahi`,
        },
      }],
      default: [],
    },

    /**
     * Kitna data dikhega.
     *
     *   all — poori dukaan ka
     *   own — sirf jo isne khud banaya, aur jo retailer iske naam pe hain
     *
     * Salesman ke liye `own` default hai: do salesman ek doosre ke retailer
     * aur unke rate na dekh payein.
     */
    scope: { type: String, enum: Object.values(SCOPES), default: SCOPES.ALL },

    /**
     * Paise ki hadd. `null` = koi hadd nahi.
     *
     * DHYAN: 0 aur null alag hain. 0 ka matlab "bilkul nahi", null ka matlab
     * "jitna marzi". Khali dabba hamesha null banta hai.
     */
    limits: {
      maxDiscountPercent: { type: Number, default: DEFAULT_LIMITS.maxDiscountPercent, min: 0, max: 100 },
      maxInvoiceAmount: { type: Number, default: DEFAULT_LIMITS.maxInvoiceAmount, min: 0 },
      canSellOnCredit: { type: Boolean, default: DEFAULT_LIMITS.canSellOnCredit },
    },

    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },

    /**
     * EK NUMBER, EK JAGAH LOGIN (item 24).
     *
     * Ek hi login teen-chaar phone pe chalta rehta tha. Dukaandaar ko lagta
     * tha wo apne hi phone se kaam kar raha hai, jabki purana salesman apne
     * phone se bill dekh raha hota tha — aur usse nikalne ka koi rasta hi
     * nahi tha. Password badalna bhi kaam nahi aata tha: purane phone ka
     * token phir bhi chalta rehta, kyunki JWT ek baar ban kar apni mohlat
     * tak zinda rehta hai.
     *
     * Ilaaj ek ginti hai. Har naya login ise badhata hai aur naye token me
     * yahi ginti likhi jati hai. Purane token me purani ginti hai — aur
     * `protect` dono milata hai. Na milne par wo token us pal se bekaar.
     *
     * Bina database me kuch dhoondhe kaam ho jata hai (user to waise bhi
     * padha jata hai), aur "sab jagah se logout" bhi isi ek ginti ko badha
     * dene se ho jata hai.
     */
    sessionSeq: { type: Number, default: 0 },
    lastDevice: { type: String, default: '' },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Owner ko hamesha sab kuch — chahe permissions array khali ho */
userSchema.methods.can = function (permission) {
  return userCan(this, permission);
};

/** Sirf apna data dikhega? */
userSchema.methods.isScoped = function () {
  return this.scope === SCOPES.OWN
    && (this.staffRole || STAFF_ROLES.OWNER) !== STAFF_ROLES.OWNER;
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.model('User', userSchema);

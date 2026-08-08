import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, STAFF_ROLES, PERMISSIONS } from '../config/constants.js';

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
    // Owner chahe to role ke default permissions badal sakta hai
    permissions: {
      type: [{ type: String, enum: Object.values(PERMISSIONS) }],
      default: [],
    },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
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
  if (this.role !== 'wholesaler') return false;
  if (this.staffRole === STAFF_ROLES.OWNER) return true;
  return (this.permissions || []).includes(permission);
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.model('User', userSchema);

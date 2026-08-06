import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/constants.js';

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

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.model('User', userSchema);

import mongoose from 'mongoose';
import { STAFF_ROLES, SCOPES, DEFAULT_LIMITS } from '../config/permissions.js';

/**
 * Staff ko LINK se jodna.
 *
 * Pehle malik hi staff ka phone aur password banata tha. Do dikkatein thin:
 *   1. Malik ko doosre ka password pata rehta tha (aur aksar wo "12345" hi
 *      rakh dete hain, kyunki kisi aur ko batana hota hai).
 *   2. Naya aadmi aane pe malik ko uske saamne baith kar form bharna padta tha.
 *
 * Ab malik ek link banata hai jisme role aur ijazat PEHLE SE tay hoti hai. Wo
 * link WhatsApp pe bhej deta hai; aane wala khud apna naam aur password banata
 * hai. Password kabhi kisi teesre ke paas jata hi nahi.
 *
 * Link ki teen hadd:
 *   - ek baar chalta hai (`usedAt` lagte hi mar jata hai)
 *   - waqt ke baad khatam (`expiresAt`)
 *   - malik jab chahe rad kar sakta hai (`cancelledAt`)
 *
 * Token ka HASH rakhte hain, token nahi — bilkul API key ki tarah. Database
 * dekh lene wala kisi ka staff account nahi bana sakta.
 */
const staffInviteSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },

    tokenHash: { type: String, required: true, unique: true, index: true },

    // Kis naam se bulaya (sirf malik ki yaad ke liye — "Ramu, naya salesman")
    label: { type: String, trim: true, default: '' },

    // Ye sab link banate waqt hi tay ho jate hain
    staffRole: { type: String, enum: Object.values(STAFF_ROLES), required: true },
    permissions: { type: [String], default: [] },
    scope: { type: String, enum: Object.values(SCOPES), default: SCOPES.ALL },
    limits: {
      maxDiscountPercent: { type: Number, default: DEFAULT_LIMITS.maxDiscountPercent },
      maxInvoiceAmount: { type: Number, default: DEFAULT_LIMITS.maxInvoiceAmount },
      canSellOnCredit: { type: Boolean, default: DEFAULT_LIMITS.canSellOnCredit },
    },

    // Malik chahe to number pehle se baandh de — phir usi number wala hi jud
    // sakta hai. Khali chhoda to jise link mila wo apna number daal sakta hai.
    phone: { type: String, trim: true, default: '' },

    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledAt: { type: Date, default: null },

    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

staffInviteSchema.index({ businessId: 1, createdAt: -1 });

/** Abhi bhi chalega? */
staffInviteSchema.methods.isUsable = function () {
  return !this.usedAt && !this.cancelledAt && this.expiresAt > new Date();
};

export default mongoose.model('StaffInvite', staffInviteSchema);

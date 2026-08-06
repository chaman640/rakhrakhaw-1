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
    phone: { type: String, required: true, trim: true },
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

    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ek business me ek phone number ek hi baar (retailer aur supplier alag alag)
partySchema.index({ businessId: 1, type: 1, phone: 1 }, { unique: true });
partySchema.index({ businessId: 1, name: 1 });

export default mongoose.model('Party', partySchema);

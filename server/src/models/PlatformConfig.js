import mongoose from 'mongoose';

/**
 * PLATFORM KI SETTING — jo Admin Panel se badalti hai, code se nahi.
 *
 * Ek hi document (`key: 'main'`). Code me har cheez ka DEFAULT pehle se hai
 * (config/billing.js ke plan, config/features.js ke feature); yahan sirf wo
 * likha jata hai jo admin ne BADLA. Khali ho to sab default pe chalta hai —
 * isliye naya server, ya ye document mit jaye, tab bhi app theek chalti hai.
 */
const planOverrideSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 60 },
    pricePaise: { type: Number, min: 0 },
    seats: { type: Number, min: 1, default: undefined },   // null = jitne chahein (unlimited flag se)
    unlimited: { type: Boolean },
    tagline: { type: String, trim: true, maxlength: 120 },
    features: { type: [String], default: undefined },       // plan card pe dikhne wali lines
    active: { type: Boolean },
  },
  { _id: false },
);

const platformConfigSchema = new mongoose.Schema(
  {
    // Ek hi document — index ki zarurat nahi (kul index ki hadd selfcheck me hai)
    key: { type: String, required: true, default: 'main' },

    // Naye seller ka free trial kitne din ka
    trialDays: { type: Number, min: 0, max: 90, default: 15 },
    // Trial kis plan pe (uske saare feature milte hain)
    trialPlanCode: { type: String, default: 'BADHTI' },

    plans: { type: [planOverrideSchema], default: [] },

    /*
      Feature -> kin plans me. `{ crm_leads: ['BADHTI','BADI','ASEEM'] }`.
      Jo key yahan nahi, uska default config/features.js se.
    */
    featurePlans: { type: Map, of: [String], default: {} },
    // Poori tarah band feature (kisi plan me nahi) — jaise kharab ho gaya ho
    featureOff: { type: [String], default: [] },

    supportPhone: { type: String, trim: true, default: '' },
    supportEmail: { type: String, trim: true, default: '' },

    updatedByAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('PlatformConfig', platformConfigSchema);

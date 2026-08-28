import mongoose from 'mongoose';
import { EXPENSE_MODES } from '../config/expenseCategories.js';

/**
 * DUKAAN KA KHARCH.
 *
 * Ab tak app sirf ye batati thi ki kitna BIKA. Par dukaandaar ka asli sawal ye
 * hota hai: "mahine ke aakhir me bacha kitna?" Uske liye chai, petrol,
 * tankhwah, kiraya — sab likhna padta hai. Ye wahi list hai.
 *
 * Kuch cheezein jaan-boojh kar NAHI hain:
 *
 *   party ka rishta — kharch kisi retailer/supplier ke khate se nahi judta.
 *     Supplier ko paisa dena "payment" hai, kharch nahi; wo pehle se alag
 *     jagah hai. Yahan sirf wo paisa aata hai jo dukaan se bahar gaya aur
 *     kisi khate me nahi chadha.
 *
 *   ledger entry — usi wajah se. Khata party ka hota hai; kharch ka koi khata
 *     nahi hota, wo seedha munafe me se katta hai.
 *
 *   stock ka asar — kharch se maal nahi aata. Maal aaye to wo "purchase" hai.
 *     Ye farak zaroori hai, warna ek hi cheez do jagah gini jayegi aur munafa
 *     do baar ghatega.
 */

const expenseSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },

    // EXP/26-27/0001 — record ke liye, taaki baat karte waqt ek pakka naam ho
    expenseNo: { type: String, required: true },

    date: { type: Date, default: Date.now },

    // Slug ki shakal me — `config/expenseCategories.js` me wajah likhi hai
    category: { type: String, required: true, trim: true, lowercase: true },

    amount: { type: Number, required: true, min: 0 },

    // Paisa kaise gaya — cash ghata to golak se, UPI/bank se to account se
    mode: { type: String, enum: EXPENSE_MODES, default: 'CASH' },

    // Kisko diya — "Ramu", "Bharat Petrol Pump". Sirf yaad ke liye, koi rishta nahi.
    paidTo: { type: String, trim: true, default: '' },

    note: { type: String, trim: true, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true },
);

// Mahine/shreni ke hisaab se jod nikalna sabse zyada hone wala kaam hai
expenseSchema.index({ businessId: 1, date: -1 });
expenseSchema.index({ businessId: 1, category: 1, date: -1 });

export default mongoose.model('Expense', expenseSchema);

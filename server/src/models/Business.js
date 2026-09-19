import mongoose from 'mongoose';
import { hasValidChecksum } from '../utils/gstin.js';

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, default: '' },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    stateCode: { type: String, trim: true, default: '' }, // GST state code, jaise "09" UP
    pincode: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: { type: addressSchema, default: () => ({}) },

    // ---- GST OPTIONAL ----
    // Har wholesaler GST registered nahi hota. Ye toggle poori app ka behaviour badalta hai:
    //   true  -> Tax Invoice, HSN + CGST/SGST/IGST breakup, GST reports
    //   false -> Bill of Supply, koi tax column nahi, sirf item rate x qty
    gstEnabled: { type: Boolean, default: false },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      validate: {
        validator(v) {
          if (!this.gstEnabled) return true;      // GST off hai to koi check nahi
          if (!v) return false;                   // GST on hai to GSTIN chahiye
          return hasValidChecksum(v);             // format + official checksum
        },
        message: 'GST on hai to sahi 15-digit GSTIN daalna zaroori hai',
      },
    },

    logoUrl: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },

    /*
     * DUKAAN KI PEHCHAN — Instagram-jaisi profile ke liye (Part 24).
     *
     * `bio` — chhota parichay, jaise "10 saal se auto parts ka thok kaam"।
     * `coverPhotoUrl` — logo ke upar wali badi photo, buyer ke shop page pe
     * sabse pehle dikhti hai।
     */
    bio: { type: String, trim: true, maxlength: 300, default: '' },
    coverPhotoUrl: { type: String, default: '' },
    coverPhotoPublicId: { type: String, default: '' },

    // ---- Retailer invite (ek hi shared link, phir approve) ----
    // Ramesh Bhai ek link WhatsApp pe bhejte hain; jo bhi join kare wo 'pending' me
    // aata hai aur approve hone tak catalog nahi dekh sakta.
    inviteCode: { type: String, index: true, sparse: true, default: null },
    inviteEnabled: { type: Boolean, default: true },
    autoApproveRetailers: { type: Boolean, default: false },

    /*
     * ONBOARDING TOUR — pehli baar wala safar (Part 29).
     *
     * `null` = abhi tak na dekha na chhoda — isi wajah se pehla login hote
     * hi tour apne aap shuru hota hai. Dono me se koi ek bhar jaye to dobara
     * apne aap kabhi nahi khulta — par "Tutorial dobara dekhein" button se
     * hamesha khul sakta hai (isliye ye field sirf "AUTO-SHOW" ko control
     * karta hai, poori tarah band nahi karta).
     */
    onboardingCompletedAt: { type: Date, default: null },
    onboardingSkippedAt: { type: Date, default: null },

    // ---- UPI (Part 9) ----
    // Retailer ko QR aur "pay" link isi se banta hai. Khali chhod do to
    // sirf cash/manual entry chalegi.
    //
    // Ye ab "DEFAULT UPI" hai — jahan bhi purana code seedha `business.upiId`
    // padhta hai (retailer ka Cart QR, jaisi jagah), wahi chalta rehta hai.
    // `upiAccounts` (neeche, Part 49) me se jo pehla hai, wahi hamesha yahan
    // copy rehta hai — do jagah alag data na ho isliye `business.service.js`
    // me sync hota hai.
    upiId: {
      type: String, trim: true, default: '',
      validate: {
        validator: (v) => !v || /^[\w.\-]{2,64}@[a-zA-Z]{2,32}$/.test(v),
        message: 'UPI ID aisi hoti hai: naam@bank',
      },
    },
    upiName: { type: String, trim: true, default: '' },

    /*
      DO YA ZYADA UPI (Part 49) — kai dukaandaar ek se zyada UPI istemal
      karte hain (khud ka alag, dukaan ka alag, kabhi partner ka bhi). Bill
      BANATE WAQT ismein se koi bhi chuna ja sakta hai — jo chuna jaye
      wahi us EK bill ke `businessSnapshot` me jaata hai (baaki bill apne
      purane UPI ke saath hi rehte hain, jaisa hamesha invoice snapshot ka
      niyam raha hai).
    */
    upiAccounts: {
      type: [{
        label: { type: String, trim: true, maxlength: 40, default: '' },
        upiId: {
          type: String, trim: true, required: true,
          validate: {
            validator: (v) => /^[\w.\-]{2,64}@[a-zA-Z]{2,32}$/.test(v),
            message: 'UPI ID aisi hoti hai: naam@bank',
          },
        },
      }],
      default: [],
    },

    /* ---- Bank ka khata (Part 15) ----
     *
     * Ye SIRF bill pe likhne ke liye hai — QR isse nahi banta.
     *
     * Wajah samajh lena zaroori hai, warna baar baar yahi sawal aayega:
     * UPI ka QR ek "pata" (VPA) maangta hai — `naam@bank`. Account number aur
     * IFSC se koi aisa QR ban hi nahi sakta jise GPay/PhonePe padh len; wo
     * NEFT/IMPS ka rasta hai, jo aadmi apne bank app me haath se bharta hai.
     *
     * Isliye do alag cheezein hain: QR ke liye UPI ID, aur "mere account me
     * daal do" ke liye ye account detail — jo bill pe likhi jayegi.
     */
    bankName: { type: String, trim: true, default: '' },
    bankAccountName: { type: String, trim: true, default: '' },
    bankAccountNumber: { type: String, trim: true, default: '' },
    bankIfsc: {
      type: String, trim: true, uppercase: true, default: '',
      validate: {
        validator: (v) => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v),
        message: 'IFSC aisa hota hai: HDFC0001234 (4 akshar, phir 0, phir 6)',
      },
    },

    // Invoice settings (Part 8 me use honge)
    invoicePrefix: { type: String, default: 'INV', trim: true },
    orderPrefix: { type: String, default: 'ORD', trim: true },
    termsAndConditions: { type: String, default: '' },
    invoiceFooterNote: { type: String, default: '' },

    // Defaults
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    currency: { type: String, default: 'INR' },

    /*
      DELIVERY CHARGE (Part 54) — bill banate waqt apne aap jud jaata hai,
      taaki har bill mein haath se na daalna pade. Bill banate waqt bhi
      badla ja sakta hai (ya hataya bhi) — ye sirf shuruaati (default) rakam
      hai, us ek bill ka aakhri faisla nahi.
    */
    deliveryCharge: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// GST off karne par GSTIN saaf kar do, taaki invoice pe purana number na chhap jaye
businessSchema.pre('save', function (next) {
  if (!this.gstEnabled) this.gstin = '';
  next();
});

export default mongoose.model('Business', businessSchema);

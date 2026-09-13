import mongoose from 'mongoose';

/**
 * TUTORIAL VIDEO — har page/kadam ka apna sabak (Part 29).
 *
 * Video khud yahan NAHI aata — sirf YouTube ka URL. Isse do fayde: (1)
 * hamare database pe koi load nahi padta, (2) video badalna ho to seedha
 * YouTube pe naya daal kar yahan URL badal do, purana link kahin bhi tootta
 * nahi.
 *
 * `key` batata hai "ye video KAHAN kaam aata hai" — jaise 'page:/items' (Items
 * page khulte hi), 'flow:become-seller' (retailer se seller banna), ya
 * 'flow:payment-checkout' (paisa dene se pehle). Isi se onboarding tour bhi
 * banta hai (`order` field se kram tay hota hai) aur kahin bhi "yahan ek
 * video dikhao" bhi isi se chalta hai.
 */
const tutorialVideoSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },       // admin panel me dikhne wala naam
    order: { type: Number, default: 0 },                        // onboarding tour ka kram

    /*
     * Do bhasha, do alag URL — video khud translate nahi hota, isliye har
     * bhasha ki apni recording chahiye. Khaali ho sakta hai (abhi tak koi
     * video nahi laga) — us waqt "Video jald aayega" dikhega.
     */
    videos: {
      hi: { type: String, default: '' },
      en: { type: String, default: '' },
    },

    // Onboarding tour me ye page/kadam shaamil ho ya sirf "jab zarurat pade tab" dikhe
    inOnboardingTour: { type: Boolean, default: false },
  },
  { timestamps: true },
);

tutorialVideoSchema.index({ inOnboardingTour: 1, order: 1 });

export default mongoose.model('TutorialVideo', tutorialVideoSchema);

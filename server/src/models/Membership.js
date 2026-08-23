import mongoose from 'mongoose';

/**
 * EK KHARIDAAR, KAI DUKAAN.
 *
 * Pehle rishta `User.businessId` me pada tha — ek hi khaana, isliye ek hi
 * dukaan. Retailer ko doosre wholesaler se maal lena ho to uske invite link se
 * NAYA account banana padta tha, naye number pe. Ek hi aadmi ke do login, do
 * khata, do cart — aur dono me se kaunsa asli hai ye kisi ko pata nahi.
 *
 * Ab wo rishta yahan aa gaya hai, aur jitni chahe utni dukaanein jud sakti hain:
 *
 *      kharidaar  ──►  businessId  (jis dukaan se maal leta hai)
 *                      partyId     (us dukaan ke andar iski apni party)
 *
 * `partyId` ka hona ZAROORI hai, aur yahi is poore design ka dil hai. Har
 * dukaan ke apne rate, apna khata, apna GST aur apna stock hai — aur wo sab
 * pehle se `(businessId, partyId)` ke jode pe chalte hain. Kharidne wale ko us
 * dukaan ke andar ek Party bana kar hi jodte hain, isliye ledger, bill, return
 * aur FIFO ka ek bhi niyam badalna nahi padta. Wo sab waise hi chalte rehte
 * hain jaise aaj chal rahe hain.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KHARIDAAR KAUN — ye do khaane kyun hain
 *
 *   userId          — retailer ka apna login. Uske peeche koi dukaan nahi hoti.
 *   buyerBusinessId — jo DUKAAN maal khareed rahi hai (wholesaler ka buy mode).
 *
 * Dono me se ek hi bharta hai. Wholesaler ki taraf rishta AADMI se nahi, DUKAAN
 * se jodna zaroori tha: godown incharge ne jo dukaan jodi wo malik ko bhi dikhe,
 * aur dono ek hi cart me daalein. Aadmi ke naam pe jodte to malik ko pata hi
 * nahi chalta ki kis dukaan se kya mangwaya gaya, aur staff badalte hi wo poora
 * rishta gayab ho jata.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `User.businessId` HATAYA NAHI gaya. Purana retailer bina kuch kiye waise hi
 * chalta rahe — startup pe uski membership apne aap ban jati hai (backfill.js),
 * aur agar wo kisi wajah se na bane to `withBuyerTenant` purane khaane se hi
 * kaam chala leta hai. Do raste rakhne ki wajah yahi hai: naya feature purane
 * login ko kabhi na tode.
 */
const membershipSchema = new mongoose.Schema(
  {
    // ---- kharidaar kaun (do me se ek) ----
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    buyerBusinessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null, index: true },

    // ---- kis dukaan se ----
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },

    // Us dukaan ke andar kharidaar ki apni Party (type: retailer)
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },

    /**
     * "Save" — Instagram ke follow jaisa.
     *
     * Save hone par agli baar search kholte hi is dukaan ka logo, naam aur
     * number saamne dikh jata hai — number dobara likhna nahi padta.
     *
     * Save hatane se rishta NAHI tootta. Tootne dena galat hota: us dukaan ka
     * khata, purane bill aur return sab isi jode pe tike hain. Save sirf ye
     * batata hai ki search wali list me dikhe ya nahi.
     */
    isSaved: { type: Boolean, default: true },

    /**
     * Wahi purana 1:1 wala rishta (jis dukaan ke invite link se account bana).
     * Sirf pehchan ke liye — kaam me kahin farak nahi padta.
     */
    isPrimary: { type: Boolean, default: false },

    // Kisne jodi — sirf record ke liye (staff ne jodi ho to malik ko dikhe)
    connectedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/*
  Ek kharidaar ek dukaan se ek hi baar juda ho sakta hai.

  Do alag index, dono `partialFilterExpression` ke saath — kyunki har row me
  do me se ek khaana KHALI hota hai. Bina chhalni ke saari retailer wali rows
  ka `buyerBusinessId` null hota aur doosri hi row "duplicate" kehke ruk jati.
  (Bilkul wahi galti jo Party ke phone pe ho chuki hai — wahan bhi yahi ilaaj
  laga hai.)
*/
membershipSchema.index(
  { userId: 1, businessId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } },
);
membershipSchema.index(
  { buyerBusinessId: 1, businessId: 1 },
  { unique: true, partialFilterExpression: { buyerBusinessId: { $type: 'objectId' } } },
);

// Search wali list — save ki hui dukaanein, jo abhi abhi khuli wo sabse upar
membershipSchema.index({ userId: 1, isSaved: 1, lastUsedAt: -1 });
membershipSchema.index({ buyerBusinessId: 1, isSaved: 1, lastUsedAt: -1 });

export default mongoose.model('Membership', membershipSchema);

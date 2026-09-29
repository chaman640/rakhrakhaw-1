import mongoose from 'mongoose';

/**
 * WISHLIST — kharidaar ki "ye chahiye" wali list (Flipkart jaisi).
 *
 * Do tarah ki line:
 *
 *   itemId wali  — dukaan ka koi maal jo abhi lena nahi, par nazar me rakhna
 *                  hai; ya jo abhi khatam hai aur wapas aane pe chahiye.
 *   text wali    — wo maal jo dukaan me HAI HI NAHI ("Redmi 13 ka cover").
 *                  Yahi dukaan ke liye sabse kaam ki cheez hai: graahak kya
 *                  maang raha hai jo uske paas nahi.
 *
 * Har line ek dukaan (`businessId`) aur us dukaan me kharidaar ki party
 * (`partyId`) se bandhi hai — cart ki tarah. Malik ko sab kharidaaron ki
 * maang ek jagah dikhti hai (wishlist.service.js — demandFor).
 */
const wishlistSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', default: null },
    text: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
);

// Kharidaar ki list aur "ye item pehle se hai?" — dono isi se
wishlistSchema.index({ businessId: 1, partyId: 1, itemId: 1 });

export default mongoose.model('Wishlist', wishlistSchema);

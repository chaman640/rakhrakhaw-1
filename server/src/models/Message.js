import mongoose from 'mongoose';

/**
 * EK MESSAGE (Part 25).
 *
 * `businessId`+`partyId` yahan bhi denormalize kiye hain — sirf `conversationId`
 * se poochhna padta to har list/count query ek extra join maangti. Query
 * bahut baar chalti hai (har baar chat kholte), isliye yahi behtar hai.
 *
 * 7 DIN ME APNE AAP MIT JATA HAI — koi cron job nahi chahiye. MongoDB ka
 * TTL index khud dekhta rehta hai aur purana document hata deta hai. Isi
 * wajah se `createdAt` PAR hi TTL lagi hai — `timestamps:true` wala `createdAt`
 * istemal kiya, alag se dusra field nahi banaya.
 */
const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },

    senderRole: { type: String, enum: ['wholesaler', 'retailer'], required: true },
    senderUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    type: { type: String, enum: ['text', 'photo', 'item', 'order'], default: 'text' },
    text: { type: String, trim: true, maxlength: 2000, default: '' },
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },

    /*
     * ITEM/ORDER SHARE (Part 26) — jab koi product ya order chat me link ki
     * tarah bheja jaata hai. `refId` us Item/Order ki asli id hai (order
     * wholesaler ke apne order page pe bhi isi id se khulta hai). `title`/
     * `subtitle` SNAPSHOT hain — item ka rate baad me badle to bhi purana
     * message wahi dikhaega jo bhejte waqt tha, WhatsApp ke forward jaisa.
     */
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
// 7 din = 7*24*60*60 second — isi ke baad document khud hat jata hai
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export default mongoose.model('Message', messageSchema);

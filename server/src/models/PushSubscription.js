import mongoose from 'mongoose';

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },

    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },

    userAgent: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    // Lagatar fail hone wale device — safai ke liye
    failures: { type: Number, default: 0 },
  },
  { timestamps: true },
);

pushSubscriptionSchema.index({ userId: 1, lastSeenAt: -1 });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);

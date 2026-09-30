import mongoose from 'mongoose';

export const ADMIN_ALERTS = ['new_seller', 'new_subscription', 'payment_failed', 'trial_ending', 'expired', 'ticket', 'urgent_ticket', 'suspicious_login', 'system_error', 'content_issue'];

/** Alerts for platform admins; `key` stops the same event being raised twice */
const adminNotificationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ADMIN_ALERTS, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, default: '', maxlength: 1000 },
    link: { type: String, default: '' },
    key: { type: String, default: null },
    readBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true },
);

adminNotificationSchema.index({ key: 1 }, { unique: true, partialFilterExpression: { key: { $type: 'string' } } });
adminNotificationSchema.index({ createdAt: -1 });

export default mongoose.model('AdminNotification', adminNotificationSchema);

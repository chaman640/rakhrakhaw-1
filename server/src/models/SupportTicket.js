import mongoose from 'mongoose';

export const TICKET_STATUS = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
export const TICKET_PRIORITY = ['low', 'normal', 'high', 'urgent'];
export const TICKET_CATEGORIES = ['account', 'billing', 'sales', 'purchase', 'stock', 'accounts_gst', 'hr', 'app_problem', 'suggestion', 'other'];

// App (RakhRakhav) ki support — dukaan ke andar ki HR arzi (HrRequest) se alag
const messageSchema = new mongoose.Schema(
  {
    by: { type: String, enum: ['user', 'admin'], required: true },
    byId: { type: mongoose.Schema.Types.ObjectId, default: null },
    byName: { type: String, default: '' },
    text: { type: String, trim: true, maxlength: 3000, default: '' },
    attachments: { type: [String], default: [] },
    internal: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNo: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
    userType: { type: String, enum: ['seller', 'buyer', 'employee'], default: 'seller' },
    category: { type: String, enum: TICKET_CATEGORIES, default: 'other' },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    priority: { type: String, enum: TICKET_PRIORITY, default: 'normal' },
    rank: { type: Number, default: 2 },
    status: { type: String, enum: TICKET_STATUS, default: 'open' },
    assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'PartnerAdmin', default: null },
    messages: { type: [messageSchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now },
    userUnread: { type: Number, default: 0 },
    adminUnread: { type: Number, default: 1 },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

supportTicketSchema.index({ userId: 1, lastActivityAt: -1 });
supportTicketSchema.index({ status: 1, rank: 1, lastActivityAt: -1 });

// Zaroori wale upar — sort ke liye number
supportTicketSchema.pre('save', function setRank(next) {
  this.rank = TICKET_PRIORITY.length - 1 - TICKET_PRIORITY.indexOf(this.priority);
  next();
});

export default mongoose.model('SupportTicket', supportTicketSchema);

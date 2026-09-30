import mongoose from 'mongoose';

/**
 * KAAM (TASK) — kisi staff ko diya gaya ek kaam.
 *
 * "Sharma Traders ko kal call karna", "Noida ke 10 retailer visit" — ek hi
 * jagah, kisi retailer (partyId) ya lead (leadId) se juda ho sakta hai. Staff
 * ko "Aaj ka kaam" me sirf APNE kaam dikhte hain; kaam poora karte hi malik ko
 * dikhta hai. Koi alag copy nahi — CRM, follow-up aur staff sab isi ek record
 * ko dekhte hain.
 */
const crmTaskSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    note: { type: String, trim: true, maxlength: 1000, default: '' },
    kind: { type: String, enum: ['call', 'visit', 'followup', 'payment', 'delivery', 'other'], default: 'followup' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    status: { type: String, enum: ['pending', 'in_progress', 'done'], default: 'pending' },
    dueAt: { type: Date, default: null },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    // Kahan se bana: haath se, ya CRM ne khud (follow-up/automation)
    source: { type: String, enum: ['manual', 'auto'], default: 'manual' },
    autoKey: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    doneAt: { type: Date, default: null },
    doneNote: { type: String, trim: true, maxlength: 1000, default: '' },
    doneByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// "Mera khula kaam, sabse jaldi wala pehle" — Aaj ka kaam isi se
crmTaskSchema.index({ businessId: 1, assignedToUserId: 1, status: 1, dueAt: 1 });

export default mongoose.model('CrmTask', crmTaskSchema);

import mongoose from 'mongoose';

/**
 * PLATFORM KI SOOCHNA — admin sabko (ya kuch logon ko) ek baat batata hai.
 *
 * "Kal raat 11 se 12 app band rahega", "Naya feature aaya" — app ke upar ek
 * patti me dikhti hai. Kisko: sab, sirf seller, sirf buyer, ya kuch plan wale.
 * Kab tak: `startsAt` se `endsAt` tak (pehle se schedule kar sakte hain).
 */
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 1000, default: '' },
    link: { type: String, trim: true, maxlength: 300, default: '' },
    tone: { type: String, enum: ['info', 'success', 'warning'], default: 'info' },
    audience: { type: String, enum: ['all', 'sellers', 'buyers'], default: 'all' },
    // Sirf in plan wale sellers ko (khali = sab)
    planCodes: { type: [String], default: [] },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdByAdminId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('Announcement', announcementSchema);

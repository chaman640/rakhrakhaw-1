import mongoose from 'mongoose';

/**
 * KISNE KYA KIYA — dukaan ka register.
 *
 * Jab dukaan me sirf malik tha, ye zaroori nahi tha. Ab jab 5-6 log ek hi
 * data pe kaam karte hain, sabse zyada poochha jane wala sawal yahi hota hai:
 * "ye bill kisne mitaya?", "is retailer ki credit limit kisne badhayi?"
 *
 * Bina record ke iska jawab kabhi nahi milta, aur shaq sab pe jata hai.
 *
 * KYA SAMBHALTE HAIN
 *   - kisne kiya (naam aur role bhi SAATH me likh dete hain, sirf id nahi)
 *   - kya kiya (`invoice.create`)
 *   - kis cheez pe (id + uska naam/number, taaki mit jane ke baad bhi samajh aaye)
 *   - kya badla (sirf badle hue field, purani aur nayi value)
 *
 * KYA NAHI SAMBHALTE
 *   - password, token — kabhi nahi
 *   - poora document — sirf jo badla wahi. Warna register itna bhaari ho jata
 *     hai ki usme se kuch dhoondhna hi mushkil ho jaye.
 */
const auditLogSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Naam yahin likh dete hain: staff hata diya jaye to bhi register padha ja
    // sake. Sirf id rakhte to purane record "kisi ne" dikhate.
    userName: { type: String, default: '' },
    userRole: { type: String, default: '' },

    // `invoice.create`, `payment.delete`, `staff.permissions`
    action: { type: String, required: true, index: true },

    entityType: { type: String, default: '' },   // Invoice / Payment / Item ...
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    // "INV/26-27/0001" ya "Bolt 10mm" — mit jane ke baad bhi pehchan rahe
    entityLabel: { type: String, default: '' },

    /**
     * Kya badla: [{ field, from, to }]
     *
     * Sirf badle hue field. Number/string/boolean hi rakhte hain — koi poora
     * nested document nahi, warna ye register hi sabse bhaari collection ban
     * jayega.
     */
    changes: [{
      _id: false,
      field: { type: String },
      label: { type: String, default: '' },
      from: { type: mongoose.Schema.Types.Mixed, default: null },
      to: { type: mongoose.Schema.Types.Mixed, default: null },
    }],

    // Ek line me kahani — list me yahi dikhta hai
    summary: { type: String, default: '' },

    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// List hamesha "naya sabse upar" chalti hai
auditLogSchema.index({ businessId: 1, createdAt: -1 });
auditLogSchema.index({ businessId: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ businessId: 1, entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);

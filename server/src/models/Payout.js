import mongoose from 'mongoose';

/**
 * "ITNA PAISA DE DIYA" — admin ke dabane par banti hai.
 *
 * Paisa app se nahi jata; aap khud UPI ya bank se bhejte hain. Ye sirf uska
 * record hai, taaki agli baar pata rahe ki kitna de chuke hain.
 *
 * Ye line KABHI DELETE NAHI HOTI. Galti se zyada mark ho jaye to ulti line
 * (minus wali) banti hai — mitane se hisaab wo cheez kho deta hai jo uski
 * sabse badi taakat hai: har badlav ka nishaan.
 */
const payoutSchema = new mongoose.Schema(
  {
    salesmanId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Salesman',
      required: true, index: true,
    },
    amountPaise: { type: Number, required: true },

    // UPI ka reference, bank ka UTR — jo bhi ho
    reference: { type: String, default: '', trim: true },
    note: { type: String, default: '', trim: true },

    // Kis khaate pe bheja — us waqt ka snapshot
    paidTo: { type: String, default: '' },
  },
  { timestamps: true },
);

payoutSchema.index({ createdAt: -1 });

export default mongoose.model('Payout', payoutSchema);

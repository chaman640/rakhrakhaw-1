import mongoose from 'mongoose';

/**
 * One row per write the app sent with an `Idempotency-Key` header. If the phone sends the same
 * write again (network dropped after the server saved it), the stored answer is replayed instead
 * of creating a second bill or payment. Rows expire after 7 days.
 */
const idempotencyKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  status: { type: String, enum: ['pending', 'done'], default: 'pending' },
  code: { type: Number },
  body: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 3600 },
});

idempotencyKeySchema.index({ userId: 1, key: 1 }, { unique: true });

export default mongoose.model('IdempotencyKey', idempotencyKeySchema);

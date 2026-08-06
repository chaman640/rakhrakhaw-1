import mongoose from 'mongoose';
import { STOCK_MOVEMENT_TYPES } from '../config/constants.js';

/**
 * Stock ka poora audit trail. Item.stockQty sirf "aaj ka number" hai,
 * ye collection batati hai wo number aaya kahan se.
 *
 * qty signed hai: +ve = stock aaya, -ve = stock gaya
 */
const stockMovementSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true, index: true },

    type: { type: String, enum: Object.values(STOCK_MOVEMENT_TYPES), required: true },
    qty: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },

    refType: { type: String, default: null },  // 'Purchase' | 'Invoice' | 'Adjustment'
    refId: { type: mongoose.Schema.Types.ObjectId, default: null },

    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

stockMovementSchema.index({ businessId: 1, itemId: 1, createdAt: -1 });

export default mongoose.model('StockMovement', stockMovementSchema);

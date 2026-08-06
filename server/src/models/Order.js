import mongoose from 'mongoose';
import { ORDER_STATUS, UNITS } from '../config/constants.js';

const orderItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true },
    unit: { type: String, enum: UNITS, default: 'PCS' },
    qty: { type: Number, required: true, min: 1 },
    rate: { type: Number, required: true, min: 0 },   // price chain se resolve hoke aayega
    amount: { type: Number, required: true, min: 0 },
    availableAtOrder: { type: Number, default: 0 },   // order ke waqt kitna stock tha
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS), required: true },
    at: { type: Date, default: Date.now },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
    placedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    orderNo: { type: String, required: true },
    orderDate: { type: Date, default: Date.now },

    items: { type: [orderItemSchema], default: [] },
    itemsTotal: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },

    status: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PLACED, index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },

    // Stock order pe LOCK nahi hota — invoice banne pe ghatega (Part 8).
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },

    retailerNote: { type: String, default: '' },
    wholesalerNote: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true }
);

orderSchema.index({ businessId: 1, orderNo: 1 }, { unique: true });
orderSchema.index({ businessId: 1, status: 1, createdAt: -1 });
orderSchema.index({ businessId: 1, partyId: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);

import mongoose from 'mongoose';
import { UNITS } from '../config/constants.js';

const itemSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },

    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    unit: { type: String, enum: UNITS, default: 'PCS' },

    // ---- Prices ----
    // Rate lagane ka order (Part 6/8 me yahi chain use hogi):
    //   1. PartyItemRate (is retailer ke liye special rate)
    //   2. wholesalePrice (sabhi retailers ke liye)
    //   3. salePrice (default / counter sale)
    purchasePrice: { type: Number, default: 0, min: 0 },
    salePrice: { type: Number, default: 0, min: 0 },
    wholesalePrice: { type: Number, default: 0, min: 0 },

    // ---- Stock ----
    stockQty: { type: Number, default: 0 },
    lowStockAt: { type: Number, default: 5, min: 0 },
    openingStock: { type: Number, default: 0 },

    // ---- GST (sirf tab dikhega jab business.gstEnabled = true) ----
    // Value hamesha store hoti hai, taaki wholesaler baad me GST on kare to data ready ho.
    hsn: { type: String, trim: true, default: '' },
    gstRate: { type: Number, default: 0, min: 0, max: 28 },
    priceIncludesGst: { type: Boolean, default: false },

    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },

    visibleToRetailers: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

itemSchema.index({ businessId: 1, name: 1 });
itemSchema.index({ businessId: 1, sku: 1 });
itemSchema.index({ businessId: 1, categoryId: 1 });

// Low stock flag — API response me seedha mil jayega
itemSchema.virtual('isLowStock').get(function () {
  return this.stockQty <= this.lowStockAt;
});

itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

export default mongoose.model('Item', itemSchema);

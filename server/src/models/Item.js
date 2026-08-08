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

    // ---- Pehchan (Part 11) ----
    // Auto-parts wale ye teen cheezein sabse pehle poochte hain
    brand: { type: String, trim: true, default: '' },        // company — Bosch, TVS...
    modelNo: { type: String, trim: true, default: '' },      // serial / part / model number
    barcode: { type: String, trim: true, default: '' },      // scanner wala code

    // ---- Warranty (Part 11) ----
    // months 0 hai to warranty hai hi nahi — retailer ko kuch nahi dikhega
    warrantyMonths: { type: Number, default: 0, min: 0, max: 240 },
    warrantyNote: { type: String, trim: true, default: '', maxlength: 200 },

    // ---- Godown (Part 11) ----
    rack: { type: String, trim: true, default: '' },         // "A-3", "upar wali almari"

    // Retailer isse kam order nahi kar sakta (0 = koi rok nahi)
    minOrderQty: { type: Number, default: 0, min: 0 },

    // ---- Prices ----
    // Rate lagane ka order (Part 6/8 me yahi chain use hogi):
    //   1. PartyItemRate (is retailer ke liye special rate)
    //   2. wholesalePrice (sabhi retailers ke liye)
    //   3. salePrice (default / counter sale)
    purchasePrice: { type: Number, default: 0, min: 0 },
    salePrice: { type: Number, default: 0, min: 0 },
    wholesalePrice: { type: Number, default: 0, min: 0 },
    // MRP sirf dikhane ke liye — bill isse nahi banta, par retailer ko
    // "kitne me bech sakta hoon" samajhne me kaam aata hai
    mrp: { type: Number, default: 0, min: 0 },

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
itemSchema.index({ businessId: 1, brand: 1 });
itemSchema.index({ businessId: 1, barcode: 1 });

// Low stock flag — API response me seedha mil jayega
itemSchema.virtual('isLowStock').get(function () {
  return this.stockQty <= this.lowStockAt;
});

// "6 mahine" / "1 saal" / "1 saal 6 mahine" — jaisa dukaandaar bolta hai
itemSchema.virtual('warrantyText').get(function () {
  const m = this.warrantyMonths || 0;
  if (!m) return '';
  const years = Math.floor(m / 12);
  const months = m % 12;
  const parts = [];
  if (years) parts.push(`${years} saal`);
  if (months) parts.push(`${months} mahine`);
  return parts.join(' ');
});

itemSchema.set('toJSON', { virtuals: true });
itemSchema.set('toObject', { virtuals: true });

export default mongoose.model('Item', itemSchema);

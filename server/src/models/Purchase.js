import mongoose from 'mongoose';
import { UNITS } from '../config/constants.js';

const purchaseItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    name: { type: String, required: true },      // snapshot — item ka naam baad me badle to bill na badle
    unit: { type: String, enum: UNITS, default: 'PCS' },
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
    /*
      Supplier KHALI ho sakta hai — nakad kharid.
      Poori wajah purchase.service.js me likhi hai. Yahan sirf itna: khali
      hone par khata banta hi nahi, par stock, khep aur lagat waise hi chadhte
      hain.
    */
    supplierId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null, index: true,
    },

    purchaseNo: { type: String, required: true },
    supplierBillNo: { type: String, default: '' },  // supplier ka apna bill number

    /**
     * YE MAAL AAYA KAHAN SE — dono taraf ka rishta (item 11).
     *
     * Jab bechne wale ne app me bill banaya aur kharidne wale ne wahi maal
     * apne stock me daala, to ye do entry ek hi lena-den ki hain. Par ab tak
     * unke beech koi taar tha hi nahi: kharidne wale ki purchase pe bas
     * supplier ka bill number likha hota tha, ek khali text ki tarah.
     *
     * Isliye do sawal ka jawab kahin nahi milta tha:
     *   kharidaar  -> "ye maal kis bill se aaya, aur us bill me kya kya tha?"
     *   bechne wala -> "usne mera bhejа maal apne stock me daal liya ya nahi?"
     *
     * Ab taar dono taraf jata hai. `sourceBusinessId` isliye bhi zaroori hai
     * ki id doosri dukaan ki hai — bina uske hum galti se apni hi dukaan me
     * wo bill dhoondhte rehte.
     */
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    sourceBusinessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', default: null },
    purchaseDate: { type: Date, default: Date.now },

    items: { type: [purchaseItemSchema], default: [] },

    subTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    // Discount ke baad, GST se pehle wali raqam. GST report ka "input credit"
    // isi ko jodta hai — isliye ise save karna zaroori hai, dobara ginna nahi.
    taxableTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },

    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

purchaseSchema.index({ businessId: 1, purchaseNo: 1 }, { unique: true });
purchaseSchema.index({ businessId: 1, sourceInvoiceId: 1 });
purchaseSchema.index({ businessId: 1, purchaseDate: -1 });
purchaseSchema.index({ businessId: 1, supplierId: 1, dueAmount: 1, purchaseDate: 1 });

export default mongoose.model('Purchase', purchaseSchema);

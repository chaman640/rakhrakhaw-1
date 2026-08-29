import { TAX_TYPES, DOCUMENT_TYPES } from '../config/constants.js';
import { round2, splitRoundOff } from '../utils/money.js';

/**
 * GST ka poora hisaab ek jagah.
 *
 * Do faisle:
 *   1. Bill ka naam  — business.gstEnabled se (Tax Invoice ya Bill of Supply)
 *   2. Kaunsa tax    — dono ka state code compare karke
 *        same state  -> CGST + SGST (aadha aadha)
 *        alag state  -> IGST (poora)
 *
 * Retailer ka state nahi bhara hai to same-state maan lete hain — sabse aam case.
 */
export function decideTaxType({ gstEnabled, businessStateCode, partyStateCode }) {
  if (!gstEnabled) {
    return { documentType: DOCUMENT_TYPES.BILL_OF_SUPPLY, taxType: TAX_TYPES.NONE };
  }
  const sameState = !partyStateCode || !businessStateCode || partyStateCode === businessStateCode;
  return {
    documentType: DOCUMENT_TYPES.TAX_INVOICE,
    taxType: sameState ? TAX_TYPES.CGST_SGST : TAX_TYPES.IGST,
  };
}

/**
 * Har line ka hisaab + kul jod.
 *
 * lines: [{ itemId, name, hsn, unit, qty, rate, discount, gstRate, warrantyMonths?, warrantyNote? }]
 * extraDiscount: bill ke neeche wala alag discount (line ke discount ke alawa)
 */
export function computeInvoice(lines, { gstEnabled, taxType, extraDiscount = 0 }) {
  let subTotal = 0, lineDiscountTotal = 0;

  // Pehle line-wise taxable value (bill-level discount ke bina)
  const base = lines.map((l) => {
    const qty = Number(l.qty || 0);
    const rate = Number(l.rate || 0);
    const discount = round2(l.discount || 0);
    const gross = round2(qty * rate);
    const taxable = round2(gross - discount);

    if (taxable < 0) {
      throw new Error(`${l.name || 'Item'}: discount rate se zyada nahi ho sakta`);
    }

    subTotal = round2(subTotal + gross);
    lineDiscountTotal = round2(lineDiscountTotal + discount);
    return { ...l, qty, rate, discount, gross, taxable };
  });

  const beforeExtra = round2(base.reduce((s, l) => s + l.taxable, 0));
  const extra = round2(Math.min(Math.max(extraDiscount, 0), beforeExtra));

  let taxableTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;

  /*
    Bill-level discount har line pe uske hisse ke barabar bantta hai — warna
    GST galat ban jayega.

    AAKHRI LINE KO BACHA HUA POORA DIYA JATA HAI. Har hissa alag round hone se
    jod `extra` se kam pad jata tha: ₹100 ka discount, 3 barabar line → 33.33
    × 3 = 99.99. `discountTotal` me poora 100 likha jata, isliye
    `subTotal − discountTotal ≠ taxableTotal` — ek paise ka fark, par GST audit
    me bill ka arithmetic match nahi karta, aur CA sabse pehle wahi dekhta hai.

    (Yahi ilaaj neeche CGST/SGST me pehle se laga hua hai — `sgst = tax − cgst`.)
  */
  let bataHua = 0;
  const items = base.map((l, i) => {
    const aakhri = i === base.length - 1;
    const share = beforeExtra <= 0
      ? 0
      : aakhri ? round2(extra - bataHua) : round2((l.taxable / beforeExtra) * extra);
    bataHua = round2(bataHua + share);
    const taxableValue = round2(l.taxable - share);

    const gstRate = gstEnabled ? Number(l.gstRate || 0) : 0;
    const tax = round2((taxableValue * gstRate) / 100);

    let cgst = 0, sgst = 0, igst = 0;
    if (taxType === TAX_TYPES.CGST_SGST) {
      cgst = round2(tax / 2);
      sgst = round2(tax - cgst);      // paisa kabhi na gire
    } else if (taxType === TAX_TYPES.IGST) {
      igst = tax;
    }

    taxableTotal = round2(taxableTotal + taxableValue);
    cgstTotal = round2(cgstTotal + cgst);
    sgstTotal = round2(sgstTotal + sgst);
    igstTotal = round2(igstTotal + igst);

    return {
      itemId: l.itemId,
      name: l.name,
      hsn: l.hsn || '',
      unit: l.unit || 'PCS',
      warrantyMonths: l.warrantyMonths || 0,
      warrantyNote: l.warrantyNote || '',
      // Lagat sirf aage bhej dete hain — ispe koi hisaab nahi hota. Ye bill
      // ke saath jam jati hai taaki munafa baad me badle nahi (Invoice model).
      costPrice: l.costPrice || 0,
      qty: l.qty,
      rate: l.rate,
      discount: round2(l.discount + share),
      taxableValue,
      gstRate,
      cgst, sgst, igst,
      total: round2(taxableValue + cgst + sgst + igst),
    };
  });

  const beforeRound = round2(taxableTotal + cgstTotal + sgstTotal + igstTotal);
  const { grandTotal, roundOff } = splitRoundOff(beforeRound);

  return {
    items,
    subTotal,
    discountTotal: round2(lineDiscountTotal + extra),
    taxableTotal,
    cgstTotal, sgstTotal, igstTotal,
    taxTotal: round2(cgstTotal + sgstTotal + igstTotal),
    roundOff,
    grandTotal,
  };
}

/**
 * HSN-wise summary — GST invoice pe ye table hona chahiye.
 */
export function hsnSummary(items, taxType) {
  const map = new Map();

  for (const it of items) {
    const key = `${it.hsn || '-'}|${it.gstRate}`;
    const row = map.get(key) || {
      hsn: it.hsn || '-', gstRate: it.gstRate,
      taxableValue: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
    };
    row.taxableValue = round2(row.taxableValue + it.taxableValue);
    row.cgst = round2(row.cgst + it.cgst);
    row.sgst = round2(row.sgst + it.sgst);
    row.igst = round2(row.igst + it.igst);
    row.total = round2(row.total + it.total);
    map.set(key, row);
  }

  return [...map.values()].sort((a, b) => a.hsn.localeCompare(b.hsn));
}

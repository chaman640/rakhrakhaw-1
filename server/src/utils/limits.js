import ApiError from './ApiError.js';
import { STAFF_ROLES } from '../config/permissions.js';

/**
 * PAISE KI HADD.
 *
 * Ijazat batati hai "bill bana sakte ho". Hadd batati hai "kitne ka".
 *
 * Dukaan me sabse aam gadbad yahi hoti hai: salesman apne dost ko 40% discount
 * de deta hai, ya ₹2 lakh ka maal udhaar pe utha deta hai. Ye ijazat ka
 * mamla nahi hai — bill banane ki ijazat to usay chahiye hi. Isliye hadd
 * alag se lagti hai.
 *
 * Teen hadd hain, aur teeno `null` ho sakti hain (matlab koi hadd nahi):
 *
 *   maxDiscountPercent  — poore bill pe zyada se zyada itna % chhoot
 *   maxInvoiceAmount    — bill isse bada nahi ban sakta
 *   canSellOnCredit     — false ho to poora paisa usi waqt lena hoga
 *
 * Malik aur sah-malik pe hadd lagti hi nahi.
 */

const noLimits = (user) => {
  if (!user) return true;
  const role = user.staffRole || STAFF_ROLES.OWNER;
  return role === STAFF_ROLES.OWNER || role === STAFF_ROLES.ADMIN;
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Bill save hone se PEHLE jaanch.
 *
 * @param {object} user    — bill banane wala
 * @param {object} totals  — { subTotal, discountTotal, grandTotal }
 * @param {number} paid    — abhi kitna mila
 */
export function assertInvoiceWithinLimits(user, totals, paid = 0) {
  if (noLimits(user)) return;

  const limits = user.limits || {};

  // ---- 1. discount ----
  //
  // % subTotal pe ginte hain (GST se pehle wali raqam) — dukaandaar bhi wahi
  // sochta hai: "sau rupaye ke maal pe das rupaye chhoot".
  if (limits.maxDiscountPercent !== null && limits.maxDiscountPercent !== undefined) {
    const base = Number(totals.subTotal || 0);
    const disc = Number(totals.discountTotal || 0);
    const pct = base > 0 ? (disc / base) * 100 : 0;

    // 10.004% ko 10% hi maanenge — paison ke round off se hadd na tootne lage
    if (pct - limits.maxDiscountPercent > 0.01) {
      throw ApiError.forbidden(
        `Aap zyada se zyada ${limits.maxDiscountPercent}% discount de sakte hain. `
        + `Is bill pe ${pct.toFixed(1)}% ban raha hai — malik se manzoori lein.`,
        { limit: 'maxDiscountPercent', allowed: limits.maxDiscountPercent, tried: Number(pct.toFixed(2)) }
      );
    }
  }

  // ---- 2. bill ki raqam ----
  if (limits.maxInvoiceAmount !== null && limits.maxInvoiceAmount !== undefined) {
    const total = Number(totals.grandTotal || 0);
    if (total > limits.maxInvoiceAmount) {
      throw ApiError.forbidden(
        `Aap ${money(limits.maxInvoiceAmount)} tak ka bill bana sakte hain. `
        + `Ye ${money(total)} ka hai — malik se manzoori lein.`,
        { limit: 'maxInvoiceAmount', allowed: limits.maxInvoiceAmount, tried: total }
      );
    }
  }

  // ---- 3. udhaar ----
  //
  // 1 rupaye ka farak chhod dete hain — round off ki wajah se "0.40 baaki hai"
  // dikha kar bill rok dena bewakoofi hogi.
  if (limits.canSellOnCredit === false) {
    const due = Number(totals.grandTotal || 0) - Number(paid || 0);
    if (due > 1) {
      throw ApiError.forbidden(
        `Aap udhaar pe bill nahi bana sakte. Poora ${money(totals.grandTotal)} lena hoga `
        + `(abhi ${money(due)} baaki reh raha hai).`,
        { limit: 'canSellOnCredit', due: Number(due.toFixed(2)) }
      );
    }
  }
}

/** Dashboard/UI ko batane ke liye — is aadmi pe kya kya hadd hai */
export function limitsSummary(user) {
  if (noLimits(user)) return { hasLimits: false, lines: [] };

  const l = user.limits || {};
  const lines = [];
  if (l.maxDiscountPercent !== null && l.maxDiscountPercent !== undefined) {
    lines.push(`Zyada se zyada ${l.maxDiscountPercent}% discount`);
  }
  if (l.maxInvoiceAmount !== null && l.maxInvoiceAmount !== undefined) {
    lines.push(`${money(l.maxInvoiceAmount)} tak ka bill`);
  }
  if (l.canSellOnCredit === false) lines.push('Udhaar pe bill nahi');

  return { hasLimits: lines.length > 0, lines };
}

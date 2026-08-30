/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SALESMAN KA HISAAB — POORE SYSTEM KE SAARE NUMBER EK JAGAH.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ye numbers do-teen file me bikhre hote to ek din ek jagah 30 hota aur doosri
 * jagah 3000 — aur wo bug seedha paise ka hota, yaani sabse mehnga.
 *
 * PAISE ME, RUPAYE ME NAHI. Poora app paise me hisaab rakhta hai (Razorpay
 * bhi), aur ek hi ikai rakhne se wo galti hoti hi nahi jisme ₹30 ka commission
 * ₹0.30 ya ₹3,000 ban jata hai.
 */

/** Har mahine ke payment pe salesman ko itna — ₹30 */
export const RATE_PAISE = 3000;

/**
 * Ek grahak pe zyada se zyada itne mahine ka commission.
 *
 * Yaani ek grahak se salesman ko poori umar me ₹360 (12 × 30) se zyada nahi
 * milega. Ye hadd isliye hai ki ek hi grahak saalon tak kharcha na banta
 * rahe — salesman ka kaam naya grahak laana hai, purane pe baithna nahi.
 *
 * 3 mahine ka paisa ek saath aaya to 3 MAHINE gine jate hain, ek nahi. Warna
 * saal bhar ka paisa dene wale grahak pe hadd ka koi matlab hi na rehta.
 */
export const MAX_MONTHS = 12;

/** Paisa kaise lena hai — signup pe do me se ek zaroori hai */
export const PAYOUT_MODES = { UPI: 'upi', BANK: 'bank' };

/** Salesman ka apna link isi se banta hai */
export const REF_PARAM = 'ref';

export const partnerRupees = (paise) => Math.round(Number(paise || 0)) / 100;

/**
 * Kitna mila, kitna baaki — ek hi jagah.
 *
 * `earnedPaise` kabhi ghatta nahi (wo kamai ka record hai) aur `paidPaise`
 * kabhi badhta nahi bina admin ke. Baaki hamesha inka antar hai — alag se
 * "baaki" ka khaana rakhna wo galti hai jo ek din dono se mel nahi khati.
 */
export function baakiPaise({ earnedPaise = 0, paidPaise = 0 }) {
  return Math.max(0, Number(earnedPaise || 0) - Number(paidPaise || 0));
}

// Paisa hamesha 2 decimal pe round — float errors se bachne ke liye.
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Invoice ka round-off: 1234.60 -> grandTotal 1235, roundOff +0.40
export function splitRoundOff(amount) {
  const rounded = Math.round(amount);
  return { grandTotal: rounded, roundOff: round2(rounded - amount) };
}

export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const toRupees = (paise) => round2(Number(paise) / 100);

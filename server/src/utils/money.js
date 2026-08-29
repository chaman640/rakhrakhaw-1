// Paisa hamesha 2 decimal pe round — float errors se bachne ke liye.
/*
  Paisa hamesha 2 decimal pe.

  EPSILON ka ishara number ke APNE sign ki taraf hona chahiye. Seedha
  `n + EPSILON` karne se rounding hamesha upar ki taraf jhukti thi:

      round2( 1.005)  ->  1.01   ✓
      round2(-1.005)  -> -1.00   ✗  (-1.01 hona chahiye)

  Minus wale number har paise wale raste me hain — `roundOff`, jama paisa
  (ulta balance), aur har reversal ka `-amount`. Ek-ek paisa, par lakhon
  entry pe wo drift banta hai aur ek din khata milta hi nahi.
*/
export const round2 = (n) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? -1 : 1;
  const out = (sign * Math.round((Math.abs(v) + Number.EPSILON) * 100)) / 100;
  // `-0` ko 0 bana do — warna bill pe "−₹0.00" chhap jata hai
  return out === 0 ? 0 : out;
};

// Invoice ka round-off: 1234.60 -> grandTotal 1235, roundOff +0.40
export function splitRoundOff(amount) {
  const rounded = Math.round(amount);
  return { grandTotal: rounded, roundOff: round2(rounded - amount) };
}

export const toPaise = (rupees) => Math.round(Number(rupees) * 100);
export const toRupees = (paise) => round2(Number(paise) / 100);

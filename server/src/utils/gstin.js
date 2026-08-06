// GSTIN: 22 AAAAA0000A 1 Z 5
//        ^state ^PAN    ^entity ^Z ^checksum
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Official checksum algorithm — typo turant pakad leta hai
export function hasValidChecksum(gstin) {
  if (!GSTIN_RE.test(gstin)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARS.indexOf(gstin[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkValue = (36 - (sum % 36)) % 36;
  return CHARS[checkValue] === gstin[14];
}

export function validateGstin(gstin, expectedStateCode = '') {
  const value = String(gstin || '').toUpperCase().trim();

  if (!value) return { valid: false, message: 'GSTIN daalna zaroori hai' };
  if (value.length !== 15) return { valid: false, message: 'GSTIN 15 character ka hota hai' };
  if (!GSTIN_RE.test(value)) return { valid: false, message: 'GSTIN ka format galat hai' };
  if (!hasValidChecksum(value)) return { valid: false, message: 'GSTIN ka last digit match nahi kar raha — dobara check karein' };

  if (expectedStateCode && value.slice(0, 2) !== expectedStateCode) {
    return {
      valid: false,
      message: `GSTIN ${value.slice(0, 2)} state ka hai, par aapne dusra state chuna hai`,
    };
  }

  return { valid: true, value };
}

export const isValidGstin = (g) => validateGstin(g).valid;

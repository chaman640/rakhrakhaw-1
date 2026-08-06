import ApiError from './ApiError.js';

/**
 * Phone hamesha 10 digit me store hota hai.
 * "+91 98765-43210", "09876543210", "919876543210" -> "9876543210"
 */
export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  const ten = digits.length > 10 ? digits.slice(-10) : digits;
  if (ten.length !== 10) throw ApiError.badRequest('Phone number 10 digit ka hona chahiye');
  if (!/^[6-9]/.test(ten)) throw ApiError.badRequest('Indian mobile number 6-9 se shuru hota hai');
  return ten;
}

export const isValidPhone = (input) => {
  try { normalizePhone(input); return true; } catch { return false; }
};

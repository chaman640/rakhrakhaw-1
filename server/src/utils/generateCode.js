import crypto from 'crypto';

// Retailer invite code — URL me jayega, isliye short aur confusing chars hata diye (0/O, 1/I/L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateInviteCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function padNumber(num, width = 4) {
  return String(num).padStart(width, '0');
}

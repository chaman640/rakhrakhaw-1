// Indian formatting helpers — poori app me yahi use karna.

export function formatMoney(amount, { withSymbol = true } = {}) {
  const n = Number(amount || 0);
  // Minus chinh ₹ ke BAAD nahi, PEHLE aana chahiye: -₹500.00 (₹-500.00 nahi)
  const sign = n < 0 ? '-' : '';
  const formatted = Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `${sign}₹${formatted}` : `${sign}${formatted}`;
}

export function formatQty(qty, unit = '') {
  const n = Number(qty || 0);
  const clean = Number.isInteger(n) ? n : n.toFixed(2);
  return unit ? `${clean} ${unit}` : String(clean);
}

export function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatPhone(phone) {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
}

/**
 * Expiry ka haal — ek hi jagah, taaki har screen ek hi baat kahe.
 *
 * Card, table aur item form — teeno ko yahi chahiye tha, aur teeno me alag
 * alag likhne par wo dheere dheere alag ho jate: kahin "30 din" ki hadd,
 * kahin 15 ki; kahin aaj wala din "beet gaya" me ginta, kahin "bacha hai" me.
 *
 * `null` ka matlab hai expiry likhi hi nahi — aur wo "theek hai" nahi hai,
 * wo "poochha hi nahi gaya" hai. Isliye bulane wala khud tay karta hai ki
 * kuch dikhana bhi hai ya nahi.
 */
export function expiryInfo(date) {
  if (!date) return null;
  const din = Math.ceil(
    (new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000
  );
  /*
    `label` seedha na banakar `key` + `n` lautate hain.

    Anuvaad shabd ke hisaab se hota hai, aur "12 din me expire" jaisa juda hua
    vaakya kisi dictionary me mil hi nahi sakta — wo hamesha angrezi/Hinglish
    me hi atka reh jata. `{n}` wala saancha `t()` khud bharta hai, isliye teeno
    zubaan me poora vaakya theek aata hai.
  */
  if (din < 0) return { din, tone: 'red', key: '{n} din pehle expire', n: Math.abs(din) };
  if (din === 0) return { din, tone: 'red', key: 'Aaj expire', n: 0 };
  if (din <= 30) return { din, tone: 'amber', key: '{n} din me expire', n: din };
  return { din, tone: 'slate', key: 'Expiry {n}', n: formatDate(date) };
}

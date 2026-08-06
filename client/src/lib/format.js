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

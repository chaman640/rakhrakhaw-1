/**
 * Chhota CSV parser/serializer — koi extra package nahi.
 * Quotes, escaped quotes ("") aur field ke andar newline sab handle karta hai.
 */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const clean = String(text).replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }

  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

/** Header row ko keys maan kar objects banata hai */
export function parseCsvToObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((h) => String(h).trim());
  const records = rows.slice(1).map((r, index) => {
    const obj = { __line: index + 2 }; // header ke baad line number
    headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });

  return { headers, records };
}

function escapeCell(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(headers.map((h) => escapeCell(row[h])).join(','));
  return lines.join('\n');
}

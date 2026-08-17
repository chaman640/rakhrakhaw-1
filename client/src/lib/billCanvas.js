import { formatMoney, formatQty, formatDate, formatPhone } from './format';
import { jpegToPdf, A4 } from './pdf';

/**
 * BILL KO EK TASVEER BANANA — WhatsApp pe bhejne ke liye.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PEHLE YE PADH LEIN: yahan bill ka layout DOBARA likha gaya hai. Wo jaan
 * boojh kar hai, aalas se nahi. Teen raste the, teeno tole gaye:
 *
 *   1. Screen wale HTML ka photo (html2canvas)
 *      — Tailwind v4 ke rang `oklch()` me hote hain, aur html2canvas unhe
 *        padh hi nahi pata: bill kaala-kaala nikalta hai. Kaam hi nahi karta.
 *
 *   2. PDF me seedha likhna (jsPDF ka apna text)
 *      — Uske andar wale font me na `₹` hota hai na Devanagari. Yaani Hindi
 *        wale dukaandaar ka bill dabbon me chhapta. Aur `₹` ke bina bill
 *        Indian lagta hi nahi.
 *
 *   3. Khud canvas pe banana (yahi chuna)
 *      — Canvas browser ka apna font istemal karta hai, isliye `₹`, हिन्दी,
 *        ગુજરાતી — sab theek chhapta hai. Layout apne haath me hai, koi CSS
 *        beech me nahi. Kharch itna hi ki naap yahan alag likhne padte hain.
 *
 * Isliye niyam: bill ka roop badle to DO jagah badalna hai — InvoicePrint.jsx
 * (screen aur printer ke liye) aur ye file (WhatsApp ke liye). Ye baat test
 * me bhi bandhi hui hai, taaki chup-chaap ek jagah na badle.
 * ─────────────────────────────────────────────────────────────────────────
 */

/* A4 ko 96dpi pe naapa — wahi jo browser ka apna naap hai */
const W = 794;                 // 210mm
const H = 1123;                // 297mm
const M = 44;                  // hashiya

const INK = '#0f172a';
const MUTED = '#475569';
const LINE = '#cbd5e1';
const DARK = '#1e293b';

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
const f = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

/** Ek chhota sa naapne-likhne wala auzaar — har jagah yahi use hota hai */
function pen(ctx) {
  return {
    text(str, x, y, { size = 11, weight = 400, color = INK, align = 'left', max = 0 } = {}) {
      ctx.font = f(size, weight);
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      let s = String(str ?? '');
      if (max) s = clip(ctx, s, max);
      ctx.fillText(s, x, y);
      return ctx.measureText(s).width;
    },
    line(x1, y1, x2, y2, { color = LINE, width = 1 } = {}) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1 + 0.5);
      ctx.lineTo(x2, y2 + 0.5);
      ctx.stroke();
    },
    box(x, y, w, h, { fill = null, stroke = null, radius = 0 } = {}) {
      ctx.beginPath();
      if (radius) roundRect(ctx, x, y, w, h, radius);
      else ctx.rect(x, y, w, h);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Lamba naam column se bahar na nikle — "Bearing 6203 SK…" */
function clip(ctx, str, max) {
  if (ctx.measureText(str).width <= max) return str;
  let s = str;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

/** Address jaisi lambi line ko todkar kai line me */
function wrap(ctx, str, max, size, weight = 400) {
  ctx.font = f(size, weight);
  const words = String(str || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) { lines.push(cur); cur = w; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

const addressOf = (a = {}) => [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');

/**
 * Poora bill ek canvas pe.
 *
 * `qrDataUrl` pehle se bana kar dena hota hai — QR banana async hai aur
 * drawing ke beech me await karna layout ko uljha deta hai.
 */
export function drawBill(canvas, invoice, { qrImage = null, logoImage = null } = {}) {
  const ctx = canvas.getContext('2d');
  const p = pen(ctx);

  const b = invoice.businessSnapshot || {};
  const party = invoice.partySnapshot || {};
  const gst = invoice.gstEnabled;
  const isIgst = invoice.taxType === 'IGST';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  let y = M;

  /* ───────────── cancel ka theppa ───────────── */
  if (invoice.isCancelled) {
    p.box(M, y, W - 2 * M, 34, { stroke: '#dc2626' });
    p.text('CANCELLED', W / 2, y + 23, { size: 16, weight: 700, color: '#dc2626', align: 'center' });
    y += 46;
  }

  /* ───────────── sar: dukaan | bill ka naam ───────────── */
  const headTop = y;
  let leftX = M;

  if (logoImage) {
    ctx.drawImage(logoImage, M, y, 52, 52);
    leftX = M + 64;
  }

  p.text(b.name || '', leftX, y + 18, { size: 17, weight: 700, max: 380 });
  let ly = y + 36;
  for (const line of wrap(ctx, addressOf(b.address), 380, 10)) {
    p.text(line, leftX, ly, { size: 10, color: MUTED });
    ly += 13;
  }
  const contact = [b.phone && `Phone: ${formatPhone(b.phone)}`, gst && b.gstin && `GSTIN: ${b.gstin}`]
    .filter(Boolean).join('   ');
  if (contact) { p.text(contact, leftX, ly, { size: 10, color: MUTED }); ly += 13; }

  const docName = invoice.documentType === 'TAX_INVOICE' ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  p.text(docName, W - M, headTop + 16, { size: 13, weight: 700, align: 'right' });
  p.text(invoice.invoiceNo || '', W - M, headTop + 36, { size: 12, weight: 600, align: 'right' });
  p.text(formatDate(invoice.invoiceDate), W - M, headTop + 53, { size: 10, color: MUTED, align: 'right' });

  y = Math.max(ly, headTop + 64) + 6;
  p.line(M, y, W - M, y, { color: DARK, width: 2 });
  y += 20;

  /* ───────────── kiska bill ───────────── */
  p.text('BILL TO', M, y, { size: 9, weight: 700, color: MUTED });
  p.text(party.shopName || party.name || '', M, y + 18, { size: 13, weight: 700, max: 330 });
  let py = y + 34;
  if (party.shopName && party.name) {
    p.text(party.name, M, py, { size: 10, color: MUTED }); py += 13;
  }
  for (const line of wrap(ctx, addressOf(party.address), 330, 10)) {
    p.text(line, M, py, { size: 10, color: MUTED }); py += 13;
  }
  if (party.phone) { p.text(`Phone: ${formatPhone(party.phone)}`, M, py, { size: 10, color: MUTED }); py += 13; }
  if (gst && party.gstin) { p.text(`GSTIN: ${party.gstin}`, M, py, { size: 10, color: MUTED }); py += 13; }

  if (gst) {
    p.text(`Place of supply: ${invoice.placeOfSupplyStateCode || '—'}`, W - M, y + 2, { size: 10, color: MUTED, align: 'right' });
    p.text(`Tax: ${isIgst ? 'IGST' : 'CGST + SGST'}`, W - M, y + 17, { size: 10, color: MUTED, align: 'right' });
  }

  y = Math.max(py, y + 50) + 8;
  p.line(M, y, W - M, y);
  y += 22;

  /* ───────────── maal ki table ─────────────
     Column ki chaudai GST ke saath aur bina GST ke alag hai — bina GST wale
     bill me naam ko poori jagah mil jati hai. */
  const cols = gst
    ? [
      { key: 'sn', w: 26, align: 'left' },
      { key: 'name', w: 208, align: 'left' },
      { key: 'hsn', w: 58, align: 'left' },
      { key: 'qty', w: 62, align: 'right' },
      { key: 'rate', w: 68, align: 'right' },
      { key: 'taxable', w: 76, align: 'right' },
      { key: 'tax', w: 88, align: 'right' },
      { key: 'amount', w: 120, align: 'right' },
    ]
    : [
      { key: 'sn', w: 30, align: 'left' },
      { key: 'name', w: 336, align: 'left' },
      { key: 'qty', w: 90, align: 'right' },
      { key: 'rate', w: 110, align: 'right' },
      { key: 'amount', w: 140, align: 'right' },
    ];

  const HEAD = {
    sn: '#', name: 'Item', hsn: 'HSN', qty: 'Qty', rate: 'Rate',
    taxable: 'Taxable', tax: isIgst ? 'IGST' : 'CGST+SGST', amount: 'Amount',
  };

  const xOf = [];
  let cx = M;
  for (const c of cols) { xOf.push(cx); cx += c.w; }
  const colX = (i, c) => (c.align === 'right' ? xOf[i] + c.w - 4 : xOf[i]);

  cols.forEach((c, i) => {
    p.text(HEAD[c.key], colX(i, c), y, { size: 9, weight: 700, color: MUTED, align: c.align });
  });
  y += 8;
  p.line(M, y, W - M, y, { color: DARK, width: 2 });
  y += 6;

  const items = invoice.items || [];
  for (const it of items) {
    const rowTop = y;
    const nameCol = cols.find((c) => c.key === 'name');
    const nameLines = wrap(ctx, it.name || '', nameCol.w - 6, 10.5, 600).slice(0, 2);

    cols.forEach((c, i) => {
      const x = colX(i, c);
      const common = { size: 10.5, align: c.align };
      if (c.key === 'sn') p.text(items.indexOf(it) + 1, x, y + 14, { ...common, color: MUTED });
      else if (c.key === 'name') {
        let ny = y + 14;
        for (const l of nameLines) { p.text(l, x, ny, { size: 10.5, weight: 600 }); ny += 13; }
      } else if (c.key === 'hsn') p.text(it.hsn || '—', x, y + 14, { ...common, color: MUTED });
      else if (c.key === 'qty') p.text(formatQty(it.qty, it.unit), x, y + 14, common);
      else if (c.key === 'rate') p.text(formatMoney(it.rate), x, y + 14, common);
      else if (c.key === 'taxable') p.text(formatMoney(it.taxableValue), x, y + 14, common);
      else if (c.key === 'tax') {
        const amt = isIgst ? it.igst : (it.cgst || 0) + (it.sgst || 0);
        p.text(formatMoney(amt), x, y + 14, common);
        p.text(`${it.gstRate || 0}%`, x, y + 25, { size: 8.5, color: MUTED, align: c.align });
      } else if (c.key === 'amount') p.text(formatMoney(it.total), x, y + 14, { ...common, weight: 600 });
    });

    let extraY = y + 14 + nameLines.length * 13 - 13;
    if (it.warrantyMonths > 0) {
      extraY += 12;
      p.text(`Warranty: ${warrantyText(it.warrantyMonths)}`, xOf[1], extraY, { size: 8.5, color: MUTED });
    }
    if (it.discount > 0) {
      extraY += 12;
      p.text(`Discount ${formatMoney(it.discount)}`, xOf[1], extraY, { size: 8.5, color: MUTED });
    }

    y = Math.max(extraY, rowTop + (gst ? 32 : 26)) + 8;
    p.line(M, y - 4, W - M, y - 4, { color: '#e2e8f0' });

    // Kagaz bhar gaya — baaki item "aur X item" me sameta jayega
    if (y > H - 330 && items.indexOf(it) < items.length - 1) {
      const left = items.length - items.indexOf(it) - 1;
      p.text(`+ ${left} aur item — poori list bill kholkar dekhein`, M, y + 12,
        { size: 10, color: MUTED });
      y += 24;
      break;
    }
  }

  /* ───────────── hisaab ───────────── */
  y += 10;
  const tW = 260;
  const tX = W - M - tW;
  let ty = y;

  const row = (label, value, { bold = false, big = false, top = false } = {}) => {
    if (top) { p.line(tX, ty, W - M, ty, { color: DARK, width: 2 }); ty += 6; }
    p.text(label, tX, ty + 14, { size: big ? 12.5 : 11, weight: bold ? 700 : 400, color: bold ? INK : MUTED });
    p.text(value, W - M, ty + 14, { size: big ? 13 : 11, weight: bold ? 700 : 400, align: 'right' });
    ty += big ? 24 : 20;
  };

  row('Kul maal', formatMoney(invoice.subTotal));
  if (invoice.discountTotal > 0) row('Discount', `− ${formatMoney(invoice.discountTotal)}`);
  if (gst) row('Taxable value', formatMoney(invoice.taxableTotal));
  if (gst && !isIgst && invoice.cgstTotal > 0) {
    row('CGST', formatMoney(invoice.cgstTotal));
    row('SGST', formatMoney(invoice.sgstTotal));
  }
  if (gst && isIgst && invoice.igstTotal > 0) row('IGST', formatMoney(invoice.igstTotal));
  if (invoice.roundOff) row('Round off', formatMoney(invoice.roundOff));
  row('Kul', formatMoney(invoice.grandTotal), { bold: true, big: true, top: true });
  if (invoice.paidAmount > 0) row('Diya', formatMoney(invoice.paidAmount));
  p.line(tX, ty, W - M, ty);
  ty += 4;
  row('Baaki', formatMoney(invoice.dueAmount), { bold: true });

  /* ───────────── shabdon me rakam ───────────── */
  let wy = y + 14;
  p.text('Amount in words', M, wy, { size: 9, weight: 700, color: MUTED });
  wy += 15;
  for (const line of wrap(ctx, invoice.amountInWords || '', tX - M - 20, 10)) {
    p.text(line, M, wy, { size: 10, color: INK }); wy += 14;
  }

  y = Math.max(ty, wy) + 18;

  /* ───────────── paisa kahan bhejein ─────────────
     QR sirf UPI ID se banta hai. Account+IFSC ka QR banta hi nahi (wo NEFT ka
     rasta hai), isliye wo bas likha jata hai — Business model me poori wajah. */
  const hasUpi = Boolean(b.upiId) && invoice.dueAmount > 0 && !invoice.isCancelled;
  const hasBank = Boolean(b.bankAccountNumber && b.bankIfsc);

  if (hasUpi || hasBank) {
    const boxH = 108;
    p.box(M, y, W - 2 * M, boxH, { fill: '#f8fafc', stroke: '#e2e8f0', radius: 8 });
    let bx = M + 14;

    if (hasUpi && qrImage) {
      ctx.drawImage(qrImage, bx, y + 14, 80, 80);
      p.text('Scan karke paisa bhejein', bx + 40, y + boxH - 6, { size: 8, color: MUTED, align: 'center' });
      bx += 100;
    }

    p.text('PAISA KAHAN BHEJEIN', bx, y + 22, { size: 9, weight: 700, color: MUTED });
    let byy = y + 40;
    if (b.upiId) {
      p.text(`UPI: ${b.upiId}`, bx, byy, { size: 11, weight: 600 });
      byy += 16;
    }
    if (hasBank) {
      const bank = [b.bankName, b.bankAccountName].filter(Boolean).join(' · ');
      if (bank) { p.text(bank, bx, byy, { size: 10, color: MUTED }); byy += 14; }
      p.text(`A/c ${b.bankAccountNumber}   IFSC ${b.bankIfsc}`, bx, byy, { size: 10.5, weight: 600 });
      byy += 14;
    }
    y += boxH + 16;
  }

  /* ───────────── neeche: shart aur dastkhat ───────────── */
  const footTop = Math.max(y, H - 130);
  p.line(M, footTop, W - M, footTop);

  let fy = footTop + 18;
  if (invoice.notes) {
    for (const line of wrap(ctx, invoice.notes, 420, 9)) {
      p.text(line, M, fy, { size: 9, color: MUTED }); fy += 12;
    }
    fy += 4;
  }
  if (invoice.termsAndConditions) {
    p.text('Terms & Conditions', M, fy, { size: 9, weight: 700, color: MUTED });
    fy += 13;
    for (const line of wrap(ctx, invoice.termsAndConditions, 420, 9).slice(0, 4)) {
      p.text(line, M, fy, { size: 9, color: MUTED }); fy += 12;
    }
  }

  p.line(W - M - 180, H - M - 22, W - M, H - M - 22);
  p.text(`${b.name || ''} ke liye`, W - M, H - M - 6, { size: 9.5, color: MUTED, align: 'right', max: 180 });

  return canvas;
}

function warrantyText(months) {
  const m = Number(months || 0);
  if (!m) return '';
  const y = Math.floor(m / 12);
  const rest = m % 12;
  return [y && `${y} saal`, rest && `${rest} mahine`].filter(Boolean).join(' ');
}

/* ═══════════════════════════ bahar wale darwaze ═══════════════════════════ */

const loadImage = (src) => new Promise((resolve) => {
  if (!src) { resolve(null); return; }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);          // logo na aaye to bill fir bhi bane
  img.src = src;
});

/** Bill ka UPI link — bilkul wahi shakal jo khata wale QR me hai */
export function billUpiLink(invoice) {
  const b = invoice.businessSnapshot || {};
  if (!b.upiId || !(invoice.dueAmount > 0)) return '';
  const params = new URLSearchParams({
    pa: b.upiId,
    pn: b.upiName || b.name || 'Wholesaler',
    cu: 'INR',
    am: Number(invoice.dueAmount).toFixed(2),
    tn: `Bill ${invoice.invoiceNo}`,
  });
  return `upi://pay?${params.toString()}`;
}

async function makeQrImage(invoice) {
  const link = billUpiLink(invoice);
  if (!link) return null;
  try {
    const { default: QRCode } = await import('qrcode');
    const url = await QRCode.toDataURL(link, { width: 240, margin: 0 });
    return await loadImage(url);
  } catch {
    return null;                              // QR na bane to bill fir bhi jaye
  }
}

/**
 * Bill ka canvas — `scale` se saaf-safai tay hoti hai.
 *
 * 2 matlab 192dpi: WhatsApp pe zoom karke bhi ginti saaf padhi jati hai, aur
 * file itni bhi bhaari nahi hoti ki gaon ke net pe atak jaye.
 */
export async function renderBillCanvas(invoice, { scale = 2 } = {}) {
  const [qrImage, logoImage] = await Promise.all([
    makeQrImage(invoice),
    loadImage(invoice.businessSnapshot?.logoUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  drawBill(canvas, invoice, { qrImage, logoImage });
  return canvas;
}

const canvasBlob = (canvas, type, quality) => new Promise((resolve) => {
  canvas.toBlob((blob) => resolve(blob), type, quality);
});

/**
 * WhatsApp pe bhejne layak PDF.
 *
 * JPEG isliye ki bill me tasveer nahi, likhaayi hai — 0.92 pe wo ekdum saaf
 * rehti hai aur file PNG se aadhi se bhi kam ho jati hai. Aur PDF ka dhancha
 * `lib/pdf.js` khud banata hai (kyun, wo wahin likha hai).
 */
export async function billPdfBlob(invoice) {
  const canvas = await renderBillCanvas(invoice, { scale: 2 });
  const jpegBlob = await canvasBlob(canvas, 'image/jpeg', 0.92);
  const bytes = new Uint8Array(await jpegBlob.arrayBuffer());
  return jpegToPdf(bytes, canvas.width, canvas.height, A4);
}

/** Wahi bill, tasveer ke roop me (chat me seedha dikh jata hai) */
export async function billPngBlob(invoice) {
  const canvas = await renderBillCanvas(invoice, { scale: 2 });
  return canvasBlob(canvas, 'image/png');
}

export const billFileName = (invoice, ext) =>
  `${String(invoice.invoiceNo || 'bill').replace(/[^\w-]+/g, '-')}.${ext}`;

/**
 * FILE BHEJNA — do tap me, teen me nahi.
 *
 * Jo chahiye tha: "WhatsApp" dabao, bill retailer ke paas chala jaye.
 *
 * Jo ho nahi sakta: `wa.me` wale link me sirf likhaayi jati hai, file nahi.
 * Koi bhi website kisi ke WhatsApp me file nahi chipka sakti — ye browser ki
 * rok hai, aur theek hi hai (warna koi bhi page aapke naam se kuch bhi bhej
 * deta).
 *
 * Jo ho sakta hai, aur yahi kiya gaya hai:
 *
 *   Phone pe  — `navigator.share` phone ka apna "Share" parda kholta hai.
 *               Do tap: WhatsApp chuno, aadmi chuno. Bill file ke roop me
 *               chala jata hai, poora ka poora.
 *
 *   Computer pe — wahan ye parda hota hi nahi. Isliye file download ho jati
 *               hai aur WhatsApp Web likhaayi ke saath khul jata hai; file
 *               ko clip wale button se lagana padta hai. Jhooth nahi bolte —
 *               screen pe saaf likh dete hain ki file download ho gayi hai.
 */

/** Ye phone/browser file bhej sakta hai ya nahi */
export function canShareFiles() {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
  try {
    // Ek jhoothi chhoti file se poochte hain — asli file banane se pehle,
    // taaki bina matlab bhaari kaam na ho
    return navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] });
  } catch {
    return false;
  }
}

export const waLink = (text, phone) => {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  const to = digits.length === 10 ? `91${digits}` : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
};

/** Browser me file save karna */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Turant hatane se kabhi kabhi download shuru hone se pehle hi link mar
  // jata hai — isliye thoda ruk kar
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * File bhejo — jo tarika is device pe chalta ho, wahi.
 *
 * Jawab batata hai KYA hua, taaki upar wala page sahi baat dikha sake:
 *   'shared'     — share ka parda khula aur bhej diya gaya
 *   'cancelled'  — parda khula par aadmi ne band kar diya (koi galti nahi hai)
 *   'downloaded' — file save ho gayi, WhatsApp alag se khula
 */
export async function shareFile(blob, filename, { title, text, phone } = {}) {
  const file = new File([blob], filename, { type: blob.type });

  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      // AbortError = aadmi ne khud band kiya. Ise "gadbad" batana galat hoga.
      if (err?.name === 'AbortError') return 'cancelled';
      // Kisi aur wajah se fail hua to neeche wala rasta le lete hain
    }
  }

  downloadBlob(blob, filename);
  if (text) window.open(waLink(text, phone), '_blank', 'noopener');
  return 'downloaded';
}

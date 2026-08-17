/**
 * EK TASVEER SE EK PDF — bina kisi library ke.
 *
 * Pehle iske liye jsPDF laga tha. Wo kaam to karta hai, par apne saath
 * html2canvas aur ek aur bada tukda kheench laata hai — kul milakar
 * ~180 KB (dabaya hua) sirf itne se kaam ke liye ki "ek tasveer ko ek kagaz
 * pe rakh do". Hamare dukaandaar aksar 2G/3G pe hote hain; wahan ye ek baar
 * ka download hi bill bhejne me sabse lambi der lagata tha.
 *
 * Ek page aur ek JPEG wali PDF ki banawat sidhi-saadhi hai, isliye wo yahin
 * bana lete hain. PDF me JPEG ko dobara badalna nahi padta — `DCTDecode`
 * matlab "ye jo bytes hain, ye JPEG hi hain, seedha rakh do". Yaani file utni
 * hi badi jitni tasveer, ek byte zyada nahi.
 *
 * Ek hi cheez me dhyan chahiye: PDF ke aakhir me "xref" hota hai, jisme har
 * hisse ka BYTE wala pata likha hota hai. Ek byte idhar-udhar hua to file
 * kholte hi kharab batti hai. Isliye neeche har cheez bytes me hi joddi gayi
 * hai (string me nahi), aur pata bhi bytes se hi gina gaya hai.
 */

const ascii = (str) => {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) out[i] = str.charCodeAt(i) & 0xff;
  return out;
};

/** A4, PDF ke apne naap (point) me — 72 point = 1 inch */
export const A4 = { width: 595.28, height: 841.89 };

/**
 * @param {Uint8Array} jpeg   JPEG file ke bytes (canvas.toBlob se seedha)
 * @param {number} pxWidth    tasveer ki chaudai (pixel)
 * @param {number} pxHeight   tasveer ki unchai (pixel)
 */
export function jpegToPdf(jpeg, pxWidth, pxHeight, page = A4) {
  const parts = [];
  let length = 0;
  const push = (bytes) => { parts.push(bytes); length += bytes.length; };
  const put = (str) => push(ascii(str));

  /** Har object ka pata yahan likhte jate hain — xref isi se banega */
  const offsets = [0];
  const startObject = (n, head) => {
    offsets[n] = length;
    put(`${n} 0 obj\n${head}\n`);
  };

  put('%PDF-1.4\n');
  // Ye chaar "gande" byte PDF ki apni reet hai — inse padhne wale ko pata
  // chalta hai ki file me binary hai, aur koi beech ka program use text
  // samajh kar line-ending nahi badal deta
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  startObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
  put('endobj\n');

  startObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  put('endobj\n');

  startObject(3,
    '<< /Type /Page /Parent 2 0 R '
    + `/MediaBox [0 0 ${page.width} ${page.height}] `
    + '/Resources << /XObject << /Im0 4 0 R >> >> '
    + '/Contents 5 0 R >>');
  put('endobj\n');

  // Tasveer — bytes jaisi ki waisi
  offsets[4] = length;
  put(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} `
    + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  put('\nendstream\nendobj\n');

  // Page pe tasveer kahan rakhni hai — poore kagaz pe
  const content = `q ${page.width} 0 0 ${page.height} 0 0 cm /Im0 Do Q\n`;
  offsets[5] = length;
  put(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

  // xref — har object ka pata, 20 byte ki ek-ek line me (PDF ka apna niyam)
  const xrefAt = length;
  put('xref\n0 6\n');
  put('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i += 1) put(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);

  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return new Blob([out], { type: 'application/pdf' });
}

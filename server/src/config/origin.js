import { env } from './env.js';

/**
 * App ka apna URL — invite link aur upload ki image ka link isse banta hai.
 *
 * Ek hi URL wale deploy (Render) me CLIENT_URL set karne ki zarurat nahi:
 * pehli request aate hi khud pata chal jata hai ki app kis URL pe chal raha hai.
 *
 * Tarteeb:
 *   1. CLIENT_URL/SERVER_URL env me set hain to wahi (sabse pakka)
 *   2. warna abhi tak ki sabse taazi request se pata chala hua origin
 *   3. warna localhost (dev me client 5173 pe alag chalta hai)
 *
 * BUG JO PEHLE THI (Part 35) — "pehli request" hamesha ke liye yaad rakhi
 * jaati thi. Local pe (`npm run dev`) restart ke turant baad agar PEHLI
 * request khud apne computer se (localhost) chali jaye — jaise ek baar
 * browser me kholna, ya koi health-check — to `detected` HAMESHA KE LIYE
 * "localhost" ban jata tha. Uske baad jo bhi photo upload hoti (chat ho ya
 * kuch aur), uska link `http://localhost:.../uploads/...` ban jata — jo
 * PHONE se kabhi nahi khulta (phone ka apna hi "localhost" khojta hai, is
 * computer ka nahi). Isliye kuch photo chalti thi (jo Cloudinary ya kisi
 * theek request ke baad bani), kuch nahi — bilkul random lagta tha.
 *
 * Do sudhaar:
 *   1. `localhost`/`127.0.0.1` ko KABHI yaad nahi rakhte, chahe wahi pehli
 *      request kyun na ho.
 *   2. Ek baar yaad rakhne ke baad bhi, aage har sahi request se taaza ho
 *      jata hai — jis phone/computer se abhi test kar rahe hain, wahi
 *      turant sahi origin ban jata hai.
 */
let detected = '';

export function rememberOrigin(req) {
  if (process.env.CLIENT_URL && process.env.SERVER_URL) return; // dono pakke se set hain

  const host = req.get('host');
  if (!host) return;

  // Apna hi computer — kisi doosre device ke liye kabhi kaam ka nahi
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return;

  // Render/nginx ke peeche https hota hai par andar http dikhta hai —
  // isliye x-forwarded-proto dekhna padta hai (app.set('trust proxy') isi ke liye)
  const proto = req.protocol || 'http';
  detected = `${proto}://${host}`;
}

/** Client ka URL — invite link yahin se banta hai */
export const clientOrigin = () => process.env.CLIENT_URL || detected || env.clientUrl;

/** Server ka URL — local upload ki image ka link yahin se banta hai */
export const serverOrigin = () => process.env.SERVER_URL || detected || env.serverUrl;

/** Sirf dikhane/debug ke liye */
export const detectedOrigin = () => detected;

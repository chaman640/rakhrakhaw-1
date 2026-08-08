import { env } from './env.js';

/**
 * App ka apna URL — invite link aur upload ki image ka link isse banta hai.
 *
 * Ek hi URL wale deploy (Render) me CLIENT_URL set karne ki zarurat nahi:
 * pehli request aate hi khud pata chal jata hai ki app kis URL pe chal raha hai.
 *
 * Tarteeb:
 *   1. CLIENT_URL env me set hai to wahi (sabse pakka)
 *   2. warna pehli request se pata chala hua origin
 *   3. warna localhost (dev me client 5173 pe alag chalta hai)
 */
let detected = '';

export function rememberOrigin(req) {
  if (detected || process.env.CLIENT_URL) return;

  const host = req.get('host');
  if (!host) return;

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

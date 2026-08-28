import { env } from '../config/env.js';

/**
 * SMS BHEJNE KA EK HI DARWAZA — Fast2SMS.
 *
 * Poore app me SMS sirf yahin se jata hai. Kal koi doosri company leni ho to
 * sirf ye ek file badalni padegi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEV ME BINA KEY KE BHI CHALTA HAI.
 *
 * Key na ho to code SERVER KE LOG me chhap jata hai aur kaam aage badh jata
 * hai. Ye jaan-boojh kar hai: nahi to app banane wale ko har baar asli SMS
 * bhejna padta — har login pe paisa, aur bina internet ke to kaam hi ruk jata.
 *
 * Production me ye rasta BAND hai. Wahan key na ho to saaf error aata hai,
 * kyunki wahan chup-chaap log me code chhapna sabse bada surakhsa ka ched
 * hoga — log to bahut logon ko dikhte hain.
 * ─────────────────────────────────────────────────────────────────────────
 */

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';

/** 10 ank ka saaf number — Fast2SMS +91 ya spaces nahi leta */
const tenDigits = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

export const smsReady = () => Boolean(
  env.sms.provider === 'apitxt' ? env.sms.apitxtKey : env.fast2sms.apiKey,
);

/** APITxT — URL .env se aata hai, taaki dashboard wala exact URL paste kiya ja sake */
async function sendViaApitxt(numbers, code) {
  const message = env.sms.apitxtTemplate.replace(/\{otp\}/g, code);
  const url = env.sms.apitxtUrl
    .replace('{key}', encodeURIComponent(env.sms.apitxtKey))
    .replace('{phone}', encodeURIComponent(numbers))
    .replace('{sender}', encodeURIComponent(env.sms.senderId))
    .replace('{otp}', encodeURIComponent(code))
    .replace('{message}', encodeURIComponent(message));

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ac.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`APITxT: ${text.slice(0, 120)}`);
    return { sent: true, provider: 'apitxt' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OTP bhejo.
 *
 * Jawab: `{ sent: true }` — sach me SMS gaya
 *        `{ sent: false, dev: true }` — dev me log pe chhapa
 *
 * `route=otp` Fast2SMS ka wahi rasta hai jispe DLT template ki zarurat nahi
 * padti — message wahi banata hai ("Your OTP: 123456"). Isliye yahan sirf
 * chhah ank bhejte hain, poora message nahi.
 */
export async function sendOtpSms(phone, code) {
  const numbers = tenDigits(phone);

  if (!smsReady()) {
    if (env.isProd) {
      throw new Error('SMS bhejne ki setting adhoori hai — FAST2SMS_API_KEY bharein');
    }
    console.log(`\n[sms] (dev) ${numbers} ka OTP: ${code}\n`);
    return { sent: false, dev: true };
  }

  if (env.sms.provider === 'apitxt') {
    try {
      return await sendViaApitxt(numbers, code);
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('OTP bhejne me der ho rahi hai. Dobara koshish karein.');
      console.warn('[sms]', err.message);
      throw new Error('OTP bhej nahi paye. Thodi der baad dobara koshish karein.');
    }
  }

  const url = `${FAST2SMS_URL}?authorization=${encodeURIComponent(env.fast2sms.apiKey)}`
    + `&route=otp&variables_values=${encodeURIComponent(code)}&flash=0&numbers=${numbers}`;

  /*
    Intezaar ki hadd.

    Bina iske ek dheema jawab poori request ko latka deta hai, aur screen pe
    ghumta hua pahiya minaton chalta rehta hai. Das second me jawab na aaye to
    maan lete hain ki nahi aane wala.
  */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.return !== true) {
      /*
        Unki galti ka message aksar taknik ki bhasha me hota hai
        ("Invalid Authentication"). Use seedha screen pe daalna aadmi ko kuch
        nahi batata, isliye log me poora sach aur screen pe seedhi baat.
      */
      console.warn('[sms] Fast2SMS ne mana kiya:', JSON.stringify(data).slice(0, 300));
      throw new Error('OTP bhej nahi paye. Thodi der baad dobara koshish karein.');
    }

    return { sent: true };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('OTP bhejne me der ho rahi hai. Dobara koshish karein.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

import { env } from '../config/env.js';
import { browserHeaders } from '../utils/browserHeaders.js';
import { guessValue, needsField, SEEDS } from './smsProbe.service.js';

/* OTP SMS — APITxT (MSG91-shape). Doc: apitxt.com/apiDoc/sendSMS */


const APITXT_URL = 'https://www.apitxt.com/api/sendhttp.php';

const tenDigits = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

/** Chaabi kabhi poori log ya jawab me nahi jati */
const hideKey = (url) => String(url)
  .replace(/(authkey|authorization|apikey|api_key|token)=([^&]{0,4})[^&]*/gi, '$1=$2••••');

export const smsProvider = () => env.sms.provider;

export function smsReady() {
  return env.sms.provider === 'fast2sms'
    ? Boolean(env.fast2sms.apiKey)
    : Boolean(env.sms.apitxtKey);
}

async function hit(url, { timeout = 12000, method = 'GET', form = null, json = null } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const headers = browserHeaders();
    if (form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (json) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      signal: ac.signal, method, headers, body: form || json,
    });
    const text = (await res.text()).trim();
    let json = null;
    try { json = JSON.parse(text); } catch { /* ye gateway aksar saada text deta hai */ }
    return { ok: res.ok, status: res.status, text: text.slice(0, 500), json };
  } finally {
    clearTimeout(timer);
  }
}

/* Gateway galti bhi HTTP 200 ke saath deta hai — body padhni padti hai */
function judge({ ok, text, json }) {
  const body = String(text || '').toLowerCase();

  if (/missing_browser_headers|access denied/.test(body)) return { sent: false, shield: true };

  const bad = /"?(type|status)"?\s*[:=]\s*"?(error|failure|failed|err)/.test(body)
    || /\b(invalid|unauthori[sz]ed|not\s*allowed|insufficient|no\s*balance|blocked|missing|required)\b/.test(body);

  if (!ok || bad) return { sent: false };

  const looksLikeId = /^[a-f0-9]{20,}$/i.test(String(text || '').trim());
  const saysSuccess = /"?(type|status)"?\s*[:=]\s*"?(success|ok)/.test(body)
    || (json && (json.type === 'success' || json.status === 'success'));

  return { sent: looksLikeId || saysSuccess || (ok && !bad) };
}

/** Ek koshish — diye hue sender ke saath (khali ho to wo khaana jaata hi nahi) */
async function apitxtOnce(phone, message, sender) {
  const q = new URLSearchParams({
    authkey: env.sms.apitxtKey,
    mobiles: phone,
    message,
    route: String(env.sms.route || 4),
    country: '91',
    flash: '0',
  });
  if (sender) q.set('sender', sender);
  if (env.sms.templateId) q.set('DLT_TE_ID', env.sms.templateId);

  const base = env.sms.apitxtUrl || APITXT_URL;
  const post = env.sms.method === 'POST';
  const url = post ? base : `${base}?${q.toString()}`;
  const r = await hit(url, post ? { method: 'POST', form: q.toString() } : {});

  return {
    ...judge(r),
    provider: 'apitxt',
    sender: sender || '(bina sender)',
    url: hideKey(url),
    status: r.status,
    response: r.json || r.text,
  };
}

/* Pehle sender ke saath, mana kare to bina sender ke (rejected try me SMS jata hi nahi) */
async function viaApitxt(phone, code) {
  const message = env.sms.apitxtTemplate.replace(/\{otp\}/g, code);
  const tries = [];

  const first = await apitxtOnce(phone, message, env.sms.senderId);
  tries.push(first);
  if (first.sent) return { ...first, tries };

  // Sender diya hua tha aur wahi rukawat lagi — ab bina sender ke
  if (env.sms.senderId) {
    const second = await apitxtOnce(phone, message, '');
    tries.push(second);
    if (second.sent) return { ...second, tries };
    return { ...second, tries };
  }

  return { ...first, tries };
}


/* ── APITxT ka asli OTP darwaza: /api/sendOtp ─────────────────────────────

   Jaanch se pata chala ki `/api/sendhttp.php` unke yahan hai hi nahi;
   `/api/sendOtp` hai, aur wo ek-ek khaana maang kar batata hai
   ("Missing mobile"). Isliye ye wahi karta hai jo aadmi karta: bhejo, jo
   maange wo jodo, dobara bhejo.

   Ek baar sahi khaane pata chal jayein to wo yaad rakh liye jate hain —
   uske baad har OTP ek hi request me chala jata hai.
*/

const OTP_URL = 'https://www.apitxt.com/api/sendOtp';
let seekhaHua = null;                    // { transport, khaane: [...] }

async function otpHit(fields, transport) {
  const qs = new URLSearchParams(fields).toString();
  if (transport === 'GET') return hit(`${OTP_URL}?${qs}`);
  if (transport === 'POST-json') {
    return hit(OTP_URL, { method: 'POST', json: JSON.stringify(fields) });
  }
  return hit(OTP_URL, { method: 'POST', form: qs });
}

function bharo(naam, ctx) {
  return guessValue(naam, ctx);
}

async function otpKoshish(transport, ctx, shuruKhaane = null) {
  const fields = {};
  if (shuruKhaane) for (const k of shuruKhaane) fields[k] = bharo(k, ctx);

  for (let i = 0; i < 8; i += 1) {
    const r = await otpHit(fields, transport);
    const j = judge(r);
    if (j.sent) return { ...j, transport, fields, status: r.status, response: r.json || r.text };

    const chahiye = needsField(r.text);
    if (!chahiye || fields[chahiye] !== undefined) {
      return { sent: false, transport, fields, status: r.status, response: r.json || r.text };
    }
    fields[chahiye] = bharo(chahiye, ctx);
  }
  return { sent: false, transport, fields, response: 'khaane khatam nahi hue' };
}

async function viaApitxtOtp(phone, code) {
  const ctx = { phone, code, message: env.sms.apitxtTemplate.replace(/\{otp\}/g, code) };
  const tries = [];

  // Pehle se seekha hua rasta — ek hi request
  if (seekhaHua) {
    const out = await otpKoshish(seekhaHua.transport, ctx, seekhaHua.khaane);
    tries.push({ ...out, provider: 'apitxt', url: OTP_URL });
    if (out.sent) return { ...out, provider: 'apitxt', url: OTP_URL, tries };
    seekhaHua = null;                    // purana rasta band ho gaya, dobara seekho
  }

  for (const seed of SEEDS) {
    for (const t of ['POST-form', 'POST-json', 'GET']) {
      const out = await otpKoshish(t, ctx, seed);
      tries.push({ ...out, provider: 'apitxt', url: OTP_URL, seed: seed.join('+') });
      if (out.sent) {
        seekhaHua = { transport: t, khaane: Object.keys(out.fields) };
        return { ...out, provider: 'apitxt', url: OTP_URL, tries };
      }
    }
  }
  return { sent: false, provider: 'apitxt', url: OTP_URL, tries, response: tries.at(-1)?.response };
}

/* ──────────────────────────────── Fast2SMS — sirf fallback ke taur pe ──── */

async function viaFast2sms(phone, code) {
  const url = 'https://www.fast2sms.com/dev/bulkV2'
    + `?authorization=${encodeURIComponent(env.fast2sms.apiKey)}`
    + `&route=otp&variables_values=${encodeURIComponent(code)}&flash=0&numbers=${phone}`;

  const r = await hit(url);
  return {
    sent: r.ok && r.json?.return === true,
    provider: 'fast2sms',
    url: hideKey(url),
    status: r.status,
    response: r.json || r.text,
  };
}

/* ──────────────────────────────────────────────────────────── ek darwaza */

/* Kabhi throw nahi karta — poora hisaab wapas deta hai */
export async function trySendOtp(phone, code) {
  const numbers = tenDigits(phone);
  if (numbers.length !== 10) {
    return { sent: false, provider: 'none', reason: 'phone_galat', response: 'Poora 10 ank ka number chahiye' };
  }

  if (!smsReady()) {
    return {
      sent: false,
      provider: env.sms.provider,
      reason: 'setting_adhoori',
      response: env.sms.provider === 'fast2sms'
        ? 'FAST2SMS_API_KEY nahi hai'
        : 'APITXT_API_KEY nahi hai',
    };
  }

  try {
    if (env.sms.provider === 'fast2sms') return await viaFast2sms(numbers, code);

    // /api/sendOtp asli darwaza hai; na chale to purana rasta bhi aajma lo
    const otpWala = await viaApitxtOtp(numbers, code);
    if (otpWala.sent) return otpWala;

    const purana = await viaApitxt(numbers, code);
    return purana.sent ? purana : { ...otpWala, tries: [...(otpWala.tries || []), ...(purana.tries || [])] };
  } catch (err) {
    return {
      sent: false,
      provider: env.sms.provider,
      reason: err.name === 'AbortError' ? 'der_ho_gayi' : 'network',
      response: err.message,
    };
  }
}

/* Purana naam — poore app me yahi bulaya jata hai */
export async function sendOtpSms(phone, code) {
  const out = await trySendOtp(phone, code);

  if (out.sent) return { sent: true, provider: out.provider, sender: out.sender };

  if (!env.isProd && (out.reason === 'setting_adhoori' || out.reason === 'network')) {
    console.log(`\n[sms] (dev) ${tenDigits(phone)} ka OTP: ${code}\n`);
    return { sent: false, dev: true };
  }

  for (const t of out.tries || [out]) {
    console.warn(
      `[sms] ${t.provider || env.sms.provider} ne mana kiya`
      + `${t.sender ? ` · sender: ${t.sender}` : ''}`
      + `${t.status ? ` · HTTP ${t.status}` : ''}`
      + `${t.url ? `\n[sms] url: ${t.url}` : ''}`
      + `\n[sms] jawab: ${typeof t.response === 'string' ? t.response : JSON.stringify(t.response)}`,
    );
  }
  console.warn('[sms] jaanchne ke liye:  npm run sms:test <number> --prefix server');

  if (out.reason === 'setting_adhoori') {
    throw new Error('SMS bhejne ki setting adhoori hai — server ki setting dekhein');
  }
  if (out.reason === 'der_ho_gayi') {
    throw new Error('OTP bhejne me der ho rahi hai. Dobara koshish karein.');
  }
  throw new Error('OTP bhej nahi paye. Thodi der baad dobara koshish karein.');
}

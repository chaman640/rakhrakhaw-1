import { env } from '../config/env.js';
import { browserHeaders } from '../utils/browserHeaders.js';

/*
  APITxT ka asli endpoint unke doc me likha nahi hai.

  Jo pata chala:
    · Bina browser headers ke unka shield rok deta tha (ab headers jate hain)
    · `/api/...` pe "Cannot GET" aata hai — ye Express ka 404 hai, yaani API
      wahan hai par rasta doosra hai
    · "Cannot GET" ka ek aur matlab bhi ho sakta hai: rasta hai, par sirf POST
      leta hai. Isliye har rasta GET aur POST dono se aajmaya jata hai.

  Jo rasta chal jaye, use APITXT_URL me daal dena.
*/

const HOST = 'https://www.apitxt.com';

/* Doc ka pata `/apiDoc/sendSMS` hai — panel aksar API ka naam wahi rakhte hain */
const PATHS = [
  '/api/sendSMS', '/api/sendsms', '/api/send-sms', '/api/send_sms',
  '/api/sms/send', '/api/sms/sendSMS', '/api/sms',
  '/api/send', '/api/sendMessage', '/api/message/send', '/api/messages',
  '/api/v1/sendSMS', '/api/v1/sendsms', '/api/v1/sms/send', '/api/v1/sms', '/api/v1/send',
  '/api/v2/sendSMS', '/api/v2/sms/send', '/api/v2/send',
  '/api/mt/SendSMS', '/api/mt/sendsms',
  '/api/http/sendSMS', '/api/http/send',
  '/api/sendhttp', '/api/bulkSMS', '/api/bulksms',
  '/api/user/sendSMS', '/api/campaign/send', '/api/quick/send', '/api/otp/send', '/api/sendOtp',
  '/sendSMS', '/sendsms', '/sms/send', '/send',
  '/v1/sendSMS', '/v2/sendSMS',
];

const mask = (u) => String(u).replace(
  /(authkey|authorization|apikey|api_key|APIKey|token)=([^&]{0,4})[^&]*/gi, '$1=$2••••',
);

/* Express ka apna 404 — iska matlab "rasta nahi hai", aur kuch nahi */
const express404 = (b) => /cannot (get|post) /i.test(b || '');
const spaPage = (b) => /<!doctype html/i.test(b || '') && !express404(b);

async function hit(url, { method = 'GET', body = null, type = null, timeout = 8000 } = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeout);
  try {
    const headers = browserHeaders();
    if (type) headers['Content-Type'] = type;
    const res = await fetch(url, {
      method, headers, body, signal: ac.signal, redirect: 'follow',
    });
    const text = (await res.text()).trim();
    return { url: mask(url), method, status: res.status, body: text.slice(0, 300) };
  } catch (err) {
    return {
      url: mask(url), method, status: 0,
      error: err.name === 'AbortError' ? 'timeout' : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function verdict(r) {
  if (r.status === 0) return r.error === 'timeout' ? 'jawab hi nahi aaya' : `nahi juda (${r.error})`;

  const b = (r.body || '').toLowerCase();

  if (/missing_browser_headers/.test(b)) return 'BOT-SHIELD ne roka (browser headers nahi the)';
  if (/access denied|forbidden|cloudflare|captcha|just a moment/.test(b)) return 'BOT-SHIELD ne roka';
  if (express404(b) || r.status === 404) return 'ye rasta hai hi nahi';
  if (spaPage(b)) return 'API nahi, website ka page mila';

  if (/invalid.*(authkey|api.?key|token)|authentication fail|unauthori/.test(b)) return '★ RASTA MIL GAYA — chaabi galat';
  if (/sender\s*id|senderid|\bdlt\b|template.*(not|invalid|missing|match)|invalid.*template/.test(b)) return '★ RASTA MIL GAYA — sender ID / DLT template chahiye';
  if (/balance|credit|insufficient/.test(b)) return '★ RASTA MIL GAYA — balance ki dikkat';
  if (/missing|required|param/.test(b)) return '★ RASTA MIL GAYA — koi khaana chhoot raha hai';
  if (/^[a-f0-9]{20,}$/i.test(r.body || '') || /"?(type|status)"?\s*[:=]\s*"?(success|ok)/.test(b)) return '★★ CHAL GAYA';
  if (r.status === 405) return '★ RASTA MIL GAYA — par doosra method chahiye';
  if (r.status === 401 || r.status === 403) return '★ RASTA MIL GAYA — chaabi/ijazat ki dikkat';
  if (r.status >= 200 && r.status < 300) return '★ RASTA MIL GAYA — jawab padhein';
  return `HTTP ${r.status}`;
}

const dilchasp = (v) => v.startsWith('★');

/* Ek saath 8 — unke server pe bojh na pade, aur jaanch bhi jaldi khatam ho */
async function batches(jobs, size = 8) {
  const out = [];
  for (let i = 0; i < jobs.length; i += size) {
    out.push(...await Promise.all(jobs.slice(i, i + size).map((j) => j())));
  }
  return out;
}

export async function probeSend(phone, message, opts = {}) {
  const sender = opts.sender === undefined ? env.sms.senderId : opts.sender;
  const templateId = opts.templateId === undefined ? env.sms.templateId : opts.templateId;

  const fields = {
    authkey: env.sms.apitxtKey,
    apikey: env.sms.apitxtKey,
    mobiles: phone,
    message,
    route: String(env.sms.route || 4),
    country: '91',
    flash: '0',
  };
  if (sender) fields.sender = sender;
  if (templateId) { fields.template_id = templateId; fields.DLT_TE_ID = templateId; }

  const qs = new URLSearchParams(fields).toString();
  const jobs = [];
  for (const p of PATHS) {
    jobs.push(() => hit(`${HOST}${p}?${qs}`));
    jobs.push(() => hit(`${HOST}${p}`, { method: 'POST', type: 'application/json', body: JSON.stringify(fields) }));
    jobs.push(() => hit(`${HOST}${p}`, { method: 'POST', type: 'application/x-www-form-urlencoded', body: qs }));
  }

  const all = (await batches(jobs)).map((r) => ({ ...r, natija: verdict(r) }));

  // Sirf kaam ke jawab wapas — warna 100+ line ka JSON padhna namumkin ho jata
  const mile = all.filter((r) => dilchasp(r.natija));
  return {
    kulKoshish: all.length,
    mileHue: mile.slice(0, 12),
    ...(mile.length > 12 ? { aurBhiMile: mile.length - 12 } : {}),
    baaki: {
      rastaNahi: all.filter((r) => r.natija === 'ye rasta hai hi nahi').length,
      shield: all.filter((r) => r.natija.startsWith('BOT-SHIELD')).length,
      juraNahi: all.filter((r) => /^(nahi juda|jawab hi)/.test(r.natija)).length,
      aur: all.filter((r) => /^(HTTP|API nahi)/.test(r.natija)).length,
    },
  };
}

/** Fast2SMS — sirf jaanch. Uska `otp` route DLT sender ID ke bina bhi chalta hai. */
export async function probeFast2sms(phone, code) {
  if (!env.fast2sms.apiKey) return { natija: 'FAST2SMS_API_KEY nahi hai — jaanch nahi ho payi' };

  const url = 'https://www.fast2sms.com/dev/bulkV2'
    + `?authorization=${encodeURIComponent(env.fast2sms.apiKey)}`
    + `&route=otp&variables_values=${encodeURIComponent(code)}&flash=0&numbers=${phone}`;

  const r = await hit(url);
  const b = (r.body || '').toLowerCase();
  return {
    ...r,
    natija: /"return"\s*:\s*true/.test(b) ? '★★ CHAL GAYA — SMS chala gaya'
      : /invalid|unauthor/.test(b) ? 'chaabi galat'
        : r.status === 0 ? `nahi juda (${r.error})` : `HTTP ${r.status} — jawab padhein`,
  };
}

export async function fullProbe(phone, message, opts = {}) {
  const code = (message.match(/\b(\d{6})\b/) || [, '000000'])[1];
  const [send, f2s, khoj] = await Promise.all([
    probeSend(phone, message, opts),
    probeFast2sms(phone, code),
    discoverOtpApi(phone, code, message),
  ]);

  const chala = send.mileHue.find((r) => r.natija.startsWith('★★')) || send.mileHue[0];
  const f2sChala = String(f2s.natija).startsWith('★★');

  return {
    setting: {
      provider: env.sms.provider,
      keyKaShuru: env.sms.apitxtKey ? `${env.sms.apitxtKey.slice(0, 4)}••••` : '(khali)',
      senderId: (opts.sender === undefined ? env.sms.senderId : opts.sender) || '(khali)',
      dltTemplateId: (opts.templateId === undefined ? env.sms.templateId : opts.templateId) || '(khali)',
      route: env.sms.route,
      abhiKaUrl: env.sms.apitxtUrl,
    },
    nateeja: khoj.jeeta
      ? `★★ OTP CHALA GAYA → ${khoj.endpoint} · ${khoj.jeeta}`
      : chala
        ? `MIL GAYA → ${chala.method} ${chala.url.split('?')[0]} — ${chala.natija}`
      : `${send.kulKoshish} raste aajmaye, kisi pe bhi APITxT ka API nahi mila.`
          + ' Unse seedha endpoint URL poochna padega.',
    kyaKarein: khoj.jeeta
      ? `Bas! ${khoj.endpoint} chal gaya. Phone dekhein — OTP aa gaya hoga.`
      : chala
      ? `Render me daalein: APITXT_URL=${chala.url.split('?')[0]}`
      : f2sChala
        ? 'Fast2SMS chal raha hai — Render me SMS_PROVIDER=fast2sms kar dein, OTP turant aane lagega.'
        : 'APITxT support se endpoint URL maangein. Tab tak OTP_MODE=lenient rakhein.',
    otpApiKiKhoj: khoj,
    apitxt: send,
    fast2sms: f2s,
  };
}

/* ═══════════════ /api/sendOtp ke khaane khud dhundo ═══════════════

   Endpoint mil gaya: https://www.apitxt.com/api/sendOtp
   Wo "Missing mobile" bolta hai — yaani ek-ek khaana maangta hai.

   Ye function wahi karta hai jo aadmi karta: bhejo, jo maange wo jodo,
   dobara bhejo. Jab tak wo maangna band na kar de.
*/

const OTP_PATH = '/api/sendOtp';

/** Naam dekh kar us khaane me kya jayega, ye tay karo */
export function guessValue(name, { phone, code, message }) {
  const n = String(name).toLowerCase();
  if (/mobile|phone|number|msisdn|^to$|recipient/.test(n)) return phone;
  if (/otp|^code$|pin|password/.test(n)) return code;
  if (/auth|api.?key|token|secret|^key$/.test(n)) return env.sms.apitxtKey;
  if (/sender|from|header/.test(n)) return env.sms.senderId || 'RKHRKV';
  if (/template|^tid$|dlt/.test(n)) return env.sms.templateId || '';
  if (/message|msg|text|content|body/.test(n)) return message;
  if (/route|channel/.test(n)) return String(env.sms.route || 4);
  if (/country|^cc$/.test(n)) return '91';
  if (/expir|valid|ttl|minute/.test(n)) return '10';
  if (/type/.test(n)) return String(env.sms.route || 4);
  return '1';
}

/** Jawab me se "kaunsa khaana chahiye" nikalo */
export function needsField(body) {
  const s = String(body || '');
  const pats = [
    /missing\s+["']?([a-z0-9_-]+)/i,
    /["']?([a-z0-9_-]+)["']?\s+is\s+(?:required|missing)/i,
    /required\s*(?:field)?\s*[:\-]?\s*["']?([a-z0-9_-]+)/i,
    /(?:please\s+)?(?:provide|enter)\s+["']?([a-z0-9_-]+)/i,
    /invalid\s+["']?([a-z0-9_-]+)/i,
  ];
  for (const p of pats) {
    const m = s.match(p);
    if (m && m[1] && !/error|status|message/i.test(m[1])) return m[1];
  }
  return null;
}

async function sendWith(fields, transport) {
  const url = `${HOST}${OTP_PATH}`;
  const qs = new URLSearchParams(fields).toString();
  if (transport === 'GET') return hit(`${url}?${qs}`);
  if (transport === 'POST-json') {
    return hit(url, { method: 'POST', type: 'application/json', body: JSON.stringify(fields) });
  }
  return hit(url, { method: 'POST', type: 'application/x-www-form-urlencoded', body: qs });
}

async function discoverOne(transport, ctx) {
  const fields = {};
  const kadam = [];

  for (let i = 0; i < 10; i += 1) {
    const r = await sendWith(fields, transport);
    const chahiye = needsField(r.body);
    const nat = verdict(r);

    kadam.push({
      bhejeKhaane: Object.keys(fields), status: r.status, jawab: r.body, abChahiye: chahiye,
    });

    if (nat.startsWith('★★')) return { transport, natija: '★★ CHAL GAYA', khaane: fields, kadam };
    if (!chahiye) return { transport, natija: 'aur kuch nahi maang raha', khaane: Object.keys(fields), kadam };
    if (fields[chahiye] !== undefined) {
      return { transport, natija: `"${chahiye}" ki value pasand nahi aayi`, khaane: fields, kadam };
    }
    fields[chahiye] = guessValue(chahiye, ctx);
  }
  return { transport, natija: '10 baar ke baad bhi maangta raha', khaane: Object.keys(fields), kadam };
}

/** Teeno tareeke se dhundo — GET, POST(json), POST(form) */
export async function discoverOtpApi(phone, code, message) {
  const ctx = { phone, code, message };
  const sab = [];
  for (const t of ['GET', 'POST-json', 'POST-form']) sab.push(await discoverOne(t, ctx));

  const jeeta = sab.find((r) => r.natija.startsWith('★★'));
  return {
    endpoint: `${HOST}${OTP_PATH}`,
    jeeta: jeeta ? `${jeeta.transport} — khaane: ${JSON.stringify(Object.keys(jeeta.khaane))}` : null,
    koshishein: sab,
  };
}

import { env } from '../config/env.js';

/*
  APITxT ka asli endpoint unke doc page pe likha nahi hai. Isliye andaze ki
  jagah ye file gateway se KHUD poochti hai: har mumkin rasta aajmati hai aur
  unka poora jawab jaisa ka waisa wapas deti hai.

  Jo rasta chal jaye, use APITXT_URL me daal dena — code badalne ki zarurat
  nahi.
*/

const HOSTS = ['https://www.apitxt.com', 'https://api.apitxt.com', 'http://www.apitxt.com'];
const SEND_PATHS = ['/api/sendhttp.php', '/api/v2/sendsms', '/sendhttp.php', '/api/sendmsg.php', '/api/mt/SendSMS'];
const BAL_PATHS = ['/api/balance.php', '/api/v2/balance'];

const mask = (u) => String(u).replace(
  /(authkey|authorization|apikey|api_key|APIKey|token)=([^&]{0,4})[^&]*/gi, '$1=$2••••',
);

async function hit(url, timeout = 9000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { Accept: '*/*' } });
    const text = (await res.text()).trim();
    return { url: mask(url), status: res.status, ms: Date.now() - started, body: text.slice(0, 400) };
  } catch (err) {
    return { url: mask(url), status: 0, ms: Date.now() - started, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(t);
  }
}

/* Ek jawab dekh kar batao ki wo "asli gateway" jaisa lagta hai ya nahi */
function verdict(r) {
  if (r.status === 0) return r.error === 'timeout' ? 'jawab hi nahi aaya' : `nahi juda (${r.error})`;
  if (r.status === 404) return 'ye rasta hai hi nahi';
  const b = (r.body || '').toLowerCase();
  if (/<!doctype|<html/.test(b)) return 'API nahi, website ka page mila';
  if (/invalid.*authkey|authentication|unauthori/.test(b)) return 'RASTA SAHI — par chaabi (key) galat';
  if (/sender|dlt|template|header/.test(b)) return 'RASTA SAHI — sender ID / DLT template ki dikkat';
  if (/balance|credit|insufficient/.test(b)) return 'RASTA SAHI — balance ki dikkat';
  if (/^[a-f0-9]{20,}$/i.test(r.body || '') || /"?(type|status)"?\s*[:=]\s*"?(success|ok)/.test(b)) return 'CHAL GAYA';
  if (r.status >= 200 && r.status < 300) return 'RASTA SAHI — jawab neeche padhein';
  return `HTTP ${r.status}`;
}

const withVerdict = (r) => ({ ...r, natija: verdict(r) });

/** Balance poochna — isme SMS nahi jata, sirf chaabi sahi hai ya nahi pata chalta */
export async function probeBalance() {
  const key = env.sms.apitxtKey;
  const urls = [];
  for (const h of HOSTS.slice(0, 2)) {
    for (const p of BAL_PATHS) {
      urls.push(`${h}${p}?authkey=${encodeURIComponent(key)}&type=${env.sms.route || 4}`);
    }
  }
  return (await Promise.all(urls.map((u) => hit(u)))).map(withVerdict);
}

/** Har rasta aajma kar dekho — kaunsa gateway jaisa jawab deta hai */
export async function probeSend(phone, message, opts = {}) {
  const sender = opts.sender === undefined ? env.sms.senderId : opts.sender;
  const templateId = opts.templateId === undefined ? env.sms.templateId : opts.templateId;
  const key = env.sms.apitxtKey;
  const out = [];

  for (const h of HOSTS) {
    for (const p of SEND_PATHS) {
      const q = new URLSearchParams({
        authkey: key,
        mobiles: phone,
        message,
        route: String(env.sms.route || 4),
        country: '91',
        flash: '0',
      });
      if (sender) q.set('sender', sender);
      if (templateId) q.set('DLT_TE_ID', templateId);
      out.push(withVerdict(await hit(`${h}${p}?${q}`)));
    }
  }
  return out;
}

/** Poori jaanch ek jagah */
export async function fullProbe(phone, message, opts = {}) {
  const [balance, send] = await Promise.all([probeBalance(), probeSend(phone, message, opts)]);
  const chala = send.find((r) => r.natija === 'CHAL GAYA')
    || send.find((r) => String(r.natija).startsWith('RASTA SAHI'));

  return {
    setting: {
      provider: env.sms.provider,
      keyMili: Boolean(env.sms.apitxtKey),
      keyKaShuru: env.sms.apitxtKey ? `${env.sms.apitxtKey.slice(0, 4)}••••` : '(khali)',
      senderId: (opts.sender === undefined ? env.sms.senderId : opts.sender) || '(khali)',
      dltTemplateId: (opts.templateId === undefined ? env.sms.templateId : opts.templateId) || '(khali)',
      route: env.sms.route,
      abhiKaUrl: env.sms.apitxtUrl,
    },
    nateeja: chala
      ? `Sabse sahi rasta: ${chala.url.split('?')[0]} — ${chala.natija}`
      : 'Koi bhi rasta gateway jaisa jawab nahi de raha. Neeche har koshish ka jawab dekhein.',
    balanceKiJaanch: balance,
    bhejneKiKoshish: send,
  };
}

import DICT from './dict';

/**
 * BHASHA.
 *
 * Teen bhashayein hain:
 *
 *   hinglish  — jo code me likha hai (shabd ki "chaabi")
 *   hi        — शुद्ध हिन्दी
 *   en        — English (naye aadmi ko yahi dikhti hai)
 *
 * Ek baat samajhne layak hai: yahan "key" koi code jaisa naam nahi hai
 * (`invoice.create` type ka), balki KHUD HINGLISH WALA SHABD hai.
 *
 *     t('Naya bill')   →   'Naya bill' / 'नया बिल' / 'New bill'
 *
 * Iska bada faayda ye hai ki agar kisi shabd ka anuvaad likha hi nahi gaya,
 * to app tooti nahi — wahi Hinglish shabd dikh jata hai, jo dono taraf ke log
 * padh lete hain. Naya page likhne wale ko koi key-list bhi yaad nahi rakhni
 * padti: jo dikhana hai wahi `t()` ke andar likh do.
 *
 * Nuksan bhi ek hai: do jagah ek hi Hinglish shabd ka matlab alag ho to dono
 * ka anuvaad ek hi rahega. Hamari app me aisa koi mamla nahi hai; ho gaya to
 * us jagah shabd thoda badal dena hi seedha ilaaj hai.
 */

export const LANGS = [
  { value: 'hinglish', label: 'Hinglish', native: 'Hinglish', hint: 'Jaisa abhi hai' },
  { value: 'hi', label: 'Hindi', native: 'हिन्दी', hint: 'पूरी हिन्दी में' },
  { value: 'en', label: 'English', native: 'English', hint: 'In English' },
];

const VALID = new Set(LANGS.map((l) => l.value));
/*
  Do alag cheezein hain, isliye do alag naam:

    BASE_LANG     — code me shabd isi bhasha me likhe hain. Iska anuvaad
                    dhoondhna hi nahi padta.
    DEFAULT_LANG  — site pehli baar khulne par kaunsi bhasha dikhe.

  Pehle dono ek hi the (Hinglish). Ab site khulte hi English dikhni chahiye,
  jabki code ke shabd Hinglish hi rahenge.
*/
const BASE_LANG = 'hinglish';
export const DEFAULT_LANG = 'en';

/*
  Ye module ke andar ki ek chhoti si cheez hai, React ke state me nahi.

  Wajah: `t()` ko har jagah bulana hai — component ke bahar bhi, table ki
  column list me bhi, toast ke message me bhi. Agar ye hook hota to un sab
  jagah pe pahunchta hi nahi. Bhasha badalne par PrefsProvider poore page ko
  dobara bana deta hai, isliye naya shabd turant dikh jata hai.
*/
let current = DEFAULT_LANG;

export function getLang() {
  return current;
}

export function setLang(lang) {
  current = VALID.has(lang) ? lang : DEFAULT_LANG;
  return current;
}

/**
 * `t('Kul {n} item')` → `t('Kul {n} item', { n: 5 })`
 *
 * Number aur naam beech me daalne ke liye `{naam}` likhein. Anuvaad me wo
 * `{naam}` kahin bhi ja sakta hai — Hindi aur English ka vakya-kram alag hai,
 * aur yahi wajah hai ki tukdon me todkar jodna theek nahi hota.
 */
export function t(key, vars) {
  let out = key;

  if (current !== BASE_LANG) {
    const row = DICT[key];
    const found = row && row[current];
    if (found) out = found;
  }

  if (vars) {
    out = String(out).replace(/\{(\w+)\}/g, (whole, name) => (
      Object.prototype.hasOwnProperty.call(vars, name) ? (vars[name] == null || vars[name] === false ? '' : String(vars[name])) : whole
    ));
  }

  return out;
}

/** Translate only plain strings — for components that accept text or elements as props */
export const tx = (v) => (typeof v === 'string' ? t(v) : v);

/*
  Text the server builds with names and numbers inside (notifications, activity log):
  "Bill ban gaya — INV/26-27/0001". Each shape is listed once; the variable parts are kept.
*/
const DYNAMIC = [
  'Bill ban gaya — {a}', 'Bill cancel — {a}', 'Naya order — {a}', 'Order cancel — {a}', 'Order me badlav — {a}',
  'Payment confirm ho gaya — {a}', 'Payment mil gaya — {a}', 'Payment reject — {a}',
  '{a} ne yaad dilaya hai', '{a} ne bill cancel kar diya', '{a} aapki dukaan se judna chahte hain', '{a} ka maal aa gaya',
  'Kul {a}, baaki {b}', 'Kul {a} — poora ho gaya', '{a} {b} se',
  '{a} ka maal aap stock me daal chuke hain — apni purchase dekh lijiye', '{a} — wo maal ab stock me daalne ki zarurat nahi',
  '{a} item · {b} — apne stock me daal lijiye', '{a} bheja hai, confirm karein', '{a} khate me lag gaya',
  '"{a}" ka stock haath se badla — ab {b}', '"{a}" me {b} badla', '"{a}" hataya', '"{a}" ko {b} kiya',
  '{a} ke liye invite link banayi', '{a} banaya — ₹{b} ({c})', '{a} — ₹{b} (maal wapas aaya)', '{a} — ₹{b} (maal wapas bheja)',
  '{a} ka maal badla — ab {b} item, ₹{c}', '{a} confirm kiya — ₹{b} khate me laga', '{a} — ₹{b} diya ({c})', '{a} — ₹{b} liya ({c})',
  '{a} item pe ek saath "{b}" kiya', '{a} mitaya — stock wapas ghata', '{a} (₹{b}) mitaya', '{a} ki setting badli',
  'Item "{a}" hataya', 'Naya retailer "{a}" jodha', 'Naya supplier "{a}" jodha', 'Naya item "{a}" jodha',
  '{a} cancel kiya — {b}', '{a} reject kiya — {b}', '{a} cancel kiya', '{a} reject kiya', '{a} — {b} kiya', '{a} ko {b} banaya',
  '{a} ko hataya', '{a} me {b} badla', '{a} mitaya', 'Paisa aaya {a}', 'Paisa diya {a}',
  'Zyada se zyada {a}% discount', '{a} tak ka bill', 'Zyada se zyada {a} photo lag sakti hain',
].map((key) => {
  const names = [];
  const src = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return '(.+?)'; });
  return { key, names, re: new RegExp(`^${src}$`) };
});

/** Like t(), but also understands server text that has names or numbers mixed in */
export function tDyn(text) {
  if (typeof text !== 'string' || !text) return text;
  if (current === BASE_LANG || DICT[text]) return t(text);
  for (const { key, names, re } of DYNAMIC) {
    const m = text.match(re);
    if (m && DICT[key]) return t(key, Object.fromEntries(names.map((n, i) => [n, m[i + 1]])));
  }
  // "<known phrase> — <number or name>"
  const cut = text.indexOf(' — ');
  if (cut > 0 && DICT[text.slice(0, cut)]) return `${t(text.slice(0, cut))}${text.slice(cut)}`;
  return text;
}

/**
 * Kaunse shabd abhi anuvaad se bache hain — sirf banane walon ke liye.
 * Browser ke console me `__i18nMissing()` chala kar dekh sakte hain.
 */
export function missingKeys(lang = 'hi') {
  return Object.keys(DICT).filter((k) => !DICT[k]?.[lang]);
}

if (typeof window !== 'undefined') {
  window.__i18nMissing = missingKeys;
}

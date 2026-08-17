import DICT from './dict';

/**
 * BHASHA.
 *
 * Teen bhashayein hain:
 *
 *   hinglish  — jo abhi tak app me likha hai (default)
 *   hi        — शुद्ध हिन्दी
 *   en        — English
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
const DEFAULT_LANG = 'hinglish';

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

  if (current !== DEFAULT_LANG) {
    const row = DICT[key];
    const found = row && row[current];
    if (found) out = found;
  }

  if (vars) {
    out = String(out).replace(/\{(\w+)\}/g, (whole, name) => (
      Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
    ));
  }

  return out;
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

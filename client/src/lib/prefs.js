import { setLang } from './i18n';

/**
 * APP KI TEEN CHHOTI SETTINGS — bhasha, roshni aur akshar ka size.
 *
 * Ye teenon SIRF is phone/computer ki hain, account ki nahi. Wajah saaf hai:
 * dukaan ka malik counter pe bade akshar rakhta hai, aur wahi aadmi ghar pe
 * apne phone pe raat wala roop chahta hai. Server pe rakh dete to dono jagah
 * ek jaisa ho jata — jo kisi ko nahi chahiye.
 *
 * Isi wajah se ye login se pehle bhi chalti hain: login page bhi usi bhasha
 * aur usi roop me khulta hai.
 */

const KEY = 'rr_prefs';

export const THEMES = [
  { value: 'light', label: 'Din', hint: 'Safed background' },
  { value: 'dark', label: 'Raat', hint: 'Aankh pe halka' },
  { value: 'system', label: 'Phone jaisa', hint: 'Phone ki setting maanein' },
];

export const TEXT_SIZES = [
  { value: 'small', label: 'Chhota', px: 15 },
  { value: 'normal', label: 'Normal', px: 16 },
  { value: 'large', label: 'Bada', px: 18 },
  { value: 'xlarge', label: 'Sabse bada', px: 20 },
];

export const DEFAULT_PREFS = { lang: 'hinglish', theme: 'light', textSize: 'normal' };

const THEME_COLORS = { light: '#0f766e', dark: '#0c1220' };

export function readPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const saved = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    // Purani ya tooti hui setting — usse app rukni nahi chahiye
    return { ...DEFAULT_PREFS };
  }
}

export function writePrefs(prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
}

/** "system" chuna ho to phone ki apni setting dekh lo */
export function resolveTheme(theme) {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Setting ko sach me lagana — `<html>` par.
 *
 * `<html>` isliye, `<body>` nahi: font-size wahin se poori app ko naapti hai,
 * aur `.dark` bhi upar hoga tabhi neeche ke saare rang badalenge.
 */
export function applyPrefs(prefs) {
  const root = document.documentElement;
  const theme = resolveTheme(prefs.theme);

  root.classList.toggle('dark', theme === 'dark');
  root.dataset.text = prefs.textSize;
  root.lang = prefs.lang === 'hi' ? 'hi' : 'en';
  setLang(prefs.lang);

  // Phone me address bar ka rang bhi app ke saath badle
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.light);
}

/*
  React ke chalne se PEHLE hi laga do.

  Agar ye kaam kisi useEffect me hota to ek pal ke liye safed page dikhta aur
  phir kaala ho jata — raat me wo ek pal aankh me chubhta hai. Ye file main.jsx
  me sabse upar import hoti hai, isliye pehli baar kuch dikhne se pehle hi
  setting lag chuki hoti hai.
*/
if (typeof document !== 'undefined') {
  applyPrefs(readPrefs());
}

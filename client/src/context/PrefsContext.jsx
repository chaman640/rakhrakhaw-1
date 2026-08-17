import {
  createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import {
  readPrefs, writePrefs, applyPrefs, resolveTheme,
  THEMES, TEXT_SIZES, DEFAULT_PREFS,
} from '@/lib/prefs';
import { LANGS } from '@/lib/i18n';

const PrefsContext = createContext(null);

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(readPrefs);

  const update = useCallback((patch) => {
    setPrefs((old) => {
      const next = { ...old, ...patch };
      writePrefs(next);
      applyPrefs(next);
      return next;
    });
  }, []);

  /*
    "Phone jaisa" chuna ho aur user apne phone ki setting badal de (ya shaam
    ho jaye aur phone khud dark kar de) — to app ko bhi turant badalna chahiye,
    bina refresh ke.
  */
  useEffect(() => {
    if (prefs.theme !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyPrefs(prefs);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [prefs]);

  /*
    CHHAPTE WAQT HAMESHA DIN WALA ROOP.

    Raat wale roop me bill chhap jata to kagaz pe kaala background aur safed
    akshar aate — printer ki saari syahi ek bill me khatam. Isliye print box
    khulne se pehle `.dark` hata dete hain aur baad me wapas laga dete hain.
    User ko kuch pata bhi nahi chalta.
  */
  useEffect(() => {
    const root = document.documentElement;
    let wasDark = false;
    const before = () => { wasDark = root.classList.contains('dark'); root.classList.remove('dark'); };
    const after = () => { if (wasDark) root.classList.add('dark'); };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const value = useMemo(() => ({
    ...prefs,
    theme: prefs.theme,
    resolvedTheme: resolveTheme(prefs.theme),
    setLangPref: (lang) => update({ lang }),
    setTheme: (theme) => update({ theme }),
    setTextSize: (textSize) => update({ textSize }),
    reset: () => update(DEFAULT_PREFS),
    LANGS, THEMES, TEXT_SIZES,
  }), [prefs, update]);

  /*
    `key={prefs.lang}` — yahi wo ek line hai jisse bhasha badalte hi poora
    page nayi bhasha me dobara ban jata hai.

    Zarurat kyun padi: `t()` ek saadha function hai, React ka hook nahi. Uska
    faayda ye hai ki wo har jagah chalta hai — component ke bahar, table ki
    column list me, toast ke message me. Nuksan ye ki bhasha badalne par React
    ko khud pata nahi chalta ki kya kya dobara banana hai. Key badal dene se
    React neeche ka sab kuch naye sire se banata hai — aur sab kuch matlab SAB
    kuch, chahe wo kitni bhi gehrai me ho.

    Bhasha saal me do baar badalti hai, isliye ye "mehnga" tarika bilkul theek
    hai. Data ka cache module me rehta hai, isliye dobara koi request bhi nahi
    jati — page bas naye shabdon ke saath dobara khinch jata hai.
  */
  return (
    <PrefsContext.Provider value={value}>
      <Fragment key={prefs.lang}>{children}</Fragment>
    </PrefsContext.Provider>
  );
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs ko PrefsProvider ke andar hi use karein');
  return ctx;
}

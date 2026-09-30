import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench, RefreshCw } from 'lucide-react';
import { usePlatform, loadPlatform } from '@/lib/platform';
import { usePrefs } from '@/context/PrefsContext';
import { t } from '@/lib/i18n';

/** Full-screen notice while the platform is under maintenance; also applies the admin's default language */
export default function MaintenanceGate({ children }) {
  const platform = usePlatform();
  const { pathname } = useLocation();
  const prefs = usePrefs();
  const [hit, setHit] = useState(null);

  useEffect(() => {
    const on = (e) => { setHit(e.detail || {}); loadPlatform(true); };
    window.addEventListener('rr:maintenance', on);
    return () => window.removeEventListener('rr:maintenance', on);
  }, []);
  useEffect(() => {
    if (platform && !platform.maintenance?.enabled) setHit(null);
  }, [platform]);
  useEffect(() => {
    if (platform?.defaultLanguage && !prefs.langChosen && prefs.lang !== platform.defaultLanguage) prefs.applyDefaultLang?.(platform.defaultLanguage);
  }, [platform?.defaultLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  const on = (platform?.maintenance?.enabled || hit) && !pathname.startsWith('/partner');
  if (!on) return children;
  const until = platform?.maintenance?.until || hit?.until;
  const msg = platform?.maintenance?.message || hit?.message;
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700"><Wrench size={26} /></span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{t('We are upgrading {name}', { name: platform?.name || 'RakhRakhav' })}</h1>
        <p className="mt-2 text-sm text-slate-600">{msg || t('The app will be back shortly. Your data is safe.')}</p>
        {until && <p className="mt-1 text-sm text-slate-500">{t('Expected back: {d}', { d: new Date(until).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</p>}
        <button type="button" onClick={() => loadPlatform(true).then((p) => { if (!p?.maintenance?.enabled) window.location.reload(); })}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"><RefreshCw size={14} />{t('Try again')}</button>
        {(platform?.supportPhone || platform?.supportWhatsapp) && <p className="mt-4 text-xs text-slate-500">{t('Urgent? Call {p}', { p: platform.supportPhone || platform.supportWhatsapp })}</p>}
      </div>
    </div>
  );
}

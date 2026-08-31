import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { t } from '@/lib/i18n';

/*
  APP INSTALL KARNE KA SUJHAV — sirf logout wale ko.

  Login kiye hue aadmi ko har baar ye dikhana pareshan karta hai; wo pehle se
  hamara hai. Naya aadmi jo pehli baar aaya hai, usi ko dikhta hai.

  Browser khud tay karta hai ki ye sujhav kab dena hai (`beforeinstallprompt`).
  Isliye zabardasti kuch nahi dikhaya jata — jahan browser mana kare, wahan
  kuch aata hi nahi. Ek baar band kar diya to 30 din tak dobara nahi aata.
*/
const KEY = 'rr_install_hidden';

export default function InstallPrompt({ show = true }) {
  const [evt, setEvt] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) return undefined;
    try {
      const till = Number(localStorage.getItem(KEY) || 0);
      if (till > Date.now()) return undefined;
    } catch { /* private window */ }

    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
      setTimeout(() => setOpen(true), 2500);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [show]);

  const band = () => {
    setOpen(false);
    try { localStorage.setItem(KEY, String(Date.now() + 30 * 864e5)); } catch { /* ok */ }
  };

  if (!open || !evt) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={band}
        aria-label={t('Band karein')}
        className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <X size={16} />
      </button>

      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Download size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {t('App install kar lijiye')}
          </p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {t('Phone ki home screen pe aa jayegi — har baar browser kholne ki zarurat nahi.')}
          </p>
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              try { evt.prompt(); await evt.userChoice; } catch { /* browser ne mana kiya */ }
            }}
            className="mt-2.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {t('Install karein')}
          </button>
        </div>
      </div>
    </div>
  );
}

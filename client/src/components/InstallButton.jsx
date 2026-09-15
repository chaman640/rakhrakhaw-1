import { useEffect, useState } from 'react';
import { Download, X, Menu, Share } from 'lucide-react';
import { t } from '@/lib/i18n';

/**
 * "OFFLINE" BUTTON — hamesha dikhta hai, chahe browser apna install-prompt
 * de ya na de (Part 51).
 *
 * PEHLE ye button sirf tabhi dikhta tha jab browser khud `beforeinstallprompt`
 * bhej deta — jo Chrome apni marzi se, apne hisaab se (kabhi turant, kabhi
 * der se, kabhi kabhi kabhi nahi bhi) deta hai. Matlab button kabhi dikhta,
 * kabhi gayab rehta — dukaandaar ko lagta "hai hi nahi".
 *
 * Ab button HAMESHA hai. Do halaton mein se ek:
 *
 *   1. Browser ne apna install-prompt diya hai — usi ko turant dikhate hain
 *      (ek hi tap me install, sabse achha raasta jab miley).
 *   2. Nahi diya — to seedha samjha dete hain kaise haath se karna hai
 *      (Chrome ke ⋮ menu se, ya iPhone ke Share button se). Ye kabhi fail
 *      nahi hota, kyunki insaan khud kar raha hai, browser ke intezaar
 *      mein nahi hai.
 *
 * Pehle se install hai to button khud gayab ho jata hai — dobara install
 * karne ko kuch hai hi nahi.
 */
function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallButton({ className = '', variant = 'dark' }) {
  const [evt, setEvt] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (evt) {
      try {
        evt.prompt();
        await evt.userChoice;
      } catch { /* browser ne mana kiya — koi baat nahi */ }
      return;
    }
    setShowSteps(true);
  }

  const styles = variant === 'dark'
    ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10'
    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 font-semibold ${styles} ${className}`}
      >
        <Download size={17} /> {t('Offline')}
      </button>

      {showSteps && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setShowSteps(false)}>
          <div
            className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold text-slate-900">{t('App jaisa install karein')}</p>
              <button type="button" onClick={() => setShowSteps(false)} aria-label={t('Band karein')}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <p className="mb-3 text-sm text-slate-600">
              {t('Isse phone mein icon ban jaata hai aur bina internet ke bhi kaafi kaam chalta hai.')}
            </p>

            {isIos() ? (
              <ol className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <Share size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  {t('Neeche wale Share button pe dabayein')}
                </li>
                <li>{t('Add to Home Screen chunein')}</li>
              </ol>
            ) : (
              <ol className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <Menu size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  {t('Upar-daayein teen bindu (⋮) wale menu pe dabayein')}
                </li>
                <li>{t('App install karein ya Home screen par jodein chunein')}</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </>
  );
}

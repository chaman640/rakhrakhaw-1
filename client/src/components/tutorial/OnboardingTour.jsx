import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Check, Video } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Spinner } from '@/components/ui';
import { getLang, t } from '@/lib/i18n';

/** YouTube ka kaisa bhi link ho, embed karne layak URL bana do */
function toEmbedUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
    return url; // pehle se embed URL ho sakta hai
  } catch {
    return '';
  }
}

/**
 * ONBOARDING TOUR — pehli baar wala safar (Part 29).
 *
 * Har kadam ek page pe le jata hai (agar key `page:...` ho) aur uska video
 * upar se dikhata hai — page bhi peeche dikhta rehta hai, taaki lage "yahi
 * to wo jagah hai jiski baat ho rahi hai".
 *
 * `isRewatch=true` par ye sirf dikhata hai, poora/chhoda hua kahin nahi
 * likhta — MenuPage se "dobara dekhein" isi tarah kaam karta hai.
 */
export default function OnboardingTour({ onDone, isRewatch = false }) {
  const navigate = useNavigate();
  const { setBusiness, business } = useAuth();
  const [steps, setSteps] = useState(null);
  const [index, setIndex] = useState(0);
  const [lang, setLangState] = useState(getLang() === 'en' ? 'en' : 'hi');
  const jumpedRef = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    api.get('/tutorials/onboarding-tour').then((r) => {
      if (!cancelled) setSteps(r.data || []);
    }).catch(() => { if (!cancelled) setSteps([]); });
    return () => { cancelled = true; };
  }, []);

  const step = steps?.[index];

  // Har kadam pe — agar wo kisi page ka ho, wahin le jao (ek hi baar per kadam)
  useEffect(() => {
    if (!step?.key?.startsWith('page:')) return;
    if (jumpedRef.current.has(step.key)) return;
    jumpedRef.current.add(step.key);
    navigate(step.key.slice(5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function close(completed) {
    if (!isRewatch) {
      await api.post('/business/onboarding', { completed }).catch(() => {});
      setBusiness?.({ ...business, [completed ? 'onboardingCompletedAt' : 'onboardingSkippedAt']: new Date().toISOString() });
    }
    onDone();
  }

  // Load ho raha hai
  if (steps === null) return null;
  // Admin ne abhi tak koi video nahi lagaya — dikhane layak kuch hai hi nahi
  if (steps.length === 0) { if (isRewatch) close(false); return null; }

  const isLast = index === steps.length - 1;
  const videoUrl = step.videos?.[lang] || step.videos?.[lang === 'hi' ? 'en' : 'hi'];
  const embedUrl = toEmbedUrl(videoUrl);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand-600">
              <Video size={13} /> {t('{n}/{total}', { n: index + 1, total: steps.length })}
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">{step.title}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Bhasha — video ke upar hi, WhatsApp status jaisa nahi, saaf button */}
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-medium">
              <button type="button" onClick={() => setLangState('hi')}
                className={`px-2 py-1 ${lang === 'hi' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
                हिं
              </button>
              <button type="button" onClick={() => setLangState('en')}
                className={`px-2 py-1 ${lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
                EN
              </button>
            </div>
            <button type="button" onClick={() => close(false)} aria-label={t('Skip karein')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 focus-ring">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* video */}
        <div className="aspect-video w-full bg-slate-900">
          {embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={step.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
              {t('Video jald aayega')}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 p-3">
          <Button variant="ghost" size="sm" onClick={() => close(false)}>
            {t('Skip karein')}
          </Button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-brand-600' : 'bg-slate-200'}`} />
            ))}
          </div>

          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => setIndex((i) => i - 1)} />
            )}
            {isLast ? (
              <Button size="sm" icon={Check} onClick={() => close(true)}>{t('Poora hua')}</Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
                {t('Aage badhein')} <ChevronRight size={15} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

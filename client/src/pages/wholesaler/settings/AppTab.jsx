import { Languages, Sun, Moon, Smartphone, Type, Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { usePrefs } from '@/context/PrefsContext';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/cn';

/**
 * App ka apna roop — bhasha, roshni aur akshar ka size.
 *
 * Teenon SIRF isi phone/computer ke liye hain, account ke liye nahi. Counter
 * wale computer pe bade akshar aur ghar wale phone pe raat wala roop — dono
 * ek saath chal sakte hain.
 */

const THEME_ICON = { light: Sun, dark: Moon, system: Smartphone };

function Section({ icon: Icon, title, subtitle, children, note }) {
  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">{children}</div>

      {note && <p className="mt-3 text-xs text-slate-500">{note}</p>}
    </Card>
  );
}

/** Ek jaisa dikhne wala chunav ka button — teenon jagah yahi istemal hota hai */
function Choice({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-ring relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1',
        'rounded-xl border px-3 py-3 text-center transition',
        active
          ? 'border-brand-600 bg-brand-50 text-brand-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {active && <Check size={14} className="absolute right-2 top-2 text-brand-600" aria-hidden />}
      {children}
    </button>
  );
}

export default function AppTab() {
  const {
    lang, theme, textSize, resolvedTheme,
    setLangPref, setTheme, setTextSize,
    LANGS, THEMES, TEXT_SIZES,
  } = usePrefs();

  return (
    <div className="space-y-5">
      <Section
        icon={Languages}
        title={t('Bhasha')}
        subtitle={t('App ke shabd kis bhasha me dikhein')}
        note={t('Hinglish matlab jaisa abhi hai — Hindi ke shabd English akshar me. Jo shabd abhi anuvaad nahi hue, wo Hinglish me hi rahenge.')}
      >
        {LANGS.map((l) => (
          <Choice key={l.value} active={lang === l.value} onClick={() => setLangPref(l.value)}>
            <span className="text-base font-semibold">{l.native}</span>
            <span className="text-xs opacity-70">{t(l.hint)}</span>
          </Choice>
        ))}
      </Section>

      <Section
        icon={resolvedTheme === 'dark' ? Moon : Sun}
        title={t('Roshni')}
        subtitle={t('Din wala safed ya raat wala kaala')}
        note={t('Bill chhapte waqt hamesha safed kagaz hi chhapega — chahe raat wala roop chalu ho.')}
      >
        {THEMES.map((o) => {
          const Icon = THEME_ICON[o.value] || Sun;
          return (
            <Choice key={o.value} active={theme === o.value} onClick={() => setTheme(o.value)}>
              <Icon size={20} aria-hidden />
              <span className="text-sm font-semibold">{t(o.label)}</span>
              <span className="text-xs opacity-70">{t(o.hint)}</span>
            </Choice>
          );
        })}
      </Section>

      <Section
        icon={Type}
        title={t('Akshar ka size')}
        subtitle={t('Poora app chhota ya bada ho jayega')}
        note={t('Sirf akshar nahi — button aur khaane bhi utne hi bade honge, taaki ungli se dabane me aasani rahe.')}
      >
        {TEXT_SIZES.map((o) => (
          <Choice key={o.value} active={textSize === o.value} onClick={() => setTextSize(o.value)}>
            {/*
              Preview ke akshar `px` me hain, `rem` me nahi — warna jo size
              abhi chalu hai usi ke hisaab se saare preview bhi bade-chhote ho
              jate aur aapas me farak dikhta hi nahi.
            */}
            <span style={{ fontSize: `${o.px}px`, lineHeight: 1.2 }} className="font-semibold">{t('Aa')}</span>
            <span className="text-xs opacity-70">{t(o.label)}</span>
          </Choice>
        ))}
      </Section>
    </div>
  );
}

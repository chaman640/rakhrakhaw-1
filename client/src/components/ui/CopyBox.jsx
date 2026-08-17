import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * Copy karne layak dabba — link, code, kuch bhi.
 *
 * `navigator.clipboard` har jagah nahi chalta (purane browser, aur http pe
 * to bilkul nahi). Isliye fail hone par dabba khud select ho jata hai —
 * user Ctrl+C ya "Copy" daba kar kaam chala leta hai. Bina iske sirf ek
 * error dikhta aur link haath se nikal jata.
 */
export default function CopyBox({ label, value, className }) {
  const [copied, setCopied] = useState(false);

  async function copy(e) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Plan B — dabbe ka poora text select kar do
      const box = e.currentTarget.parentElement?.querySelector('input');
      box?.select();
    }
  }

  return (
    <div className={className}>
      {label && <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>}
      <div className="flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          aria-label={label || 'Copy karne layak'}
          className="mono min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus-ring"
        />
        <button
          type="button"
          onClick={copy}
          aria-label={t('Copy karein')}
          className={cn(
            // min-w/h 44px — phone pe ungli se dabana hota hai
            'flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-ring',
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-brand-700 text-white hover:bg-brand-800'
          )}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}

import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

// Ek line me filter buttons — "Sab / Low stock / Khatam"
export default function Chips({ options, value, onChange, className }) {
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-ring',
            value === opt.value
              ? 'border-brand-600 bg-brand-50 text-brand-700'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {t(opt.label)}
          {opt.count !== undefined && opt.count > 0 && (
            <span className={cn('ml-1.5 text-xs', value === opt.value ? 'text-brand-600' : 'text-slate-400')}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

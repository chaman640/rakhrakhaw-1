import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

/** − 2 +  — catalog aur cart dono me */
export default function QtyStepper({ value, onChange, min = 0, max = Infinity, unit, size = 'md', label }) {
  const n = Number(value || 0);
  const step = (delta) => onChange(Math.min(max, Math.max(min, Math.round((n + delta) * 100) / 100)));

  const btn = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const box = size === 'sm' ? 'h-8 w-12 text-sm' : 'h-10 w-16';

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={n <= min}
        aria-label={`${label || 'Quantity'} kam karein`}
        className={cn(btn, 'flex items-center justify-center rounded-l-lg text-slate-600',
          'hover:bg-slate-50 disabled:opacity-30 focus-ring')}
      >
        <Minus size={15} />
      </button>

      <input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        aria-label={label || 'Quantity'}
        className={cn(box, 'tabular border-x border-slate-300 text-center outline-none focus:bg-brand-50')}
      />

      <button
        type="button"
        onClick={() => step(1)}
        disabled={n >= max}
        aria-label={`${label || 'Quantity'} badhayein`}
        className={cn(btn, 'flex items-center justify-center rounded-r-lg text-slate-600',
          'hover:bg-slate-50 disabled:opacity-30 focus-ring')}
      >
        <Plus size={15} />
      </button>

      {unit && <span className="px-2 text-xs text-slate-500">{unit}</span>}
    </div>
  );
}

import { cn } from '@/lib/cn';

export default function Switch({ checked, onChange, label, description, disabled, id }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-900">
            {label}
          </label>
        )}
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-ring',
          checked ? 'bg-brand-600' : 'bg-slate-300',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

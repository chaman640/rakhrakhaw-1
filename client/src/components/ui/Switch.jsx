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

      {/*
        Dikhne me switch 44×24 ka hi hai, par DABNE ka ghera 44×44 hai.
        Ungli ki nok chhoti nahi hoti — 24px unchi patti pe har teesri baar
        tap chook jata hai. Isliye button poora 44px uncha hai aur uske andar
        switch beech me set hai (`items-center`). Dikhawat wahi, galti kam.
      */}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'group -my-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-ring',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <span
          className={cn(
            'relative inline-flex h-6 w-11 rounded-full transition-colors',
            checked ? 'bg-brand-600' : 'bg-slate-300'
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
          />
        </span>
      </button>
    </div>
  );
}

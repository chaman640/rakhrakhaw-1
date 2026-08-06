import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

const Input = forwardRef(function Input(
  { label, error, hint, required, prefix, suffix, className, containerClassName, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        // "*" ko <label> se BAHAR rakha hai — taaki label ka text bilkul saaf rahe
        // (screen reader aur test dono ko sirf "Kitna" mile, "Kitna*" nahi)
        <div className="mb-1.5 flex items-center">
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
          {required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
        </div>
      )}

      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 transition-colors focus-ring',
            'placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500',
            error ? 'border-red-400' : 'border-slate-300 hover:border-slate-400',
            // "+91" jaisa lamba prefix text ke upar na chadhe
            prefix && (String(prefix).length > 1 ? 'pl-11' : 'pl-8'),
            suffix && 'pr-12',
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {suffix}
          </span>
        )}
      </div>

      {error && <p id={`${inputId}-error`} className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && hint && <p id={`${inputId}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
});

export default Input;

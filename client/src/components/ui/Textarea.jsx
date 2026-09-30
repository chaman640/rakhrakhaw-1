import { forwardRef, useId } from 'react';
import { tx } from '@/lib/i18n';
import { cn } from '@/lib/cn';

const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, placeholder, rows = 3, className, containerClassName, id, ...props },
  ref
) {
  const autoId = useId();
  const areaId = id || autoId;

  // className textarea pe jata hai. Grid me jagah ghere (jaise sm:col-span-2) uske liye
  // containerClassName chahiye — Input me ye pehle se hai, Textarea me nahi tha,
  // isliye T&C ka box aadha width dikhta tha.
  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <div className="mb-1.5 flex items-baseline">
          <label htmlFor={areaId} className="block text-sm font-medium text-slate-700">{tx(label)}</label>
          {required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
        </div>
      )}
      <textarea
        ref={ref}
        id={areaId}
        aria-required={required || undefined}
        placeholder={tx(placeholder)}
        rows={rows}
        className={cn(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus-ring',
          'placeholder:text-slate-400',
          error ? 'border-red-400' : 'border-slate-300 hover:border-slate-400',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-slate-500">{tx(hint)}</p>}
    </div>
  );
});

export default Textarea;

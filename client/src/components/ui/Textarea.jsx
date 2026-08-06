import { forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

const Textarea = forwardRef(function Textarea({ label, error, hint, rows = 3, className, id, ...props }, ref) {
  const autoId = useId();
  const areaId = id || autoId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={areaId} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      )}
      <textarea
        ref={ref}
        id={areaId}
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
      {!error && hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
});

export default Textarea;

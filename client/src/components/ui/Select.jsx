import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const Select = forwardRef(function Select(
  { label, error, hint, required, options = [], placeholder = 'Choose...', className, children, id, ...props },
  ref
) {
  const autoId = useId();
  const selectId = id || autoId;

  return (
    <div className="w-full">
      {label && (
        // "*" label ke bahar — label ka text saaf rehta hai
        <div className="mb-1.5 flex items-center">
          <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
          {required && <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>}
        </div>
      )}

      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-9 text-sm text-slate-900 focus-ring',
            'disabled:bg-slate-100 disabled:text-slate-500',
            error ? 'border-red-400' : 'border-slate-300 hover:border-slate-400',
            className
          )}
          {...props}
        >
          {/*
            Option ka naam yahan `t()` se guzarta hai, bulane wale ke yahan
            nahi. Chips aur Tabs pehle se aisa hi karte the — Select reh gaya
            tha, aur uska nateeja ye tha ki har dropdown me chunav Hinglish
            me hi khada rehta tha: "Stock (zyada pehle)" English chunne par
            bhi wahi ka wahi. Anuvaad kitab me maujood tha, bas koi use maang
            hi nahi raha tha.

            Ek jagah theek karne se app ke saare dropdown theek ho jate hain,
            aur kisi bulane wale ko kuch badalna nahi padta.
          */}
          {placeholder && <option value="">{t(placeholder)}</option>}
          {options.map((opt) => {
            const value = typeof opt === 'string' ? opt : opt.value;
            const labelText = typeof opt === 'string' ? opt : opt.label;
            return <option key={value} value={value}>{t(labelText)}</option>;
          })}
          {children}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
});

export default Select;

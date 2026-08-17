import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('mb-5 flex gap-1 overflow-x-auto border-b border-slate-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            // px-3 phone pe: chaar tab (Dukaan · Paisa lena · Bill · Mera
            // account) 390px me tabhi aate hain. px-4 pe aakhri tab kinare se
            // bahar chala jata tha — scroll to hota hai, par dikhta nahi ki
            // aage kuch hai, aur log use dhoondhte hi nahi.
            'relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors focus-ring sm:px-4',
            value === tab.value
              ? 'text-brand-700'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <span className="flex items-center gap-2">
            {t(tab.label)}
            {tab.count > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {tab.count}
              </span>
            )}
          </span>
          {value === tab.value && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />
          )}
        </button>
      ))}
    </div>
  );
}

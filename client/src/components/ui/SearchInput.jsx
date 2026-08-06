import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export default function SearchInput({ value, onChange, placeholder = 'Dhundhein...', className }) {
  return (
    <div className={cn('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm
                   placeholder:text-slate-400 hover:border-slate-400 focus-ring"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Saaf karein"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

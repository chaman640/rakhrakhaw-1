import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * `showTotal={false}` un list ke liye jo apni ginti khud upar likhti hain
 * (jaise Payment ka "2 retailer se lena hai") — warna neeche "Kul 2 item"
 * dobara aata hai, aur "item" wahan galat shabd bhi hai.
 */
export default function Pagination({ page, totalPages, total, limit, onChange, showTotal = true }) {
  if (totalPages <= 1) {
    // `t()` yahan pehle tha hi nahi — ye line kisi bhi bhasha me Hinglish hi
    // rehti thi, jabki list ke baaki sab shabd badal jate the
    return total && showTotal ? (
      <p className="px-5 py-3 text-sm text-slate-500">{t('Kul {n} item', { n: total })}</p>
    ) : null;
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
      <p className="text-sm text-slate-500">
        {from}–{to} / {total}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600',
            'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-ring'
          )}
          aria-label={t('Pichla page')}
        >
          <ChevronLeft size={16} />
        </button>

        <span className="px-3 text-sm text-slate-600">
          {page} / {totalPages}
        </span>

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600',
            'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 focus-ring'
          )}
          aria-label={t('Agla page')}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

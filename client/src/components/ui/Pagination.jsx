import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export default function Pagination({ page, totalPages, total, limit, onChange }) {
  if (totalPages <= 1) {
    return total ? (
      <p className="px-5 py-3 text-sm text-slate-500">Kul {total} item</p>
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

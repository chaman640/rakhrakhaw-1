import { cn } from '@/lib/cn';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

/**
 * columns: [{ key, header, align, width, render(row, index), className }]
 *
 * Mobile pe horizontal scroll ho jata hai — dukaandaar ज्यादातर phone pe hi hoga.
 */
export default function Table({
  columns = [],
  rows = [],
  loading = false,
  emptyTitle = 'Kuch nahi mila',
  emptyMessage,
  emptyAction,
  onRowClick,
  rowKey = (row, i) => row._id || row.id || i,
  className,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
        <Spinner /> <span className="text-sm">Load ho raha hai...</span>
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center'
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-slate-100 last:border-0',
                onRowClick && 'cursor-pointer hover:bg-slate-50'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-slate-700',
                    col.align === 'right' && 'tabular text-right',
                    col.align === 'center' && 'text-center',
                    col.className
                  )}
                >
                  {col.render ? col.render(row, i) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

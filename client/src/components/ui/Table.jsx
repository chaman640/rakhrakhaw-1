import { cn } from '@/lib/cn';
import { SkeletonTable, SkeletonRows } from './Skeleton';
import EmptyState from './EmptyState';
import { t } from '@/lib/i18n';

/**
 * columns: [{ key, header, align, width, render(row, index), className, mobile }]
 *
 * `mobile` se phone wale roop me us column ki jagah tay hoti hai. Na do to
 * apne aap tay ho jati hai (neeche `classify` dekho):
 *   'title'   — sabse upar mota naam
 *   'badge'   — naam ke saamne daayein (status jaisa)
 *   'actions' — daayein kone me button
 *   'select'  — sabse baayein checkbox
 *   'meta'    — neeche "naam: ginti" jodi
 *   'block'   — neeche poori chaudai me (jaise koi bharne wala dabba)
 *   'hidden'  — phone pe mat dikhao
 *
 * PHONE PE TABLE KYUN NAHI:
 * table 600px se chhoti nahi hoti aur phone 390px ka hota hai. Yaani aakhri
 * column — jisme aksar Total ya button hota hai — screen se hi bahar rehta
 * tha. Dukaandaar ko pata hi nahi chalta ki wahan kuch hai. Isliye phone pe
 * har row apna ek card ban jati hai.
 *
 * Jin page pe pehle se apna banaya hua phone wala roop hai, wo `<Table>` ko
 * `hidden md:block` me lapet kar rakhte hain — unka apna roop hi chalega.
 */
function classify(col, i, cols) {
  if (col.mobile) return col.mobile;
  if (col.key === 'select') return 'select';
  if (col.key === 'actions' || col.header === '' || col.header == null) return 'actions';
  if (col.key === 'status' || col.key === 'paymentStatus') return 'badge';
  // pehla asli column (select ke baad) = naam
  const first = cols.findIndex((c) => c.key !== 'select');
  return i === first ? 'title' : 'meta';
}

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
  // Pehli baar: ghoomte chakkar ki jagah us cheez ka DHANCHA jo aane wali hai.
  // Isse data aane par kuch kudta nahi — bas rang bhar jata hai.
  if (loading) {
    return (
      <>
        <div className="hidden md:block"><SkeletonTable cols={Math.max(3, columns.length)} /></div>
        <div className="md:hidden"><SkeletonRows /></div>
      </>
    );
  }

  if (!rows.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} />;
  }

  const slot = (name) => columns.filter((c, i) => classify(c, i, columns) === name);
  const [selectCol] = slot('select');
  const [titleCol] = slot('title');
  const badgeCols = slot('badge');
  const metaCols = slot('meta');
  const actionCols = slot('actions');
  const blockCols = slot('block');

  const draw = (col, row, i) => (col.render ? col.render(row, i) : row[col.key] ?? '—');

  return (
    <>
    {/* Badi screen — poori table */}
    <div className={cn('hidden overflow-x-auto md:block', className)}>
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
                {t(col.header)}
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

    {/* Phone — har row ka apna card */}
    <div className={cn('divide-y divide-slate-100 md:hidden', className)}>
      {rows.map((row, i) => (
        <div
          key={rowKey(row, i)}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          {...(onRowClick ? { role: 'button', tabIndex: 0,
            onKeyDown: (e) => { if (e.key === 'Enter') onRowClick(row); } } : {})}
          className={cn('p-4', onRowClick && 'cursor-pointer active:bg-slate-50')}
        >
          <div className="flex items-start gap-3">
            {selectCol && (
              // Checkbox dabane se card na khule — warna har tick pe page badal jata
              <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>{draw(selectCol, row, i)}</div>
            )}

            <div className="min-w-0 flex-1">{titleCol && draw(titleCol, row, i)}</div>

            <div className="flex shrink-0 items-center gap-2">
              {badgeCols.map((c) => <span key={c.key}>{draw(c, row, i)}</span>)}
              {actionCols.length > 0 && (
                <span onClick={(e) => e.stopPropagation()}>
                  {actionCols.map((c) => <span key={c.key}>{draw(c, row, i)}</span>)}
                </span>
              )}
            </div>
          </div>

          {metaCols.length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {metaCols.map((c) => (
                <div key={c.key} className="flex gap-1.5">
                  <dt className="text-slate-400">{t(c.header)}</dt>
                  <dd className={cn('text-slate-700', c.align === 'right' && 'tabular font-medium')}>
                    {draw(c, row, i)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {blockCols.map((c) => (
            <div key={c.key} className="mt-3" onClick={(e) => e.stopPropagation()}>
              <p className="mb-1 text-xs font-medium text-slate-500">{t(c.header)}</p>
              {draw(c, row, i)}
            </div>
          ))}
        </div>
      ))}
    </div>
    </>
  );
}

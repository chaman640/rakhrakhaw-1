import { Download } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/format';
import { downloadText } from '@/lib/download';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const ist = (d) => new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);
export const today = () => ist(new Date());
export function fyStart() {
  const d = new Date(Date.now() + 330 * 60000);
  const y = d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${y}-04-01`;
}
export const monthStart = () => `${today().slice(0, 8)}01`;
export const thisMonth = () => today().slice(0, 7);
export const dateLabel = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export const Amt = ({ v, strong, muted, zero, className }) => (
  <span className={cn('tabular whitespace-nowrap', strong && 'font-semibold', muted && 'text-slate-500', v < 0 && 'text-red-600', className)}>
    {v || zero ? formatMoney(v || 0) : '—'}
  </span>
);

export function DateRange({ from, to, onChange, single = false }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {!single && <div className="w-40"><Input label={t('From')} type="date" value={from} max={to} onChange={(e) => e.target.value && onChange({ from: e.target.value, to })} /></div>}
      <div className="w-40"><Input label={single ? t('As on') : t('To')} type="date" value={to} min={single ? undefined : from} max={today()} onChange={(e) => e.target.value && onChange({ from, to: e.target.value })} /></div>
    </div>
  );
}

export function PresetChips({ onPick }) {
  const presets = [
    ['This month', monthStart(), today()],
    ['This financial year', fyStart(), today()],
  ];
  return (
    <div className="flex gap-1.5">
      {presets.map(([l, f, to]) => (
        <button key={l} type="button" onClick={() => onPick({ from: f, to })} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-ring">{t(l)}</button>
      ))}
    </div>
  );
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** `cols`: [[header, (row) => value]] */
export function ExportButton({ name, cols, rows }) {
  const { can } = useAuth();
  if (!can('reports:export') || !rows?.length) return null;
  const run = () => {
    const text = [cols.map(([h]) => csvCell(t(h))).join(','), ...rows.map((r) => cols.map(([, f]) => csvCell(f(r))).join(','))].join('\n');
    downloadText(`${name}-${today()}.csv`, text);
  };
  return <Button size="sm" variant="secondary" icon={Download} onClick={run}>{t('CSV')}</Button>;
}

export function Toolbar({ children, right }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {right && <div className="flex gap-2">{right}</div>}
    </div>
  );
}

/** Statement ki ek line: naam aur rakam */
export function Line({ label, value, strong, muted, indent, big, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={cn('flex w-full items-center justify-between gap-3 py-1.5 text-left text-sm', indent && 'pl-4', strong && 'border-t border-slate-200 pt-2 font-semibold', big && 'text-base', onClick && 'hover:text-brand-700')}>
      <span className={cn(muted ? 'text-slate-500' : 'text-slate-800')}>{label}</span>
      <Amt v={value} strong={strong} muted={muted} />
    </Tag>
  );
}

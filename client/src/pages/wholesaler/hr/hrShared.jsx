import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export const ATT_LABEL = {
  present: 'Present', late: 'Late', half_day: 'Half day', absent: 'Absent', leave: 'On leave',
  holiday: 'Holiday', weekly_off: 'Weekly off', not_marked: 'Not marked', not_tracked: 'Not tracked', upcoming: '—',
};
export const ATT_TONE = {
  present: 'green', late: 'amber', half_day: 'amber', absent: 'red', leave: 'blue', holiday: 'brand', weekly_off: 'slate', not_marked: 'slate',
};
export const ATT_CELL = {
  present: 'bg-emerald-500 text-white', late: 'bg-amber-400 text-white', half_day: 'bg-amber-200 text-amber-900',
  absent: 'bg-red-500 text-white', leave: 'bg-blue-500 text-white', holiday: 'bg-brand-500 text-white',
  weekly_off: 'bg-slate-200 text-slate-500', not_marked: 'bg-white text-slate-400 ring-1 ring-inset ring-slate-200', upcoming: 'bg-slate-50 text-slate-300', not_tracked: 'bg-slate-50 text-slate-400',
};
export const REQ_TONE = { pending: 'amber', approved: 'green', rejected: 'red', cancelled: 'slate', closed: 'slate' };
export const PAY_TONE = { draft: 'slate', approved: 'blue', paid: 'green', cancelled: 'red' };
export const EMP_TYPES = [['full_time', 'Full time'], ['part_time', 'Part time'], ['contract', 'Contract'], ['intern', 'Intern']];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AttBadge = ({ status }) => <Badge tone={ATT_TONE[status] || 'slate'}>{t(ATT_LABEL[status] || status)}</Badge>;
export const Cap = (s) => t(String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1));

export function useHrMeta() {
  return useQuery(['hr', 'meta'], () => api.get('/hr/meta').then((r) => r.data), { poll: false });
}

export function Avatar({ name, url, size = 36 }) {
  if (url) return <img src={url} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {(name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
    </span>
  );
}

export const thisPeriod = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);
export const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export function shiftPeriod(p, n) {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
export const periodLabel = (p) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const timeOf = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—');
export const hhmm = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }) : '');
export const hoursOf = (min) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '—');

export function MonthPicker({ value, onChange, max = thisPeriod() }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white">
      <button type="button" aria-label={t('Previous month')} onClick={() => onChange(shiftPeriod(value, -1))} className="p-2 text-slate-500 hover:text-slate-900 focus-ring rounded-l-lg"><ChevronLeft size={16} /></button>
      <span className="min-w-32 text-center text-sm font-medium text-slate-800">{periodLabel(value)}</span>
      <button type="button" aria-label={t('Next month')} disabled={value >= max} onClick={() => onChange(shiftPeriod(value, 1))} className="p-2 text-slate-500 hover:text-slate-900 disabled:opacity-30 focus-ring rounded-r-lg"><ChevronRight size={16} /></button>
    </div>
  );
}

/** Mahine ka calendar — har din ek khana, rang status se */
export function MonthGrid({ days, onPick }) {
  if (!days?.length) return null;
  const lead = new Date(`${days[0].day}T00:00:00Z`).getUTCDay();
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
        {WEEKDAYS.map((w) => <span key={w}>{t(w)}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }).map((_, i) => <span key={`x${i}`} />)}
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            disabled={!onPick || d.status === 'upcoming'}
            onClick={() => onPick?.(d)}
            title={`${d.day} · ${t(ATT_LABEL[d.status] || d.status)}`}
            className={cn('flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-semibold focus-ring', ATT_CELL[d.status] || ATT_CELL.not_marked, onPick && d.status !== 'upcoming' && 'hover:opacity-80')}
          >
            {Number(d.day.slice(8))}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
        {['present', 'late', 'half_day', 'absent', 'leave', 'weekly_off', 'not_marked'].map((s) => (
          <span key={s} className="inline-flex items-center gap-1"><span className={cn('h-2.5 w-2.5 rounded', ATT_CELL[s])} />{t(ATT_LABEL[s])}</span>
        ))}
      </div>
    </div>
  );
}

export function Stat({ label, value, tone = 'slate' }) {
  const tones = { slate: 'text-slate-900', green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700', blue: 'text-blue-700', brand: 'text-brand-700' };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('tabular mt-0.5 text-lg font-semibold', tones[tone])}>{value}</p>
    </div>
  );
}

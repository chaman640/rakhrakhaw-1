import { useState } from 'react';
import { Users2, Target, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useFeature } from '@/hooks/useBilling';
import { formatMoney } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Modal, Chips, EmptyState, Spinner, useToast,
} from '@/components/ui';
import { UpgradeCard } from '@/components/billing/FeatureGate';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);
const thisMonth = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 7);

function Targets() {
  const toast = useToast();
  const [period, setPeriod] = useState(thisMonth());
  const [edit, setEdit] = useState(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const { data, loading } = useQuery(['crm', 'targets', period], () => api.get('/crm/targets', { params: { period } }).then((r) => r.data), { onError: (e) => toast.error(e.message) });
  async function save() {
    setSaving(true);
    try { await api.put(`/crm/targets/${edit.userId}`, { amount: Number(amount || 0) }); toast.success(t('Target saved')); bust('crm', 'hr'); setEdit(null); } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Target size={16} className="text-brand-700" />{t('Monthly sales target')}</span>}
        subtitle={t('Sales of customers assigned to each salesman, plus bills they made')}
        action={<input type="month" aria-label={t('Month')} value={period} max={thisMonth()} onChange={(e) => setPeriod(e.target.value || thisMonth())} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />} />
      {loading && !data ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <>
          {data?.total?.target > 0 && (
            <p className="mb-3 text-sm text-slate-600">{t('Team')}: <b className="tabular-nums">{formatMoney(data.total.achieved)}</b> / {formatMoney(data.total.target)} · {pct(data.total.pct)}</p>
          )}
          <ul className="space-y-3">
            {(data?.rows || []).map((r) => (
              <li key={r.userId}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">{r.name}</span>
                  <span className="flex items-center gap-2 tabular-nums text-slate-600">
                    {formatMoney(r.achieved)}{r.target > 0 && <> / {formatMoney(r.target)} · <b className={cn(r.pct >= 100 ? 'text-emerald-700' : 'text-slate-900')}>{pct(r.pct)}</b></>}
                    <button type="button" aria-label={t('Set target')} onClick={() => { setEdit(r); setAmount(String(r.target || '')); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-700"><Pencil size={13} /></button>
                  </span>
                </div>
                {r.target > 0 && <div className="mt-1 h-2 rounded-full bg-slate-100"><div className={cn('h-2 rounded-full', r.pct >= 100 ? 'bg-emerald-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, r.pct || 0)}%` }} /></div>}
              </li>
            ))}
          </ul>
        </>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={t('Target for {n}', { n: edit?.name || '' })}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('Cancel')}</Button><Button loading={saving} onClick={save}>{t('Save')}</Button></>}>
        <Input label={t('Monthly target')} type="number" prefix="₹" value={amount} onChange={(e) => setAmount(e.target.value)} hint={t('Same target is used in HR performance')} />
      </Modal>
    </Card>
  );
}

export default function TeamPerf() {
  const { allowed, lockedInfo } = useFeature('crm_assign');
  const smart = useFeature('crm_smart').allowed;
  const [days, setDays] = useState(30);
  const { data, loading, error } = useQuery(['crm', 'performance', days], () => api.get('/crm/performance', { params: { days } }).then((r) => r.data), { enabled: allowed });
  if (!allowed) return <UpgradeCard info={lockedInfo} />;
  if (error && !data) return <EmptyState icon={Users2} title={error.message} />;
  return (
    <div className="space-y-4">
      <Chips value={days} onChange={setDays} options={[7, 30, 90, 365].map((d) => ({ value: d, label: t('{n} days', { n: d }) }))} />
      <Card className="overflow-x-auto" padding={false}>
        {loading && !data ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">{t('Salesman')}</th><th className="text-right">{t('Leads')}</th><th className="text-right">{t('Contacted')}</th><th className="text-right">{t('Converted')}</th>
                <th className="text-right">{t('Conversion')}</th>{data?.smart && <th className="text-right">{t('Sales')}</th>}<th className="text-right">{t('Follow-ups done')}</th><th className="text-right">{t('On time')}</th><th className="px-4 text-right">{t('Complaints solved')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows || []).map((s) => (
                <tr key={s.userId} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium text-slate-900">{s.name}<span className="block text-xs font-normal text-slate-500">{s.staffRole}</span></td>
                  <td className="text-right tabular-nums">{s.leads}</td><td className="text-right tabular-nums">{s.contacted}</td><td className="text-right tabular-nums">{s.converted}</td>
                  <td className="text-right">{pct(s.conversionPct)}</td>
                  {data.smart && <td className="text-right tabular-nums">{formatMoney(s.sales || 0)}</td>}
                  <td className={cn('text-right', s.followUpPct !== null && s.followUpPct < 60 && 'font-semibold text-red-600')}>{s.followUpsDue ? `${s.followUpsDone}/${s.followUpsDue} · ${pct(s.followUpPct)}` : '—'}</td>
                  <td className="text-right">{pct(s.onTimePct)}</td>
                  <td className="px-4 text-right">{s.complaints ? `${s.complaintsResolved}/${s.complaints}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {smart && <Targets />}
    </div>
  );
}

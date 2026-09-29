import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, CalendarDays, Clock, LifeBuoy } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { formatDateTime } from '@/lib/format';
import {
  Card, Button, Badge, Input, Select, Textarea, Modal, Chips, Switch, Spinner, EmptyState, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { REQ_TONE, Cap, Stat, todayIst } from '@/pages/wholesaler/hr/hrShared';
import { requestTitle, requestWhen, Thread } from '@/pages/wholesaler/hr/RequestsTab';

const TITLES = { leave: 'Apply for leave', correction: 'Attendance correction', help: 'Ask HR' };

export function RequestForm({ open, kind, day = '', onClose }) {
  const toast = useToast();
  const { data: balances } = useQuery(['emp', 'balances'], () => api.get('/hr/me/leave-balances').then((r) => r.data), { enabled: open && kind === 'leave', poll: false });
  const blank = { leaveType: '', from: todayIst(), to: todayIst(), halfDay: false, day: day || todayIst(), wantStatus: 'present', category: 'other', subject: '', reason: '' };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setF({ ...blank, day: day || todayIst() }); }, [open, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const types = balances || [];
  const leaveType = f.leaveType || types[0]?.name || '';
  const chosen = types.find((b) => b.name === leaveType);

  async function save() {
    const body = kind === 'leave' ? { kind, leaveType, from: f.from, to: f.halfDay ? f.from : f.to, halfDay: f.halfDay, reason: f.reason }
      : kind === 'correction' ? { kind, day: f.day, wantStatus: f.wantStatus, reason: f.reason }
        : { kind, category: f.category, subject: f.subject, reason: f.reason };
    setSaving(true);
    try {
      const res = await api.post('/hr/me/requests', body);
      toast.success(res.message);
      bust('emp');
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t(TITLES[kind])}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} onClick={save}>{t('Submit')}</Button></>}>
      <div className="space-y-3">
        {kind === 'leave' && (
          <>
            <Select label={t('Leave type')} value={leaveType} onChange={set('leaveType')}
              options={types.map((b) => ({ value: b.name, label: b.quota ? `${b.name} — ${b.left} ${t('left')}` : b.name }))} />
            {chosen && !chosen.paid && <p className="text-xs text-amber-700">{t('Unpaid leave — salary will be deducted for these days.')}</p>}
            <Switch id="half" label={t('Half day')} checked={f.halfDay} onChange={set('halfDay')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={f.halfDay ? t('Date') : t('From')} type="date" value={f.from}
                onChange={(e) => setF({ ...f, from: e.target.value, to: f.to < e.target.value ? e.target.value : f.to })} />
              {!f.halfDay && <Input label={t('To')} type="date" min={f.from} value={f.to} onChange={set('to')} />}
            </div>
          </>
        )}
        {kind === 'correction' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('Date')} type="date" max={todayIst()} value={f.day} onChange={set('day')} />
            <Select label={t('Mark me as')} value={f.wantStatus} onChange={set('wantStatus')}
              options={[{ value: 'present', label: t('Present') }, { value: 'late', label: t('Late') }, { value: 'half_day', label: t('Half day') }]} />
          </div>
        )}
        {kind === 'help' && (
          <>
            <Select label={t('Topic')} value={f.category} onChange={set('category')}
              options={['salary', 'attendance', 'leave', 'document', 'other'].map((c) => ({ value: c, label: Cap(c) }))} />
            <Input label={t('Subject')} value={f.subject} onChange={set('subject')} />
          </>
        )}
        <Textarea label={kind === 'help' ? t('Details') : t('Reason')} rows={3} value={f.reason} onChange={set('reason')} />
      </div>
    </Modal>
  );
}

export default function EmpRequests() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState('leave');
  const [form, setForm] = useState(params.get('new') || null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading } = useQuery(['emp', 'requests', kind], () => api.get('/hr/me/requests', { params: { kind } }).then((r) => r.data));
  const { data: balances } = useQuery(['emp', 'balances'], () => api.get('/hr/me/leave-balances').then((r) => r.data));
  const Icon = { leave: CalendarDays, correction: Clock, help: LifeBuoy }[kind];

  async function cancel(r) {
    if (!window.confirm(t('Cancel this request?'))) return;
    try { const res = await api.post(`/hr/me/requests/${r._id}/cancel`); toast.success(res.message); bust('emp'); setOpen(null); } catch (err) { toast.error(err.message); }
  }
  async function reply(text) {
    setBusy(true);
    try { const res = await api.post(`/hr/me/requests/${open._id}/messages`, { text }); setOpen(res.data); bust('emp'); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  const canCancel = (r) => r.status === 'pending' || (r.kind === 'leave' && r.status === 'approved' && r.from > todayIst());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t('Leave & requests')}</h1>
        <Button size="sm" icon={Plus} onClick={() => setForm(kind)}>{t('New')}</Button>
      </div>
      {kind === 'leave' && balances?.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {balances.map((b) => <Stat key={b.name} label={b.name} value={b.quota ? `${b.left} / ${b.quota}` : t('{n} taken', { n: b.taken })} tone={b.paid ? 'blue' : 'slate'} />)}
        </div>
      )}
      <Chips value={kind} onChange={setKind} options={[{ value: 'leave', label: 'Leave' }, { value: 'correction', label: 'Corrections' }, { value: 'help', label: 'Help desk' }]} />
      {loading && !data ? <div className="flex justify-center py-10"><Spinner /></div> : !data?.length ? (
        <EmptyState icon={Icon} title={t('Nothing here yet')} message={kind === 'help' ? t('Ask HR about salary, documents or anything else.') : t('Your requests and their status appear here.')} />
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-slate-100">
            {data.map((r) => (
              <li key={r._id}>
                <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{requestTitle(r)}</span>
                    <span className="block truncate text-xs text-slate-500">{requestWhen(r)} · {formatDateTime(r.createdAt)}</span>
                  </span>
                  <Badge tone={REQ_TONE[r.status]}>{Cap(r.status)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <RequestForm open={Boolean(form)} kind={form || kind} onClose={() => { setForm(null); if (params.get('new')) setParams({}, { replace: true }); }} />
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? requestTitle(open) : ''} description={open ? requestWhen(open) : ''}
        footer={open && canCancel(open) && <Button variant="danger" onClick={() => cancel(open)}>{t('Cancel request')}</Button>}>
        {open && (
          <div className="space-y-3 text-sm">
            <Badge tone={REQ_TONE[open.status]}>{Cap(open.status)}</Badge>
            {open.reason && <p className="text-slate-700">{open.reason}</p>}
            {open.reviewNote && open.kind !== 'help' && <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{t('HR note')}: {open.reviewNote}</p>}
            {open.kind === 'help' && <Thread req={open} onSend={reply} busy={busy} />}
          </div>
        )}
      </Modal>
    </div>
  );
}

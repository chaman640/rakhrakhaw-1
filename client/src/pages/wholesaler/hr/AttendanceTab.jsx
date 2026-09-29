import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Camera } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { useFeature } from '@/hooks/useBilling';
import {
  Card, Button, Input, Select, Modal, Table, Chips, Textarea, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import {
  Avatar, AttBadge, ATT_LABEL, Stat, MonthPicker, thisPeriod, todayIst, timeOf, hoursOf, hhmm,
} from './hrShared';

const MARKABLE = ['present', 'late', 'half_day', 'absent', 'leave', 'holiday', 'weekly_off'];

export function MarkModal({ target, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!target) return null;
  const form = f || {
    status: ['not_marked', 'not_tracked', 'upcoming'].includes(target.status) ? 'present' : target.status,
    checkInTime: hhmm(target.checkIn?.at),
    checkOutTime: hhmm(target.checkOut?.at), note: target.note || '',
  };
  const set = (k) => (e) => setF({ ...form, [k]: e.target.value });
  const timed = ['present', 'late', 'half_day'].includes(form.status);

  async function save() {
    setSaving(true);
    try {
      const res = await api.post('/hr/attendance', {
        userId: target.userId, day: target.day, status: form.status, note: form.note,
        checkInTime: timed ? form.checkInTime : '', checkOutTime: timed ? form.checkOutTime : '',
      });
      toast.success(res.message);
      bust('hr');
      setF(null);
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={() => { setF(null); onClose(); }} title={t('Mark attendance')} description={`${target.name || ''} · ${target.day}`}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} onClick={save}>{t('Save')}</Button></>}>
      <div className="space-y-3">
        <Select label={t('Status')} value={form.status} onChange={set('status')} options={MARKABLE.map((s) => ({ value: s, label: ATT_LABEL[s] }))} />
        {timed && (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('Check-in time')} type="time" value={form.checkInTime} onChange={set('checkInTime')} />
            <Input label={t('Check-out time')} type="time" value={form.checkOutTime} onChange={set('checkOutTime')} />
          </div>
        )}
        <Textarea label={t('Note (optional)')} rows={2} value={form.note} onChange={set('note')} />
        <p className="text-xs text-slate-500">{t('Every change is recorded in the HR log.')}</p>
      </div>
    </Modal>
  );
}

function DayBoard() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [day, setDay] = useState(todayIst());
  const [filter, setFilter] = useState('');
  const [marking, setMarking] = useState(null);
  const { data, loading } = useQuery(['hr', 'attendance', day], () => api.get('/hr/attendance', { params: { day } }).then((r) => r.data));
  const s = data?.summary || {};
  const rows = (data?.rows || []).filter((r) => !filter || r.status === filter || (filter === 'present' && r.status === 'late'));
  const loc = (p) => (p?.lat != null ? (
    <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-700" aria-label={t('View location')}><MapPin size={13} /></a>
  ) : null);
  const pic = (p) => (p?.photoUrl ? (
    <a href={p.photoUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-700" aria-label={t('View selfie')}><Camera size={13} /></a>
  ) : null);

  const columns = [
    {
      key: 'name', header: t('Employee'),
      render: (r) => (
        <span className="flex items-center gap-3">
          <Avatar name={r.name} url={r.photoUrl} size={32} />
          <span><span className="block font-medium text-slate-900">{r.name}</span><span className="block text-xs text-slate-500">{r.code}</span></span>
        </span>
      ),
    },
    { key: 'status', header: t('Status'), render: (r) => <AttBadge status={r.status} /> },
    { key: 'in', header: t('Check-in'), render: (r) => <span className="inline-flex items-center gap-1.5">{timeOf(r.checkIn?.at)}{loc(r.checkIn)}{pic(r.checkIn)}</span> },
    { key: 'out', header: t('Check-out'), render: (r) => <span className="inline-flex items-center gap-1.5">{timeOf(r.checkOut?.at)}{loc(r.checkOut)}{pic(r.checkOut)}</span> },
    { key: 'hours', header: t('Worked'), render: (r) => hoursOf(r.workMinutes) },
    ...(can('hr:edit') ? [{ key: 'actions', header: '', render: (r) => <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setMarking({ ...r, day }); }}>{t('Mark')}</Button> }] : []),
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-44"><Input type="date" value={day} max={todayIst()} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label={t('Date')} /></div>
        {data?.weeklyOff && <span className="text-sm text-slate-500">{t('Weekly off day')}</span>}
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label={t('Total')} value={s.total ?? '—'} />
        <Stat label={t('Present')} value={(s.present || 0) + (s.late || 0)} tone="green" />
        <Stat label={t('Late')} value={s.late || 0} tone="amber" />
        <Stat label={t('Half day')} value={s.half_day || 0} tone="amber" />
        <Stat label={t('On leave')} value={s.leave || 0} tone="blue" />
        <Stat label={t('Not marked')} value={(s.not_marked || 0) + (s.absent || 0)} tone="red" />
      </div>
      <Chips className="mb-3" value={filter} onChange={setFilter} options={[
        { value: '', label: 'All' }, { value: 'present', label: 'Present' }, { value: 'late', label: 'Late' },
        { value: 'not_marked', label: 'Not marked' }, { value: 'absent', label: 'Absent' }, { value: 'leave', label: 'On leave' },
      ]} />
      <Table columns={columns} rows={rows} rowKey={(r) => r.userId} loading={loading && !data}
        onRowClick={(r) => navigate(`/hr/employees/${r.userId}?tab=attendance`)}
        emptyTitle={t('No employees to show')} />
      <MarkModal target={marking} onClose={() => setMarking(null)} />
    </>
  );
}

function MonthReport() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState(thisPeriod());
  const { data, loading } = useQuery(['hr', 'att-report', period], () => api.get('/hr/attendance/report', { params: { period } }).then((r) => r.data));
  const columns = [
    { key: 'name', header: t('Employee'), render: (r) => <span><span className="block font-medium text-slate-900">{r.name}</span><span className="block text-xs text-slate-500">{r.code}</span></span> },
    { key: 'present', header: t('Present'), align: 'right', render: (r) => r.present + r.late },
    { key: 'late', header: t('Late'), align: 'right' },
    { key: 'half_day', header: t('Half day'), align: 'right' },
    { key: 'absent', header: t('Absent'), align: 'right' },
    { key: 'leave', header: t('Leave'), align: 'right' },
    { key: 'hours', header: t('Hours'), align: 'right', render: (r) => Math.round(r.workMinutes / 60) },
  ];
  return (
    <>
      <div className="mb-4"><MonthPicker value={period} onChange={setPeriod} /></div>
      <Table columns={columns} rows={data || []} rowKey={(r) => r.userId} loading={loading && !data}
        onRowClick={(r) => navigate(`/hr/employees/${r.userId}?tab=attendance`)} emptyTitle={t('No attendance this month')} />
    </>
  );
}

export default function AttendanceTab() {
  const [view, setView] = useState('day');
  const report = useFeature('hr_teams').allowed;
  return (
    <Card>
      {report && <Chips className="mb-4" value={view} onChange={setView} options={[{ value: 'day', label: 'Daily' }, { value: 'month', label: 'Monthly report' }]} />}
      {view === 'month' && report ? <MonthReport /> : <DayBoard />}
    </Card>
  );
}

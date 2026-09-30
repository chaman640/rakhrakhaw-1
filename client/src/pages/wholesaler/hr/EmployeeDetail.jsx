import { useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Pencil, Phone, Camera, UserX, UserCheck, KeyRound, Share2,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatDateTime, formatMoney, formatPhone } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Tabs, Spinner, EmptyState, Modal, Input, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { shrinkImage } from '@/lib/shrinkImage';
import {
  Avatar, MonthGrid, MonthPicker, Stat, thisPeriod, periodLabel, PAY_TONE, Cap, EMP_TYPES, hoursOf, useHrMeta,
} from './hrShared';
import { EmployeeForm } from './Employees';
import { MarkModal } from './AttendanceTab';
import RequestsTab from './RequestsTab';
import { PayslipBody, printPayslip } from './Payslip';

const Field = ({ label, value }) => (
  <div className="py-2"><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium text-slate-900">{value || '—'}</p></div>
);

function LoginCard({ e, initialPassword }) {
  const toast = useToast();
  const { can, user } = useAuth();
  const { data: meta } = useHrMeta();
  const [pw, setPw] = useState(initialPassword || '');
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const company = meta?.companyCode || '';
  const link = `${window.location.origin}/login?c=${company}&e=${encodeURIComponent(e.code)}`;
  const text = [
    t('Hello {n}, your {b} employee app login:', { n: e.name.split(' ')[0], b: meta?.businessName || '' }),
    `${t('Company code')}: ${company}`, `${t('Employee ID')}: ${e.code}`, `${t('Mobile')}: ${e.phone}`,
    pw ? `${t('Temporary password')}: ${pw}` : null, pw ? t('You will be asked to set your own password.') : null, link,
  ].filter(Boolean).join('\n');
  const wa = `https://wa.me/91${String(e.phone || '').replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(text)}`;

  async function reset() {
    if (next.length < 6) { toast.error(t('Password must be at least 6 characters')); return; }
    setBusy(true);
    try {
      const r = await api.post(`/hr/employees/${e._id}/password`, { password: next });
      toast.success(r.message); setPw(next); setNext(''); setOpen(false);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  const self = String(user?._id) === String(e._id);
  return (
    <Card>
      <CardHeader title={t('App login')} subtitle={e.loginActive === false ? t('Login is disabled') : t('The employee signs in with these details')} />
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('Company code')} value={company} />
        <Field label={t('Employee ID')} value={e.code} />
        <Field label={t('Mobile')} value={formatPhone(e.phone)} />
        <Field label={t('Last login')} value={e.lastLoginAt ? formatDateTime(e.lastLoginAt) : t('Never')} />
      </div>
      {pw && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('Temporary password')}: <b className="font-mono">{pw}</b> — {t('share it now, it is not shown again')}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {e.phone && <a href={wa} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary" icon={Share2}>{t('Share on WhatsApp')}</Button></a>}
        {can('hr:edit') && !self && e.staffRole !== 'owner' && <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setOpen(true)}>{t('Reset password')}</Button>}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t('Reset login password')} description={t('They will be signed out and must set their own password at next sign-in.')}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('Cancel')}</Button><Button loading={busy} onClick={reset}>{t('Set temporary password')}</Button></>}>
        <Input label={t('Temporary password')} value={next} onChange={(x) => setNext(x.target.value)} hint={t('At least 6 characters')} autoComplete="off" />
      </Modal>
    </Card>
  );
}

function ProfileTab({ e, tempPassword }) {
  const { can } = useAuth();
  const type = EMP_TYPES.find(([v]) => v === e.employmentType)?.[1];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title={t('Job')} />
        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t('Employee code')} value={e.code} />
          <Field label={t('App role')} value={e.staffRoleLabel} />
          <Field label={t('Department')} value={e.department} />
          <Field label={t('Designation')} value={e.designation} />
          <Field label={t('Reports to')} value={e.reportingManagerName} />
          <Field label={t('Employment type')} value={type && t(type)} />
          <Field label={t('Joining date')} value={formatDate(e.joiningDate)} />
          <Field label={t('Teams')} value={e.teams?.map((x) => x.name).join(', ')} />
          <Field label={t('Last login')} value={e.lastLoginAt ? formatDateTime(e.lastLoginAt) : t('Never')} />
          {e.leftAt && <Field label={t('Left on')} value={formatDate(e.leftAt)} />}
        </div>
      </Card>
      {can('payroll:view') && e.salary && (
        <Card>
          <CardHeader title={t('Salary')} />
          <div className="grid grid-cols-2 gap-x-4">
            <Field label={e.salary.type === 'daily' ? t('Rate per day') : t('Basic per month')} value={e.salary.basic ? formatMoney(e.salary.basic) : t('Not set')} />
            <Field label={t('Allowances per month')} value={formatMoney(e.salary.allowances || 0)} />
            <Field label={t('Sales commission %')} value={`${e.salary.commissionPct || 0}%`} />
            <Field label={t('Monthly sales target')} value={e.salary.monthlyTarget ? formatMoney(e.salary.monthlyTarget) : '—'} />
            <Field label={t('Effective from')} value={formatDate(e.salary.effectiveFrom)} />
          </div>
        </Card>
      )}
      <Card>
        <CardHeader title={t('Personal')} />
        <div className="grid grid-cols-2 gap-x-4">
          <Field label={t('Phone')} value={formatPhone(e.phone)} />
          <Field label={t('Email')} value={e.email} />
          <Field label={t('Date of birth')} value={e.dob && formatDate(e.dob)} />
          <Field label={t('Gender')} value={e.gender && Cap(e.gender)} />
          <div className="col-span-2"><Field label={t('Address')} value={e.address} /></div>
          <Field label={t('Emergency contact')} value={e.emergencyContact?.name && `${e.emergencyContact.name} · ${e.emergencyContact.phone}`} />
        </div>
      </Card>
      <LoginCard e={e} initialPassword={tempPassword} />
      <Card>
        <CardHeader title={t('Tasks')} />
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t('Open')} value={(e.tasks?.pending || 0) + (e.tasks?.in_progress || 0)} tone="amber" />
          <Stat label={t('Done')} value={e.tasks?.done || 0} tone="green" />
          <Stat label={t('Requests')} value={e.requests?.filter((r) => r.status === 'pending').length || 0} />
        </div>
      </Card>
    </div>
  );
}

function AttendanceView({ e }) {
  const { can } = useAuth();
  const [period, setPeriod] = useState(thisPeriod());
  const [marking, setMarking] = useState(null);
  const { data } = useQuery(['hr', 'emp-att', e._id, period], () => api.get(`/hr/employees/${e._id}/attendance`, { params: { period } }).then((r) => r.data));
  const s = data?.summary || {};
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <MonthPicker value={period} onChange={setPeriod} />
          {can('hr:edit') && <span className="text-xs text-slate-500">{t('Tap a day to mark or correct')}</span>}
        </div>
        {data ? <MonthGrid days={data.days} onPick={can('hr:edit') ? (d) => setMarking({ ...d, userId: e._id, name: e.name }) : null} /> : <Spinner />}
      </Card>
      <div className="grid grid-cols-2 content-start gap-2">
        <Stat label={t('Present')} value={(s.present || 0) + (s.late || 0)} tone="green" />
        <Stat label={t('Late')} value={s.late || 0} tone="amber" />
        <Stat label={t('Half day')} value={s.half_day || 0} tone="amber" />
        <Stat label={t('Absent')} value={s.absent || 0} tone="red" />
        <Stat label={t('Leave')} value={s.leave || 0} tone="blue" />
        <Stat label={t('Not marked')} value={s.not_marked || 0} />
        <div className="col-span-2"><Stat label={t('Hours worked')} value={hoursOf(s.workMinutes)} /></div>
      </div>
      <MarkModal target={marking} onClose={() => setMarking(null)} />
    </div>
  );
}

function LeaveView({ e }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {e.leaveBalances?.map((b) => (
          <Stat key={b.name} label={b.name} value={b.quota ? `${b.left} ${t('left')}` : `${b.taken} ${t('taken')}`} tone={b.paid ? 'blue' : 'slate'} />
        ))}
      </div>
      <RequestsTab userId={e._id} />
    </div>
  );
}

function SalaryView({ e }) {
  const toast = useToast();
  const [open, setOpen] = useState(null);
  if (!e.payrolls?.length) return <EmptyState title={t('No payroll yet')} message={t('Payroll appears here once generated from the Payroll tab.')} />;
  const openSlip = async (p) => { try { setOpen((await api.get(`/hr/payroll/${p._id}/payslip`)).data); } catch (err) { toast.error(err.message); } };
  return (
    <Card padding={false}>
      <ul className="divide-y divide-slate-100">
        {e.payrolls.map((p) => (
          <li key={p._id}>
            <button type="button" onClick={() => openSlip(p)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50">
              <span><span className="block text-sm font-medium text-slate-900">{periodLabel(p.period)}</span><span className="block text-xs text-slate-500">{p.payrollNo}</span></span>
              <span className="flex items-center gap-3"><span className="tabular text-sm font-semibold">{formatMoney(p.net)}</span><Badge tone={PAY_TONE[p.status]}>{Cap(p.status)}</Badge></span>
            </button>
          </li>
        ))}
      </ul>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? periodLabel(open.period) : ''} description={open?.payrollNo}>
        {open && <PayslipBody p={open} onPrint={() => printPayslip(open)} />}
      </Modal>
    </Card>
  );
}

function LogView({ e }) {
  if (!e.logs?.length) return <EmptyState title={t('No changes recorded yet')} />;
  return (
    <Card padding={false}>
      <ul className="divide-y divide-slate-100">
        {e.logs.map((l) => (
          <li key={l._id} className="px-5 py-3">
            <p className="text-sm text-slate-900">{l.summary}</p>
            <p className="text-xs text-slate-500">{l.byName} · {formatDateTime(l.createdAt)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { can, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const fileRef = useRef(null);
  const { data: e, loading, error } = useQuery(['hr', 'employee', id], () => api.get(`/hr/employees/${id}`).then((r) => r.data));
  const tab = params.get('tab') || 'profile';

  if (loading && !e) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;
  if (!e) return <EmptyState title={t('Employee not found')} message={error?.message} action={<Button variant="secondary" onClick={() => navigate('/hr')}>{t('Back to HR')}</Button>} />;

  const tabs = [
    { value: 'profile', label: 'Profile' },
    ...(can('hr:view') ? [{ value: 'attendance', label: 'Attendance' }, { value: 'leave', label: 'Leave & requests' }] : []),
    ...(can('payroll:view') ? [{ value: 'salary', label: 'Salary slips' }] : []),
    ...(can('hr:edit') ? [{ value: 'history', label: 'History' }] : []),
  ];
  const isSelf = String(user?._id) === String(e._id);
  const canStatus = can('hr:edit') && !isSelf && e.staffRole !== 'owner';

  async function setStatus(status) {
    const msg = status === 'left' ? t('Mark {n} as left? Their login will be disabled.', { n: e.name }) : status === 'inactive' ? t('Deactivate {n}? Their login will be disabled.', { n: e.name }) : t('Reactivate {n}?', { n: e.name });
    if (!window.confirm(msg)) return;
    try { const res = await api.put(`/hr/employees/${e._id}`, { status }); toast.success(res.message); bust('hr', 'staff'); } catch (err) { toast.error(err.message); }
  }
  async function upload(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const small = await shrinkImage(file);
      const fd = new FormData();
      fd.append('photo', small);
      const res = await api.post(`/hr/employees/${e._id}/photo`, fd);
      toast.success(res.message); bust('hr');
    } catch (err) { toast.error(err.message); }
  }

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative w-fit">
            <Avatar name={e.name} url={e.photoUrl} size={64} />
            {can('hr:edit') && (
              <>
                <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('Change photo')} className="absolute -bottom-1 -right-1 rounded-full border border-white bg-slate-800 p-1.5 text-white"><Camera size={12} /></button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{e.name}</h1>
              <Badge tone={e.status === 'active' ? 'green' : e.status === 'left' ? 'red' : 'slate'}>{Cap(e.status)}</Badge>
            </div>
            <p className="text-sm text-slate-500">{e.code} · {e.designation || e.staffRoleLabel}{e.department ? ` · ${e.department}` : ''}</p>
            <a href={`tel:${e.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"><Phone size={13} />{formatPhone(e.phone)}</a>
          </div>
          <div className="flex flex-wrap gap-2">
            {(can('hr:edit') || can('payroll:create')) && <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>{t('Edit')}</Button>}
            {canStatus && e.status === 'active' && <Button variant="ghost" icon={UserX} onClick={() => setStatus('inactive')}>{t('Deactivate')}</Button>}
            {canStatus && e.status === 'active' && <Button variant="ghost" onClick={() => setStatus('left')}>{t('Mark as left')}</Button>}
            {canStatus && e.status !== 'active' && <Button variant="secondary" icon={UserCheck} onClick={() => setStatus('active')}>{t('Reactivate')}</Button>}
          </div>
        </div>
      </Card>
      <Tabs tabs={tabs} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} />
      {tab === 'profile' && <ProfileTab e={e} tempPassword={location.state?.tempPassword} />}
      {tab === 'attendance' && <AttendanceView e={e} />}
      {tab === 'leave' && <LeaveView e={e} />}
      {tab === 'salary' && <SalaryView e={e} />}
      {tab === 'history' && <LogView e={e} />}
      <EmployeeForm open={editing} onClose={() => setEditing(false)} employee={e} />
    </>
  );
}

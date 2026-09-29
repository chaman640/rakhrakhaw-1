import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ListTodo, CalendarDays, Wallet, ChevronRight, Target, Plus, AlertTriangle,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatDate } from '@/lib/format';
import {
  Card, CardHeader, Badge, Spinner, EmptyState, Modal, useToast,
} from '@/components/ui';
import { TaskRow } from '@/pages/wholesaler/crm/CrmParts';
import { t } from '@/lib/i18n';
import {
  MonthGrid, MonthPicker, Stat, thisPeriod, periodLabel, PAY_TONE, Cap, hoursOf,
} from '@/pages/wholesaler/hr/hrShared';
import { PayslipBody, printPayslip } from '@/pages/wholesaler/hr/Payslip';
import CheckInCard from './CheckInCard';
import { RequestForm } from './EmpRequests';

const Loading = () => <div className="flex justify-center py-16"><Spinner size={26} /></div>;
export const useEmpHome = () => useQuery(['emp', 'home'], () => api.get('/hr/me').then((r) => r.data));

function Shortcut({ to, icon: Icon, label, value, tone = 'slate' }) {
  const tones = { slate: 'bg-slate-100 text-slate-600', amber: 'bg-amber-50 text-amber-700', brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700' };
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 focus-ring">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block text-xs text-slate-500">{label}</span><span className="block truncate text-sm font-semibold text-slate-900">{value}</span></span>
    </Link>
  );
}

export function EmpHome() {
  const { user } = useAuth();
  const { data, loading } = useEmpHome();
  const [asking, setAsking] = useState(false);
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const m = data.month || {};
  const perf = data.performance;
  const leaveLeft = data.leaveBalances?.filter((b) => b.quota).reduce((s, b) => s + b.left, 0);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-semibold text-slate-900">{t(hello)}, {user?.name?.split(' ')[0]}</p>
        <p className="text-sm text-slate-500">{[data.profile?.designation, data.profile?.department, data.profile?.code].filter(Boolean).join(' · ')}</p>
      </div>
      <CheckInCard today={data.today} rules={data.rules} />
      <div className="grid grid-cols-2 gap-2">
        <Shortcut to="/emp/tasks" icon={ListTodo} label={t('Open tasks')} value={data.openTasks} tone={data.openTasks ? 'amber' : 'green'} />
        <Shortcut to="/emp/more/requests" icon={CalendarDays} label={t('Leave balance')} value={leaveLeft != null ? t('{n} days', { n: leaveLeft }) : '—'} tone="brand" />
        <Shortcut to="/emp/attendance" icon={CalendarDays} label={t('This month')} value={t('{n} days present', { n: (m.present || 0) + (m.late || 0) + (m.half_day || 0) / 2 })} />
        <Shortcut to="/emp/salary" icon={Wallet} label={t('Last salary')} value={data.lastPayslip ? formatMoney(data.lastPayslip.net) : '—'} tone="green" />
      </div>
      {perf?.sales != null && perf.target > 0 && (
        <Card>
          <div className="mb-2 flex items-center gap-2"><Target size={16} className="text-brand-700" /><p className="font-semibold text-slate-900">{t('My target')}</p></div>
          <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">{formatMoney(perf.sales)} / {formatMoney(perf.target)}</span><span className="font-semibold">{perf.achievedPct}%</span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, perf.achievedPct)}%` }} /></div>
        </Card>
      )}
      <button type="button" onClick={() => setAsking(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-ring">
        <Plus size={16} />{t('Apply for leave')}
      </button>
      {data.pendingRequests > 0 && <p className="text-center text-xs text-slate-500">{t('{n} request(s) waiting for approval', { n: data.pendingRequests })}</p>}
      <RequestForm open={asking} kind="leave" onClose={() => setAsking(false)} />
    </div>
  );
}

export function EmpTasks() {
  const { data, loading } = useQuery(['emp', 'tasks'], () => api.get('/hr/me/tasks').then((r) => r.data));
  if (loading && !data) return <Loading />;
  const groups = [
    ['Overdue', data?.overdue, 'text-red-600'], ['Today', data?.today, 'text-slate-900'],
    ['Next 7 days', data?.upcoming, 'text-slate-900'], ['No due date', data?.noDate, 'text-slate-900'],
  ].filter(([, rows]) => rows?.length);
  const onChanged = () => bust('emp');
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t('My tasks')}</h1>
        {data?.doneToday > 0 && <span className="text-xs text-emerald-700">{t('{n} done today', { n: data.doneToday })}</span>}
      </div>
      {!groups.length ? <EmptyState icon={ListTodo} title={t('No pending tasks')} message={t('Tasks assigned to you will appear here.')} /> : groups.map(([label, rows, cls]) => (
        <Card key={label}>
          <p className={`mb-1 flex items-center gap-1.5 text-sm font-semibold ${cls}`}>{label === 'Overdue' && <AlertTriangle size={14} />}{t(label)} ({rows.length})</p>
          <ul className="divide-y divide-slate-100">{rows.map((task) => <TaskRow key={task._id} task={task} onChanged={onChanged} taskPath="/hr/me/tasks" />)}</ul>
        </Card>
      ))}
    </div>
  );
}

export function EmpAttendance() {
  const [period, setPeriod] = useState(thisPeriod());
  const [asking, setAsking] = useState(null);
  const { data: home } = useEmpHome();
  const { data } = useQuery(['emp', 'attendance', period], () => api.get('/hr/me/attendance', { params: { period } }).then((r) => r.data));
  const s = data?.summary || {};
  return (
    <div className="space-y-4">
      {period === thisPeriod() && home && <CheckInCard today={home.today} rules={home.rules} />}
      <Card>
        <div className="mb-4 flex justify-center"><MonthPicker value={period} onChange={setPeriod} /></div>
        {data ? <MonthGrid days={data.days} onPick={(d) => ['not_marked', 'absent', 'half_day', 'late'].includes(d.status) && setAsking(d.day)} /> : <Spinner />}
        <p className="mt-3 text-xs text-slate-500">{t('Missed a check-in? Tap the day to request a correction.')}</p>
      </Card>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t('Present')} value={(s.present || 0) + (s.late || 0)} tone="green" />
        <Stat label={t('Late')} value={s.late || 0} tone="amber" />
        <Stat label={t('Leave')} value={s.leave || 0} tone="blue" />
        <Stat label={t('Half day')} value={s.half_day || 0} tone="amber" />
        <Stat label={t('Absent')} value={(s.absent || 0) + (s.not_marked || 0)} tone="red" />
        <Stat label={t('Hours')} value={hoursOf(s.workMinutes)} />
      </div>
      <RequestForm open={Boolean(asking)} kind="correction" day={asking} onClose={() => setAsking(null)} />
    </div>
  );
}

export function EmpSalary() {
  const toast = useToast();
  const { data, loading } = useQuery(['emp', 'payslips'], () => api.get('/hr/me/payslips').then((r) => r.data));
  const { data: profile } = useQuery(['emp', 'profile'], () => api.get('/hr/me/profile').then((r) => r.data), { poll: false });
  const [open, setOpen] = useState(null);
  const openSlip = async (p) => { try { setOpen((await api.get(`/hr/me/payslips/${p._id}`)).data); } catch (err) { toast.error(err.message); } };
  const sal = profile?.salary;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{t('Salary')}</h1>
      {sal?.basic > 0 && (
        <Card>
          <CardHeader title={t('My salary structure')} />
          <div className="grid grid-cols-2 gap-2">
            <Stat label={sal.type === 'daily' ? t('Rate per day') : t('Basic per month')} value={formatMoney(sal.basic)} />
            <Stat label={t('Allowances')} value={formatMoney(sal.allowances || 0)} />
            {sal.commissionPct > 0 && <Stat label={t('Commission')} value={`${sal.commissionPct}%`} />}
            {sal.monthlyTarget > 0 && <Stat label={t('Monthly target')} value={formatMoney(sal.monthlyTarget)} />}
          </div>
        </Card>
      )}
      <Card padding={false}>
        <p className="px-5 pt-4 font-semibold text-slate-900">{t('Payslips')}</p>
        {loading && !data ? <Loading /> : !data?.length ? <p className="px-5 py-6 text-sm text-slate-400">{t('No payslips yet')}</p> : (
          <ul className="divide-y divide-slate-100">
            {data.map((p) => (
              <li key={p._id}>
                <button type="button" onClick={() => openSlip(p)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50">
                  <span><span className="block text-sm font-medium text-slate-900">{periodLabel(p.period)}</span><span className="block text-xs text-slate-500">{p.paidAt ? t('Paid on {d}', { d: formatDate(p.paidAt) }) : p.payrollNo}</span></span>
                  <span className="flex items-center gap-2"><span className="tabular text-sm font-semibold">{formatMoney(p.net)}</span><Badge tone={PAY_TONE[p.status]}>{Cap(p.status)}</Badge><ChevronRight size={15} className="text-slate-300" /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Link to="/emp/more/requests?new=help" className="block text-center text-sm font-medium text-brand-700 hover:underline">{t('Question about salary? Ask HR')}</Link>
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open ? periodLabel(open.period) : ''} description={open?.payrollNo}>
        {open && <PayslipBody p={open} onPrint={() => printPayslip(open)} />}
      </Modal>
    </div>
  );
}

export function EmpPerformance() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState(thisPeriod());
  const { data, loading } = useQuery(['emp', 'performance', period], () => api.get('/hr/me/performance', { params: { period } }).then((r) => r.data));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{t('Performance')}</h1>
        <MonthPicker value={period} onChange={setPeriod} />
      </div>
      {loading && !data ? <Loading /> : !data ? <EmptyState title={t('No data for this month')} /> : (
        <>
          {data.sales != null && (
            <Card>
              <CardHeader title={t('Sales')} />
              <p className="tabular text-2xl font-semibold text-slate-900">{formatMoney(data.sales)}</p>
              {data.target > 0 && <>
                <p className="mb-1 mt-1 text-xs text-slate-500">{t('{p}% of {x} target', { p: data.achievedPct, x: formatMoney(data.target) })}</p>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, data.achievedPct)}%` }} /></div>
              </>}
            </Card>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('Tasks done')} value={`${data.tasks.done}/${data.tasks.total}`} tone="green" />
            <Stat label={t('Overdue')} value={data.tasks.overdue} tone={data.tasks.overdue ? 'red' : 'slate'} />
            <Stat label={t('Attendance')} value={data.attendance.pct != null ? `${data.attendance.pct}%` : '—'} tone="brand" />
          </div>
        </>
      )}
      <button type="button" onClick={() => navigate(-1)} className="w-full text-center text-sm text-slate-500">{t('Back')}</button>
    </div>
  );
}

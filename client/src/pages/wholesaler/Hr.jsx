import { useNavigate } from 'react-router-dom';
import {
  Users, UserCheck, Clock, CalendarDays, Cake, Award, FileWarning, Wallet,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { useFeature } from '@/hooks/useBilling';
import { useSessionState } from '@/hooks/useSessionState';
import { formatMoney, formatDate } from '@/lib/format';
import {
  Card, CardHeader, StatCard, PageHeader, Tabs, Spinner,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import Employees from './hr/Employees';
import AttendanceTab from './hr/AttendanceTab';
import RequestsTab from './hr/RequestsTab';
import PayrollTab from './hr/PayrollTab';
import OrgTab from './hr/OrgTab';
import HrSettingsTab from './hr/HrSettingsTab';
import { timeOf, periodLabel, thisPeriod } from './hr/hrShared';

function Performance() {
  const navigate = useNavigate();
  const { data } = useQuery(['hr', 'performance'], () => api.get('/hr/performance').then((r) => r.data), { poll: false });
  if (!data?.rows?.length) return null;
  return (
    <Card>
      <CardHeader title={t('Performance — {m}', { m: periodLabel(thisPeriod()) })} subtitle={data.salesTracked ? t('Sales from bills made by the employee or their assigned retailers') : t('Tasks and attendance')} />
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-left text-xs text-slate-500">
            <th className="px-2 py-1.5 font-medium">{t('Employee')}</th>
            {data.salesTracked && <th className="px-2 py-1.5 text-right font-medium">{t('Sales')}</th>}
            {data.salesTracked && <th className="px-2 py-1.5 text-right font-medium">{t('Target')}</th>}
            <th className="px-2 py-1.5 text-right font-medium">{t('Tasks done')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('Overdue')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{t('Attendance')}</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.rows.map((r) => (
              <tr key={r.userId} onClick={() => navigate(`/hr/employees/${r.userId}`)} className="cursor-pointer hover:bg-slate-50">
                <td className="px-2 py-2 font-medium text-slate-900">{r.name}</td>
                {data.salesTracked && <td className="tabular px-2 py-2 text-right">{formatMoney(r.sales)}</td>}
                {data.salesTracked && <td className="tabular px-2 py-2 text-right">{r.target ? `${r.achievedPct}%` : '—'}</td>}
                <td className="tabular px-2 py-2 text-right">{r.tasks.done}/{r.tasks.total}</td>
                <td className={`tabular px-2 py-2 text-right ${r.tasks.overdue ? 'text-red-600' : ''}`}>{r.tasks.overdue}</td>
                <td className="tabular px-2 py-2 text-right">{r.attendance.pct != null ? `${r.attendance.pct}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PeopleList({ title, icon: Icon, rows, render, empty }) {
  const navigate = useNavigate();
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2"><Icon size={16} className="text-slate-500" /><p className="font-semibold text-slate-900">{title}</p></div>
      {!rows?.length ? <p className="py-3 text-sm text-slate-400">{empty}</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.slice(0, 6).map((r, i) => (
            <li key={`${r.userId}${i}`}>
              <button type="button" onClick={() => navigate(`/hr/employees/${r.userId}`)} className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm hover:text-brand-700">
                <span className="truncate font-medium">{r.name}</span><span className="shrink-0 text-xs text-slate-500">{render(r)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Overview({ goTab }) {
  const { can } = useAuth();
  const { data, loading } = useQuery(['hr', 'dashboard'], () => api.get('/hr/dashboard').then((r) => r.data));
  if (loading && !data) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;
  if (!data) return null;
  const td = data.today || {};
  const pend = data.pending || {};
  const pay = data.payroll;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('Employees')} value={data.employees} icon={Users} />
        <StatCard label={t('Present today')} value={`${(td.present || 0) + (td.late || 0) + (td.half_day || 0)}/${td.total || 0}`} sub={td.late ? t('{n} late', { n: td.late }) : undefined} icon={UserCheck} tone="green" />
        <StatCard label={t('On leave today')} value={td.leave || 0} icon={CalendarDays} tone="amber" />
        <button type="button" className="h-full w-full rounded-xl text-left focus-ring [&>div]:h-full" onClick={() => goTab('requests')}>
          <StatCard label={t('Pending requests')} value={(pend.leave || 0) + (pend.correction || 0) + (pend.help || 0)} icon={Clock} tone="red" />
        </button>
      </div>

      {pay && (
        <Card>
          <CardHeader title={t('Payroll — {m}', { m: periodLabel(pay.period) })} action={<button type="button" onClick={() => goTab('payroll')} className="text-sm font-medium text-brand-700 hover:underline">{t('Open payroll')}</button>} />
          <div className="grid grid-cols-3 gap-2 text-sm">
            {['draft', 'approved', 'paid'].map((s) => (
              <div key={s} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t(s === 'draft' ? 'Draft' : s === 'approved' ? 'Approved' : 'Paid')}</p>
                <p className="tabular text-lg font-semibold">{pay.byStatus[s]?.count || 0}</p>
                <p className="tabular text-xs text-slate-600">{formatMoney(pay.byStatus[s]?.net || 0)}</p>
              </div>
            ))}
          </div>
          {pay.trend?.length > 1 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-slate-500">{t('Salary paid — last months')}</p>
              {pay.trend.map((p) => {
                const max = Math.max(...pay.trend.map((x) => x.net)) || 1;
                return (
                  <div key={p.period} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-slate-500">{periodLabel(p.period).slice(0, 3)} {p.period.slice(2, 4)}</span>
                    <span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-brand-600" style={{ width: `${(p.net / max) * 100}%` }} /></span>
                    <span className="tabular w-24 shrink-0 text-right">{formatMoney(p.net)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <PeopleList title={t('Late today')} icon={Clock} rows={data.lateToday} render={(r) => timeOf(r.at)} empty={t('Nobody is late today')} />
        <PeopleList title={t('Not checked in yet')} icon={UserCheck} rows={data.notMarked} render={() => ''} empty={data.weeklyOff ? t('Weekly off today') : t('Everyone has checked in')} />
        <PeopleList title={t('Upcoming birthdays')} icon={Cake} rows={data.birthdays} render={(r) => formatDate(r.date)} empty={t('No birthdays in the next 30 days')} />
        <PeopleList title={t('Work anniversaries')} icon={Award} rows={data.anniversaries} render={(r) => `${formatDate(r.date)} · ${t('{n} yr', { n: r.years })}`} empty={t('None in the next 30 days')} />
        <PeopleList title={t('Documents expiring')} icon={FileWarning} rows={data.expiringDocuments} render={(r) => `${r.type} · ${formatDate(r.expiry)}`} empty={t('No documents expiring soon')} />
        {data.departments?.length > 0 && (
          <Card>
            <div className="mb-2 flex items-center gap-2"><Wallet size={16} className="text-slate-500" /><p className="font-semibold text-slate-900">{t('Departments')}</p></div>
            <ul className="space-y-1.5 text-sm">
              {data.departments.map((d) => <li key={d._id} className="flex justify-between"><span>{d.name}</span><span className="tabular text-slate-500">{d.employees}</span></li>)}
              {data.unassigned > 0 && <li className="flex justify-between text-slate-500"><span>{t('No department')}</span><span className="tabular">{data.unassigned}</span></li>}
            </ul>
          </Card>
        )}
      </div>
      {can('hr:view') && <Performance />}
    </div>
  );
}

export default function Hr() {
  const { can } = useAuth();
  const [tab, setTab] = useSessionState('hr:tab', can('hr:view') ? 'overview' : 'payroll');
  const teams = useFeature('hr_teams').allowed;
  const { data: dash } = useQuery(['hr', 'dashboard'], () => api.get('/hr/dashboard').then((r) => r.data), { enabled: can('hr:view') });
  const pending = Object.values(dash?.pending || {}).reduce((s, n) => s + n, 0);
  const tabs = [
    ...(can('hr:view') ? [
      { value: 'overview', label: 'Overview' },
      { value: 'employees', label: 'Employees' },
      { value: 'attendance', label: 'Attendance' },
      { value: 'requests', label: 'Requests', count: pending },
    ] : []),
    ...(can('payroll:view') ? [{ value: 'payroll', label: 'Payroll' }] : []),
    ...(can('hr:view') ? [{ value: 'org', label: teams ? 'Teams' : 'Teams 🔒' }, { value: 'settings', label: 'Settings' }] : []),
  ];
  const active = tabs.some((x) => x.value === tab) ? tab : tabs[0]?.value;
  return (
    <>
      <PageHeader title={t('HR')} subtitle={t('Employees, attendance, leave and payroll in one place')} />
      <Tabs tabs={tabs} value={active} onChange={setTab} />
      {active === 'overview' && <Overview goTab={setTab} />}
      {active === 'employees' && <Employees />}
      {active === 'attendance' && <AttendanceTab />}
      {active === 'requests' && <RequestsTab />}
      {active === 'payroll' && <PayrollTab />}
      {active === 'org' && <OrgTab />}
      {active === 'settings' && <HrSettingsTab />}
    </>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatMoney } from '@/lib/format';
import {
  Button, Input, Select, Modal, Table, SearchInput, Chips, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import {
  useHrMeta, Avatar, AttBadge, EMP_TYPES, timeOf,
} from './hrShared';

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function EmployeeForm({ open, onClose, employee = null, onSaved }) {
  const toast = useToast();
  const { can } = useAuth();
  const { data: meta } = useHrMeta();
  const editing = Boolean(employee);
  const salaryOk = can('payroll:create');
  const blank = {
    name: '', phone: '', password: '', staffRole: 'employee', joiningDate: toDateInput(new Date()),
    departmentId: '', designationId: '', reportingManagerId: '', employmentType: 'full_time',
    email: '', dob: '', gender: '', address: '', ecName: '', ecPhone: '',
    salaryType: 'monthly', basic: '', allowances: '', commissionPct: '', monthlyTarget: '',
  };
  const fromEmp = (e) => ({
    ...blank, name: e.name, phone: e.phone, staffRole: e.staffRole, joiningDate: toDateInput(e.joiningDate),
    departmentId: e.departmentId || '', designationId: e.designationId || '', reportingManagerId: e.reportingManagerId || '',
    employmentType: e.employmentType, email: e.email || '', dob: toDateInput(e.dob), gender: e.gender || '', address: e.address || '',
    ecName: e.emergencyContact?.name || '', ecPhone: e.emergencyContact?.phone || '',
    salaryType: e.salary?.type || 'monthly', basic: e.salary?.basic ?? '', allowances: e.salary?.allowances ?? '',
    commissionPct: e.salary?.commissionPct ?? '', monthlyTarget: e.salary?.monthlyTarget ?? '',
  });
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = f || (employee ? fromEmp(employee) : blank);
  const set = (k) => (e) => setF({ ...form, [k]: e.target.value });

  async function save() {
    if (form.name.trim().length < 2) return toast.error(t('Enter the employee name'));
    if (!editing && form.password.length < 6) return toast.error(t('Password must be at least 6 characters'));
    const body = {
      name: form.name.trim(), phone: form.phone.trim(), staffRole: form.staffRole,
      joiningDate: form.joiningDate || undefined,
      departmentId: form.departmentId || null, designationId: form.designationId || null,
      reportingManagerId: form.reportingManagerId || null, employmentType: form.employmentType,
      email: form.email.trim(), dob: form.dob || null, gender: form.gender, address: form.address.trim(),
      emergencyContact: { name: form.ecName.trim(), phone: form.ecPhone.trim() },
    };
    if (!editing) body.password = form.password;
    if (salaryOk && form.basic !== '') {
      body.salary = {
        type: form.salaryType, basic: Number(form.basic) || 0, allowances: Number(form.allowances) || 0,
        commissionPct: Number(form.commissionPct) || 0, monthlyTarget: Number(form.monthlyTarget) || 0,
      };
    }
    if (editing && employee.staffRole === 'owner') delete body.staffRole;
    setSaving(true);
    try {
      const res = editing ? await api.put(`/hr/employees/${employee._id}`, body) : await api.post('/hr/employees', body);
      toast.success(res.message);
      bust('hr', 'staff');
      setF(null);
      onSaved?.(res.data);
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  const opts = (rows, empty) => [{ value: '', label: t(empty) }, ...(rows || []).map((r) => ({ value: r._id, label: r.name }))];

  return (
    <Modal open={open} onClose={() => { setF(null); onClose(); }} size="lg"
      title={editing ? t('Edit employee') : t('Add employee')}
      description={editing ? employee.code : t('A login is created with this phone number. The employee uses it for the Employee App.')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} onClick={save}>{editing ? t('Save changes') : t('Add employee')}</Button></>}>
      <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2">
          <Input label={t('Full name')} required value={form.name} onChange={set('name')} />
          <Input label={t('Mobile number')} required inputMode="numeric" value={form.phone} onChange={set('phone')} />
          {!editing && <Input label={t('Login password')} required type="password" value={form.password} onChange={set('password')} hint={t('Share this with the employee')} />}
          {!employee?.staffRole === 'owner' && (
            <Select label={t('App role')} value={form.staffRole} onChange={set('staffRole')}
              options={(meta?.roles || []).map((r) => ({ value: r.value, label: r.label }))} />
          )}
        </section>

        <section>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">{t('Job details')}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('Joining date')} type="date" value={form.joiningDate} onChange={set('joiningDate')} />
            <Select label={t('Employment type')} value={form.employmentType} onChange={set('employmentType')} options={EMP_TYPES.map(([v, l]) => ({ value: v, label: l }))} />
            <Select label={t('Department')} value={form.departmentId} onChange={set('departmentId')} options={opts(meta?.departments, 'None')} />
            <Select label={t('Designation')} value={form.designationId} onChange={set('designationId')} options={opts(meta?.designations, 'None')} />
            <Select label={t('Reports to')} value={form.reportingManagerId} onChange={set('reportingManagerId')}
              options={opts((meta?.staff || []).filter((s) => String(s._id) !== String(employee?._id)), 'Owner')} />
          </div>
        </section>

        {salaryOk && (
          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-900">{t('Salary')}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label={t('Salary type')} value={form.salaryType} onChange={set('salaryType')}
                options={[{ value: 'monthly', label: t('Monthly') }, { value: 'daily', label: t('Daily wage') }]} />
              <Input label={form.salaryType === 'daily' ? t('Rate per day') : t('Basic per month')} prefix="₹" inputMode="decimal" value={form.basic} onChange={set('basic')} />
              <Input label={t('Allowances per month')} prefix="₹" inputMode="decimal" value={form.allowances} onChange={set('allowances')} />
              <Input label={t('Sales commission %')} suffix="%" inputMode="decimal" value={form.commissionPct} onChange={set('commissionPct')} />
              <Input label={t('Monthly sales target')} prefix="₹" inputMode="decimal" value={form.monthlyTarget} onChange={set('monthlyTarget')} />
            </div>
          </section>
        )}

        <section>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">{t('Personal details')}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('Email')} type="email" value={form.email} onChange={set('email')} />
            <Input label={t('Date of birth')} type="date" value={form.dob} onChange={set('dob')} />
            <Select label={t('Gender')} value={form.gender} onChange={set('gender')}
              options={[{ value: '', label: t('Prefer not to say') }, { value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }, { value: 'other', label: t('Other') }]} />
            <Input label={t('Address')} value={form.address} onChange={set('address')} />
            <Input label={t('Emergency contact name')} value={form.ecName} onChange={set('ecName')} />
            <Input label={t('Emergency contact phone')} inputMode="numeric" value={form.ecPhone} onChange={set('ecPhone')} />
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function Employees() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: meta } = useHrMeta();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [dept, setDept] = useState('');
  const [adding, setAdding] = useState(false);
  const { data, loading } = useQuery(['hr', 'employees', status, dept], () => api.get('/hr/employees', { params: { status, departmentId: dept } }).then((r) => r.data));
  const rx = q.trim().toLowerCase();
  const rows = (data || []).filter((e) => !rx || `${e.name} ${e.phone} ${e.code}`.toLowerCase().includes(rx));
  const showSalary = can('payroll:view');

  const columns = [
    {
      key: 'name', header: t('Employee'),
      render: (e) => (
        <span className="flex items-center gap-3">
          <Avatar name={e.name} url={e.photoUrl} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-900">{e.name}</span>
            <span className="block truncate text-xs text-slate-500">{e.code} · {e.designation || e.staffRoleLabel}</span>
          </span>
        </span>
      ),
    },
    { key: 'department', header: t('Department'), render: (e) => e.department || '—' },
    { key: 'phone', header: t('Phone'), render: (e) => e.phone },
    { key: 'joiningDate', header: t('Joined'), render: (e) => formatDate(e.joiningDate) },
    ...(showSalary ? [{ key: 'salary', header: t('Salary'), align: 'right', render: (e) => (e.salary?.basic ? `${formatMoney(e.salary.basic)}${e.salary.type === 'daily' ? t('/day') : ''}` : '—') }] : []),
    {
      key: 'status', header: t('Today'),
      render: (e) => (e.status !== 'active' ? <span className="text-xs text-slate-500">{t(e.status === 'left' ? 'Left' : 'Inactive')}</span>
        : e.today ? <span className="inline-flex items-center gap-1.5"><AttBadge status={e.today.status} />{e.today.checkIn && <span className="text-xs text-slate-500">{timeOf(e.today.checkIn)}</span>}</span>
          : <AttBadge status="not_marked" />),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder={t('Search name, phone or code')} className="sm:max-w-xs" />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Chips value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'left', label: 'Left' }]} />
          {meta?.departments?.length > 0 && (
            <div className="w-44">
              <Select value={dept} onChange={(e) => setDept(e.target.value)} options={[{ value: '', label: t('All departments') }, ...meta.departments.map((d) => ({ value: d._id, label: d.name }))]} />
            </div>
          )}
        </div>
        {can('hr:create') && <Button icon={UserPlus} onClick={() => setAdding(true)}>{t('Add employee')}</Button>}
      </div>
      <Table
        columns={columns}
        rows={rows}
        loading={loading && !data}
        onRowClick={(e) => navigate(`/hr/employees/${e._id}`)}
        emptyTitle={t('No employees yet')}
        emptyMessage={t('Add your first employee. Existing staff logins appear here automatically.')}
      />
      <EmployeeForm open={adding} onClose={() => setAdding(false)} onSaved={(e) => navigate(`/hr/employees/${e._id}`)} />
    </>
  );
}

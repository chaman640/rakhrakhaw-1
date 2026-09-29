import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserCircle, CalendarDays, TrendingUp, UsersRound, Bell, LifeBuoy, Settings, LogOut, ChevronRight, Camera, Phone, Briefcase,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatPhone } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Select, Spinner, EmptyState, useToast,
} from '@/components/ui';
import { shrinkImage } from '@/lib/shrinkImage';
import { t } from '@/lib/i18n';
import { Avatar } from '@/pages/wholesaler/hr/hrShared';

export function EmpMore() {
  const navigate = useNavigate();
  const { user, logout, can, staffRole } = useAuth();
  const links = [
    ['/emp/more/profile', UserCircle, 'My profile'],
    ['/emp/more/requests', CalendarDays, 'Leave & requests'],
    ['/emp/more/performance', TrendingUp, 'Performance'],
    ['/emp/more/team', UsersRound, 'My team'],
    ['/notifications', Bell, 'Notifications'],
    ['/emp/more/requests?new=help', LifeBuoy, 'Help desk'],
    ['/settings', Settings, 'Settings'],
    ...(staffRole !== 'employee' && can(['hr', 'payroll']) ? [['/hr', Briefcase, 'HR admin']] : []),
  ];
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
        <Avatar name={user?.name} size={44} />
        <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{user?.name}</p><p className="text-sm text-slate-500">{formatPhone(user?.phone)}</p></div>
      </Card>
      <Card padding={false}>
        <ul className="divide-y divide-slate-100">
          {links.map(([to, Icon, label]) => (
            <li key={to}>
              <Link to={to} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50">
                <Icon size={18} className="text-slate-500" /><span className="flex-1 text-sm font-medium text-slate-900">{t(label)}</span><ChevronRight size={16} className="text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Button variant="secondary" icon={LogOut} className="w-full" onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>{t('Log out')}</Button>
    </div>
  );
}

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function EmpProfile() {
  const toast = useToast();
  const fileRef = useRef(null);
  const { data: p } = useQuery(['emp', 'profile'], () => api.get('/hr/me/profile').then((r) => r.data), { poll: false });
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!p) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;
  const form = f || { email: p.email || '', dob: toDateInput(p.dob), gender: p.gender || '', address: p.address || '', ecName: p.emergencyContact?.name || '', ecPhone: p.emergencyContact?.phone || '' };
  const set = (k) => (e) => setF({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    try {
      const res = await api.put('/hr/me/profile', {
        email: form.email.trim(), dob: form.dob || null, gender: form.gender, address: form.address.trim(),
        emergencyContact: { name: form.ecName.trim(), phone: form.ecPhone.trim() },
      });
      toast.success(res.message); bust('emp'); setF(null);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('photo', await shrinkImage(file));
      const res = await api.post('/hr/me/photo', fd);
      toast.success(res.message); bust('emp');
    } catch (err) { toast.error(err.message); }
  }

  const Row = ({ label, value }) => <div className="flex justify-between gap-3 py-2 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-900">{value || '—'}</span></div>;
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={p.name} url={p.photoUrl} size={64} />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label={t('Change photo')} className="absolute -bottom-1 -right-1 rounded-full border border-white bg-slate-800 p-1.5 text-white"><Camera size={12} /></button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold text-slate-900">{p.name}</p>
          <p className="text-sm text-slate-500">{p.code} · {p.designation || p.staffRoleLabel}</p>
        </div>
      </Card>
      <Card>
        <CardHeader title={t('Job')} subtitle={t('Contact HR to change these details')} />
        <div className="divide-y divide-slate-100">
          <Row label={t('Department')} value={p.department} />
          <Row label={t('Reports to')} value={p.reportingManagerName} />
          <Row label={t('Joining date')} value={formatDate(p.joiningDate)} />
          <Row label={t('Phone')} value={formatPhone(p.phone)} />
          <Row label={t('Teams')} value={p.teams?.map((x) => x.name).join(', ')} />
        </div>
      </Card>
      <Card>
        <CardHeader title={t('Personal details')} />
        <div className="space-y-3">
          <Input label={t('Email')} type="email" value={form.email} onChange={set('email')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('Date of birth')} type="date" value={form.dob} onChange={set('dob')} />
            <Select label={t('Gender')} value={form.gender} onChange={set('gender')}
              options={[{ value: '', label: t('Prefer not to say') }, { value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }, { value: 'other', label: t('Other') }]} />
          </div>
          <Input label={t('Address')} value={form.address} onChange={set('address')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('Emergency contact name')} value={form.ecName} onChange={set('ecName')} />
            <Input label={t('Emergency contact phone')} inputMode="numeric" value={form.ecPhone} onChange={set('ecPhone')} />
          </div>
          {f && <Button className="w-full" loading={saving} onClick={save}>{t('Save changes')}</Button>}
        </div>
      </Card>
    </div>
  );
}

export function EmpTeam() {
  const { data, loading } = useQuery(['emp', 'team'], () => api.get('/hr/me/team').then((r) => r.data), { poll: false });
  if (loading && !data) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;
  const Person = ({ p, tag }) => (
    <li className="flex items-center gap-3 py-2.5">
      <Avatar name={p.name} size={34} />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>{tag && <span className="text-xs text-slate-500">{t(tag)}</span>}</span>
      {p.phone && <a href={`tel:${p.phone}`} aria-label={t('Call')} className="rounded-lg p-2 text-brand-700 hover:bg-brand-50"><Phone size={16} /></a>}
    </li>
  );
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">{t('My team')}</h1>
      {data?.manager && <Card><ul><Person p={data.manager} tag="Reporting manager" /></ul></Card>}
      {!data?.teams?.length ? <EmptyState icon={UsersRound} title={t('You are not in a team yet')} /> : data.teams.map((tm) => (
        <Card key={tm._id}>
          <CardHeader title={tm.name} subtitle={tm.description} />
          <ul className="divide-y divide-slate-100">
            {tm.members.map((m) => <Person key={m._id} p={m} tag={tm.leader && String(tm.leader._id) === String(m._id) ? 'Team leader' : ''} />)}
          </ul>
        </Card>
      ))}
    </div>
  );
}


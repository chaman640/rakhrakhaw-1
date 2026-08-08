import { useCallback, useEffect, useState } from 'react';
import {
  UserPlus, Pencil, Trash2, ShieldCheck, Ban, CheckCircle2, KeyRound, Users,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatPhone, formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Select, Badge, Modal, ConfirmModal,
  Spinner, EmptyState, useToast,
} from '@/components/ui';

const PERM_LABEL = {
  items: 'Items aur stock',
  parties: 'Retailer / supplier',
  purchases: 'Purchase entry',
  orders: 'Orders',
  invoices: 'Bill banana',
  returns: 'Maal wapas',
  khata: 'Khata aur payments',
  reports: 'Reports',
  settings: 'Settings',
};

const ROLE_HINT = {
  manager: 'Settings chhod kar lagbhag sab kuch',
  salesman: 'Order aur bill — khata nahi dikhega',
  accountant: 'Khata, payment aur report — stock nahi',
};

export default function StaffTab() {
  const toast = useToast();
  const { user } = useAuth();

  const [data, setData] = useState({ staff: [], roles: [], permissions: [] });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff');
      setData(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(s) {
    setBusy(true);
    try {
      await api.put(`/staff/${s._id}`, { isActive: !s.isActive });
      toast.success(s.isActive ? `${s.name} ka login band kar diya` : `${s.name} ka login chalu kar diya`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await api.delete(`/staff/${deleting._id}`);
      toast.success(res.message);
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  }

  if (loading) {
    return <div className="flex justify-center py-16 text-slate-400"><Spinner size={24} /></div>;
  }

  return (
    <div className="space-y-5">
      <Card padding={false}>
        <CardHeader
          className="p-5 pb-0"
          title="Dukaan ke log"
          subtitle="Har aadmi ka apna login — kisko kya dikhega, wo aap tay karenge"
          action={
            <Button icon={UserPlus} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Naya login
            </Button>
          }
        />

        <div className="mt-3">
          {data.staff.map((s) => (
            <div key={s._id}
              className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  s.isOwner ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}
                aria-hidden="true"
              >
                {s.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-slate-900">{s.name}</p>
                  <Badge tone={s.isOwner ? 'brand' : 'slate'}>{s.staffRoleLabel}</Badge>
                  {String(s._id) === String(user?._id) && <Badge tone="green">Aap</Badge>}
                  {!s.isActive && <Badge tone="red">Band</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatPhone(s.phone)}
                  {' · '}
                  {s.lastLoginAt ? `Aakhri baar ${formatDateTime(s.lastLoginAt)}` : 'Abhi tak login nahi kiya'}
                </p>
                {!s.isOwner && (
                  <p className="mt-1 text-xs text-slate-400">
                    {s.permissions.length === Object.keys(PERM_LABEL).length
                      ? 'Sab kuch'
                      : s.permissions.map((p) => PERM_LABEL[p]).join(', ') || 'Kuch nahi'}
                  </p>
                )}
              </div>

              {s.isOwner ? (
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck size={14} /> Sab kuch
                </span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => { setEditing(s); setFormOpen(true); }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-ring"
                    aria-label={`${s.name} ko edit karein`}>
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => toggleActive(s)} disabled={busy}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-700 focus-ring disabled:opacity-50"
                    aria-label={s.isActive ? `${s.name} ka login band karein` : `${s.name} ka login chalu karein`}>
                    {s.isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                  <button onClick={() => setDeleting(s)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-ring"
                    aria-label={`${s.name} ko hatayein`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {data.staff.length === 1 && (
          <div className="border-t border-slate-100 p-5">
            <EmptyState
              icon={Users}
              title="Abhi sirf aap hain"
              message="Munshi ya salesman rakha hai? Uska apna login bana dijiye — aapka password batane ki zarurat nahi padegi, aur kaun kya kar raha hai wo bhi pata chalega."
              action={<Button icon={UserPlus} onClick={() => { setEditing(null); setFormOpen(true); }}>
                Pehla login banayein
              </Button>}
            />
          </div>
        )}
      </Card>

      <ChangePasswordCard />

      <StaffFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        staff={editing}
        roles={data.roles}
        onSaved={load}
      />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title={deleting ? `${deleting.name} ko hatayein?` : ''}
        message="Iska login hamesha ke liye khatam ho jayega. Jo kaam isne kiya hai wo record me rahega."
        confirmLabel="Haan, hata dein"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- form */

function StaffFormModal({ open, onClose, staff, roles, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(staff?._id);

  const [form, setForm] = useState({ name: '', phone: '', password: '', staffRole: 'salesman' });
  const [perms, setPerms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    if (staff?._id) {
      setForm({ name: staff.name, phone: staff.phone, password: '', staffRole: staff.staffRole });
      setPerms(staff.permissions || []);
    } else {
      setForm({ name: '', phone: '', password: '', staffRole: 'salesman' });
      setPerms(roles.find((r) => r.value === 'salesman')?.defaultPermissions || []);
    }
  }, [open, staff, roles]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Role badla to us role ke default permissions bhar do
  function pickRole(e) {
    const value = e.target.value;
    setForm((f) => ({ ...f, staffRole: value }));
    setPerms(roles.find((r) => r.value === value)?.defaultPermissions || []);
  }

  const togglePerm = (p) =>
    setPerms((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  async function save() {
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        staffRole: form.staffRole,
        permissions: perms,
      };
      if (form.password) payload.password = form.password;

      const res = isEdit
        ? await api.put(`/staff/${staff._id}`, payload)
        : await api.post('/staff', payload);

      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
      if (err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setSaving(false);
    }
  }

  const assignable = roles.filter((r) => r.value !== 'owner');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `${staff?.name} ko edit karein` : 'Naya login banayein'}
      description="Ye aadmi apne phone number aur password se login karega"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Rehne dein</Button>
          <Button onClick={save} loading={saving}>{isEdit ? 'Save karein' : 'Login banayein'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Naam" required value={form.name} onChange={set('name')}
            placeholder="Suresh Kumar" error={fieldErrors.name} />
          <Input label="Phone number" required prefix="+91" value={form.phone} onChange={set('phone')}
            placeholder="9876543210" error={fieldErrors.phone}
            hint="Isi number se login karega" />
        </div>

        <Input
          label={isEdit ? 'Naya password' : 'Password'}
          required={!isEdit}
          type="text"
          value={form.password}
          onChange={set('password')}
          placeholder={isEdit ? 'Badalna ho tabhi bharein' : 'Kam se kam 6 character'}
          error={fieldErrors.password}
          hint={isEdit ? 'Khali chhod denge to purana password chalta rahega' : 'Ye password inhe bata dein'}
        />

        <div>
          <Select label="Kaam kya hai" value={form.staffRole} onChange={pickRole} placeholder=""
            options={assignable.map((r) => ({ value: r.value, label: r.label }))} />
          {ROLE_HINT[form.staffRole] && (
            <p className="mt-1 text-xs text-slate-500">{ROLE_HINT[form.staffRole]}</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-900">Kya kya dikhega</p>
          <p className="mb-3 text-xs text-slate-500">
            Role chunte hi theek-thaak set ho jata hai — chahein to badal lein
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(PERM_LABEL).map(([key, label]) => (
              <label key={key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={perms.includes(key)}
                  onChange={() => togglePerm(key)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-ring"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
          {!perms.length && (
            <p className="mt-2 text-xs text-amber-700">
              Ek bhi nahi chuna — ye login karke kuch nahi kar payega
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------ apna password */

function ChangePasswordCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (next.length < 6) return setError('Naya password kam se kam 6 character ka rakhein');
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/staff/change-password', {
        currentPassword: current, newPassword: next,
      });
      toast.success(res.message);
      setOpen(false); setCurrent(''); setNext('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Apna password"
          subtitle="Kabhi shak ho ki kisi ko pata chal gaya hai to turant badal dijiye"
          action={<Button variant="secondary" icon={KeyRound} onClick={() => setOpen(true)}>
            Password badlein
          </Button>}
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Password badlein"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Rehne dein</Button>
            <Button onClick={save} loading={saving}>Badal dein</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Purana password" type="password" value={current}
            onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <Input label="Naya password" type="password" value={next}
            onChange={(e) => setNext(e.target.value)} autoComplete="new-password"
            hint="Kam se kam 6 character" />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </>
  );
}

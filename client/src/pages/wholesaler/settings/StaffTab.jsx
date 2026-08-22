import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Pencil, Trash2, Ban, CheckCircle2, Users, Link2, Copy, X,
  ShieldCheck, Wallet, Eye, KeyRound } from
'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatPhone, formatDateTime, formatMoney } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Select, Badge, Modal, ConfirmModal,
  Spinner, EmptyState, Switch, CopyBox, useToast } from
'@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * SUB-ACCOUNT — dukaan ke log aur unke haq.
 *
 * Teen cheezein alag alag hain, aur teeno chahiye:
 *
 *   1. IJAZAT  — kaun sa kaam kar sakta hai (bill banana / sirf dekhna)
 *   2. HADD    — kis KE data pe kar sakta hai (sirf apne retailer ya sabke)
 *   3. PAISA   — kitne tak (discount %, bill ki raqam, udhaar)
 *
 * Sab kuch server se aata hai (`/staff` ka jawab), yahan koi list hard-code
 * nahi hai — warna server pe naya kaam jodte hi yahan bhool jate aur checkbox
 * hi na dikhta.
 */

const STATUS_ROW = 'flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0';

export default function StaffTab() {
  const toast = useToast();
  const { user: me } = useAuth();

  const [data, setData] = useState(null);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [newLink, setNewLink] = useState(null);
  const [pwdOpen, setPwdOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, inviteRes] = await Promise.all([
      api.get('/staff'),
      api.get('/staff/invites').catch(() => ({ data: [] }))]
      );
      setData(staffRes.data);
      setInvites(inviteRes.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {load();}, [load]);

  async function toggleActive(row) {
    try {
      await api.put(`/staff/${row._id}`, { isActive: !row.isActive });
      toast.success(row.isActive ? `${row.name} ka login band kar diya` : `${row.name} ka login chalu`);
      load();
    } catch (e) {toast.error(e.message);}
  }

  async function doRemove() {
    try {
      const res = await api.del(`/staff/${removing._id}`);
      toast.success(res.message);
      setRemoving(null);
      load();
    } catch (e) {toast.error(e.message);}
  }

  async function cancelInvite(id) {
    try {
      const res = await api.del(`/staff/invites/${id}`);
      toast.success(res.message);
      load();
    } catch (e) {toast.error(e.message);}
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner size={24} /></div>;
  if (!data) return null;

  const activeInvites = invites.filter((i) => i.status === 'active');

  return (
    <div className="space-y-5">
      <Card padding={false}>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t('Dukaan ke log')}</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {t('Har aadmi ka apna login, apni ijazat aur apni hadd')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={Link2} onClick={() => setInviteOpen(true)}>
              {t('Link se bulayein')}
            </Button>
            <Button size="sm" icon={UserPlus} onClick={() => {setEditing(null);setFormOpen(true);}}>
              {t('Naya aadmi')}
            </Button>
          </div>
        </div>

        <div className="border-t border-slate-200 px-5">
          {data.staff.map((row) =>
          <div key={row._id} className={STATUS_ROW}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{row.name}</p>
                  <Badge tone={row.isOwner ? 'brand' : row.staffRole === 'admin' ? 'blue' : 'slate'}>
                    {row.staffRoleLabel}
                  </Badge>
                  {!row.isActive && <Badge tone="red">{t('Band')}</Badge>}
                  {row.scope === 'own' && <Badge tone="amber">{t('Sirf apna kaam')}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatPhone(row.phone)}
                  {' · '}
                  {row.isOwner ? 'Sab kuch' : `${row.permissions.length} kaam ki ijazat`}
                  {row.lastLoginAt && ` · aakhri baar ${formatDateTime(row.lastLoginAt)}`}
                </p>
                {row.limitsSummary?.hasLimits &&
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-amber-700">
                    <Wallet size={11} /> {row.limitsSummary.lines.join(' · ')}
                  </p>
              }
              </div>

              {!row.isOwner &&
            <div className="flex shrink-0 items-center gap-1">
                  <button
                onClick={() => toggleActive(row)}
                aria-label={row.isActive ? 'Login band karein' : 'Login chalu karein'}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title={row.isActive ? 'Login band karein' : 'Login chalu karein'}>
                
                    {row.isActive ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                  <button
                onClick={() => {setEditing(row);setFormOpen(true);}}
                aria-label={`${row.name} ko badlein`}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                
                    <Pencil size={16} />
                  </button>
                  <button
                onClick={() => setRemoving(row)}
                aria-label={`${row.name} ko hatayein`}
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                
                    <Trash2 size={16} />
                  </button>
                </div>
            }
            </div>
          )}
        </div>
      </Card>

      {activeInvites.length > 0 &&
      <Card padding={false}>
          <CardHeader
          title={t('Bheji hui link')}
          subtitle={t('Jo abhi tak istemal nahi hui')}
          className="p-5 pb-0" />
        
          <div className="px-5 pb-2">
            {activeInvites.map((inv) =>
          <div key={inv._id} className={STATUS_ROW}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {inv.label || inv.staffRoleLabel}
                  </p>
                  <p className="text-xs text-slate-500">{t("{a0}{a1}{a2}{a3} tak", { a0:
                  inv.staffRoleLabel, a1:
                  inv.phone && ` · sirf ${formatPhone(inv.phone)} ke liye`, a2:
                  ' · ', a3:
                  new Date(inv.expiresAt).toLocaleDateString('en-IN') })}
              </p>
                </div>
                <Button size="sm" variant="ghost" icon={X} onClick={() => cancelInvite(inv._id)}>
                  {t('Rad karein')}
                </Button>
              </div>
          )}
          </div>
        </Card>
      }

      {/*
         Apna password har koi badal sakta hai — malik bhi, salesman bhi.
         Isliye ye card sabko dikhta hai aur kisi ijazat pe nahi tikta.
        */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{t('Apna password')}</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {t('Sirf aapka apna — kisi aur ka yahan se nahi badalta')}
            </p>
          </div>
          <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => setPwdOpen(true)}>
            {t('Password badlein')}
          </Button>
        </div>
      </Card>

      <ChangePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />

      <StaffFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        staff={editing}
        meta={data}
        me={me}
        onSaved={() => {setFormOpen(false);load();}} />
      

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        meta={data}
        onCreated={(inv) => {setInviteOpen(false);setNewLink(inv);load();}} />
      

      <Modal open={Boolean(newLink)} onClose={() => setNewLink(null)} title={t('Link tayyar hai')}>
        <p className="text-sm text-slate-600">{t("Ye link {a0} ke liye hai. Jo bhi ise kholega, wahi ijazat le kar jud jayega.", { a0:
            newLink?.staffRoleLabel })}

        </p>
        <div className="mt-3">
          <CopyBox label={t('Link')} value={newLink?.link || ''} />
        </div>
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <strong>{t('Ye link ab dobara nahi dikhegi.')}</strong>{' '}
          {t('Abhi copy karke WhatsApp pe bhej dijiye. Kho jaye to nayi bana lena — purani apne aap bekaar ho jayegi.')}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setNewLink(null)}>{t('Theek hai')}</Button>
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={doRemove}
        title={`${removing?.name || ''} ko hatayein?`}
        message={t('Inka login turant band ho jayega. Inke naam wale retailer sabke ho jayenge — data kuch nahi mitega.')}
        confirmText={t('Haan, hatayein')}
        danger />
      
    </div>);

}

/* ══════════════════════════ ijazat ki matrix ══════════════════════════ */

/**
 * Module × kaam ka table.
 *
 * Har row ek module, har column ek kaam. Isi se wo cheez mumkin hoti hai jo
 * pehle nahi thi: CA ko sirf "Dekhna" wala tick de dena.
 *
 * Ek chhota niyam: "Dekhna" hata do to us module ka baaki sab bhi hat jata
 * hai — bina dekhe banane/badalne ka koi matlab hi nahi. Aur kuch bhi tick
 * karo to "Dekhna" apne aap lag jata hai.
 */
function PermissionMatrix({ modules, value, onChange }) {
  const has = (p) => value.includes(p);

  function toggle(moduleKey, permission, actions) {
    const viewPerm = `${moduleKey}:view`;
    let next = has(permission) ?
    value.filter((p) => p !== permission) :
    [...value, permission];

    if (permission === viewPerm && has(permission)) {
      // Dekhna hata diya — us module ka sab hata do
      const prefix = `${moduleKey}:`;
      next = next.filter((p) => !p.startsWith(prefix));
    } else if (permission !== viewPerm && !has(permission)) {
      // Kuch aur diya — dekhna apne aap
      if (actions.some((a) => a.permission === viewPerm) && !next.includes(viewPerm)) {
        next = [...next, viewPerm];
      }
    }
    onChange([...new Set(next)]);
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {modules.map((m) => {
        const anyOn = m.actions.some((a) => has(a.permission));
        return (
          <div key={m.key} className="p-3">
            <p className={cn('mb-2 text-sm font-medium', anyOn ? 'text-slate-900' : 'text-slate-400')}>
              {t(m.label)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {m.actions.map((a) => {
                const on = has(a.permission);
                return (
                  <button
                    key={a.permission}
                    type="button"
                    onClick={() => toggle(m.key, a.permission, m.actions)}
                    aria-pressed={on}
                    className={cn(
                      // min-h-9 — phone pe ungli se tick karna hota hai
                      'min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring',
                      on ?
                      'border-brand-500 bg-brand-50 text-brand-700' :
                      'border-slate-200 text-slate-500 hover:bg-slate-50'
                    )}>
                    
                    {t(a.label)}
                  </button>);

              })}
            </div>
          </div>);

      })}
    </div>);

}

/* ══════════════════════════ hadd aur paisa ══════════════════════════ */

function ScopeAndLimits({ form, setForm, scopes }) {
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));
  const setLimit = (k) => (v) => setForm((s) => ({ ...s, limits: { ...s.limits, [k]: v } }));

  // Khali dabba = koi hadd nahi (null). 0 ka matlab "kuch bhi nahi" hota,
  // isliye khali ko 0 banana bilkul galat hoga.
  const num = (e) => e.target.value === '' ? null : Number(e.target.value);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Eye size={14} /> {t('Kiska data dikhega')}
        </p>
        <div className="flex flex-wrap gap-2">
          {scopes.map((s) =>
          <button
            key={s.value}
            type="button"
            onClick={() => set('scope')(s.value)}
            aria-pressed={form.scope === s.value}
            className={cn(
              'min-h-10 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-ring',
              form.scope === s.value ?
              'border-brand-500 bg-brand-50 text-brand-700' :
              'border-slate-200 text-slate-600 hover:bg-slate-50'
            )}>
            
              {t(s.label)}
            </button>
          )}
        </div>
        {form.scope === 'own' &&
        <p className="mt-1.5 text-xs text-slate-500">
            {t('Sirf wahi retailer dikhenge jo inke naam hain ya jo inhone khud jode. Unke order, bill aur khata bhi apne aap isi hadd me aa jayenge.')}
          </p>
        }
      </div>

      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <Wallet size={14} /> {t('Paise ki hadd')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('Zyada se zyada discount %')}
            type="number" min="0" max="100" inputMode="decimal"
            value={form.limits.maxDiscountPercent ?? ''}
            onChange={(e) => setLimit('maxDiscountPercent')(num(e))}
            placeholder={t('koi hadd nahi')}
            hint={t('Khali chhodein to jitna marzi')} />
          
          <Input
            label={t('Bill isse bada nahi')}
            type="number" min="0" inputMode="decimal"
            value={form.limits.maxInvoiceAmount ?? ''}
            onChange={(e) => setLimit('maxInvoiceAmount')(num(e))}
            placeholder={t('koi hadd nahi')}
            hint={t('₹ me. Khali chhodein to koi hadd nahi')} />
          
        </div>
        <div className="mt-3">
          <Switch
            id="credit"
            label={t('Udhaar pe bill bana sakte hain')}
            description={t('Band karein to poora paisa usi waqt lena hoga')}
            checked={form.limits.canSellOnCredit !== false}
            onChange={(v) => setLimit('canSellOnCredit')(v)} />
          
        </div>
      </div>
    </div>);

}

/* ══════════════════════════ naya / badlo ══════════════════════════ */

const emptyForm = (meta) => {
  const role = meta.roles.find((r) => r.value === 'salesman') || meta.roles[1];
  return {
    name: '', phone: '', password: '',
    staffRole: role.value,
    permissions: [...role.defaultPermissions],
    scope: role.defaultScope,
    limits: { ...role.defaultLimits }
  };
};

function StaffFormModal({ open, onClose, staff, meta, me, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(meta));
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('role');

  useEffect(() => {
    if (!open) return;
    setTab('role');
    if (staff) {
      setForm({
        name: staff.name, phone: staff.phone, password: '',
        staffRole: staff.staffRole,
        permissions: [...staff.permissions],
        scope: staff.scope,
        limits: { ...staff.limits }
      });
    } else {
      setForm(emptyForm(meta));
    }
  }, [open, staff, meta]);

  const roles = useMemo(
    () => meta.roles.filter((r) => r.assignable),
    [meta.roles]
  );
  const currentRole = roles.find((r) => r.value === form.staffRole);

  // Sah-malik sirf malik bana sakta hai — warna ek sah-malik baaki sabko
  // nikaal kar akela reh jata
  const canPickAdmin = Boolean(me?.isOwner);

  function pickRole(value) {
    const role = roles.find((r) => r.value === value);
    if (!role) return;
    setForm((s) => ({
      ...s,
      staffRole: value,
      permissions: [...role.defaultPermissions],
      scope: role.defaultScope,
      limits: { ...role.defaultLimits }
    }));
  }

  async function save() {
    setBusy(true);
    try {
      const body = {
        name: form.name,
        phone: form.phone,
        staffRole: form.staffRole,
        permissions: form.permissions,
        scope: form.scope,
        limits: form.limits
      };
      if (form.password) body.password = form.password;

      if (staff) {
        await api.put(`/staff/${staff._id}`, body);
        toast.success('Save ho gaya');
      } else {
        await api.post('/staff', body);
        toast.success(`${form.name} ka login ban gaya`);
      }
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
  { key: 'role', label: t('Kaun hai') },
  { key: 'perms', label: `Ijazat (${form.permissions.length})` },
  { key: 'limits', label: t('Hadd') }];


  return (
    <Modal open={open} onClose={onClose} title={staff ? `${staff.name} ki setting` : 'Naya aadmi'} size="lg">
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((tb) =>
        <button
          key={tb.key}
          type="button"
          onClick={() => setTab(tb.key)}
          className={cn(
            'relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors focus-ring',
            tab === tb.key ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800'
          )}>
          
            {t(tb.label)}
            {tab === tb.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </button>
        )}
      </div>

      {tab === 'role' &&
      <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('Naam')} value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} required />
            <Input label={t('Phone number')} value={form.phone}
          onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
          hint={t('Isse hi login karenge')} required />
          </div>

          <Input
          label={staff ? 'Naya password (khali chhodein to wahi rahega)' : 'Password'}
          type="password" value={form.password}
          onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          required={!staff} />
        

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">{t('Role')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => {
              const locked = r.value === 'admin' && !canPickAdmin;
              return (
                <button
                  key={r.value}
                  type="button"
                  disabled={locked}
                  onClick={() => pickRole(r.value)}
                  aria-pressed={form.staffRole === r.value}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors focus-ring',
                    form.staffRole === r.value ?
                    'border-brand-500 bg-brand-50' :
                    'border-slate-200 hover:bg-slate-50',
                    locked && 'cursor-not-allowed opacity-50'
                  )}>
                  
                    <p className="text-sm font-medium text-slate-900">{t(r.label)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.hint}</p>
                    {locked &&
                  <p className="mt-1 text-xs text-amber-700">{t('Sirf malik bana sakta hai')}</p>
                  }
                  </button>);

            })}
            </div>
            {currentRole &&
          <p className="mt-2 text-xs text-slate-500">
                {t('Role chunte hi uski aam ijazat lag jati hai — "Ijazat" me jaakar ghata-badha sakte hain.')}
              </p>
          }
          </div>
        </div>
      }

      {tab === 'perms' &&
      <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-600" />
            <p>
              {t('Har kaam alag hai. Sirf {d} dena ho to bas wahi tick karein — CA ke liye yahi chahiye hota hai. {d} hatate hi us hisse ka baaki sab apne aap hat jata hai.', { d: t('Dekhna') })}
            </p>
          </div>
          <PermissionMatrix
          modules={meta.modules}
          value={form.permissions}
          onChange={(v) => setForm((s) => ({ ...s, permissions: v }))} />
        
        </div>
      }

      {tab === 'limits' &&
      <ScopeAndLimits form={form} setForm={setForm} scopes={meta.scopes} />
      }

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={onClose}>{t('Rehne dein')}</Button>
        <Button loading={busy} onClick={save}
        disabled={!form.name || !form.phone || !staff && !form.password}>
          {staff ? 'Save karein' : 'Login banayein'}
        </Button>
      </div>
    </Modal>);

}

/* ══════════════════════════ invite link ══════════════════════════ */

function InviteModal({ open, onClose, meta, onCreated }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => {
    const role = meta.roles.find((r) => r.value === 'salesman') || meta.roles[1];
    return {
      label: '', staffRole: role.value, phone: '', validDays: 7,
      permissions: [...role.defaultPermissions],
      scope: role.defaultScope,
      limits: { ...role.defaultLimits }
    };
  });

  const roles = meta.roles.filter((r) => r.assignable);

  function pickRole(value) {
    const role = roles.find((r) => r.value === value);
    if (!role) return;
    setForm((s) => ({
      ...s,
      staffRole: value,
      permissions: [...role.defaultPermissions],
      scope: role.defaultScope,
      limits: { ...role.defaultLimits }
    }));
  }

  async function create() {
    setBusy(true);
    try {
      const res = await api.post('/staff/invites', {
        label: form.label,
        staffRole: form.staffRole,
        permissions: form.permissions,
        scope: form.scope,
        limits: form.limits,
        validDays: Number(form.validDays) || 7,
        ...(form.phone ? { phone: form.phone } : {})
      });
      onCreated(res.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('Link se bulayein')}>
      <p className="text-sm text-slate-600">
        {t('Link bhej dijiye — aane wala khud apna naam aur password banayega. Aapko uska password kabhi pata nahi chalega.')}
      </p>

      <div className="mt-4 space-y-4">
        <Input
          label={t('Kis liye (sirf aapki yaad ke liye)')}
          value={form.label}
          onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
          placeholder={t('Ramu — naya salesman')} />
        

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">{t('Role')}</p>
          <Select
            value={form.staffRole}
            onChange={(e) => pickRole(e.target.value)}
            placeholder=""
            options={roles.map((r) => ({ value: r.value, label: r.label }))} />
          
          <p className="mt-1 text-xs text-slate-500">
            {roles.find((r) => r.value === form.staffRole)?.hint}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('Sirf is number ke liye (marzi se)')}
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
            placeholder="9876543210"
            hint={t('Bhar dein to sirf yahi number jud payega')} />
          
          <Input
            label={t('Kitne din chalegi')}
            type="number" min="1" max="30"
            value={form.validDays}
            onChange={(e) => setForm((s) => ({ ...s, validDays: e.target.value }))} />
          
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={onClose}>{t('Rehne dein')}</Button>
        <Button loading={busy} icon={Link2} onClick={create}>{t('Link banayein')}</Button>
      </div>
    </Modal>);

}

/* ══════════════════════════ apna password ══════════════════════════ */

function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {setForm({ currentPassword: '', newPassword: '' });setError('');}
  }, [open]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api.post('/staff/change-password', form);
      toast.success('Password badal gaya');
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('Password badlein')}>
      <div className="space-y-4">
        <Input
          label={t('Purana password')} type="password"
          value={form.currentPassword}
          onChange={(e) => setForm((s) => ({ ...s, currentPassword: e.target.value }))} />
        
        <Input
          label={t('Naya password')} type="password"
          value={form.newPassword}
          onChange={(e) => setForm((s) => ({ ...s, newPassword: e.target.value }))}
          hint={t('Kam se kam 6 character')} />
        
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4">
        <Button variant="secondary" onClick={onClose}>{t('Rehne dein')}</Button>
        <Button loading={busy} onClick={save}
        disabled={!form.currentPassword || form.newPassword.length < 6}>
          {t('Badal dein')}
        </Button>
      </div>
    </Modal>);

}

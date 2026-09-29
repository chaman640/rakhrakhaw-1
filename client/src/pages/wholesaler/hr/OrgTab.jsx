import { useState } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { useFeature } from '@/hooks/useBilling';
import { formatMoney } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Select, Modal, Chips, EmptyState, useToast,
} from '@/components/ui';
import { UpgradeCard } from '@/components/billing/FeatureGate';
import { t } from '@/lib/i18n';
import { useHrMeta } from './hrShared';

function OrgList({ kind }) {
  const toast = useToast();
  const { can } = useAuth();
  const { data: meta } = useHrMeta();
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const { data } = useQuery(['hr', 'org', kind], () => api.get(`/hr/org/${kind}`).then((r) => r.data));
  const label = kind === 'department' ? t('Department') : t('Designation');

  async function save() {
    setSaving(true);
    try {
      const body = { name: edit.name.trim(), ...(kind === 'department' ? { managerUserId: edit.managerUserId || null } : {}) };
      const res = edit._id ? await api.put(`/hr/org/${kind}/${edit._id}`, body) : await api.post(`/hr/org/${kind}`, body);
      toast.success(res.message); bust('hr'); setEdit(null);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }
  async function remove(r) {
    if (!window.confirm(t('Delete "{n}"?', { n: r.name }))) return;
    try { await api.delete(`/hr/org/${kind}/${r._id}`); bust('hr'); } catch (err) { toast.error(err.message); }
  }

  return (
    <Card>
      <CardHeader title={kind === 'department' ? t('Departments') : t('Designations')}
        action={can('hr:edit') && <Button size="sm" icon={Plus} onClick={() => setEdit({ name: '', managerUserId: '' })}>{t('Add')}</Button>} />
      {!data?.length ? <p className="py-6 text-center text-sm text-slate-400">{kind === 'department' ? t('No departments yet — e.g. Sales, Warehouse, Accounts') : t('No designations yet — e.g. Sales Executive, Supervisor')}</p> : (
        <ul className="divide-y divide-slate-100">
          {data.map((r) => (
            <li key={r._id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                <p className="text-xs text-slate-500">{t('{n} employees', { n: r.employees })}{r.managerName ? ` · ${t('Head')}: ${r.managerName}` : ''}</p>
              </div>
              {can('hr:edit') && <>
                <button type="button" onClick={() => setEdit({ ...r, managerUserId: r.managerUserId || '' })} aria-label={t('Edit')} className="rounded p-1.5 text-slate-400 hover:text-slate-800"><Pencil size={15} /></button>
                <button type="button" onClick={() => remove(r)} aria-label={t('Delete')} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
              </>}
            </li>
          ))}
        </ul>
      )}
      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?._id ? t('Edit {x}', { x: label }) : t('Add {x}', { x: label })}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>{t('Cancel')}</Button><Button loading={saving} disabled={(edit?.name || '').trim().length < 2} onClick={save}>{t('Save')}</Button></>}>
        {edit && (
          <div className="space-y-3">
            <Input label={t('Name')} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            {kind === 'department' && (
              <Select label={t('Department head (optional)')} value={edit.managerUserId} onChange={(e) => setEdit({ ...edit, managerUserId: e.target.value })}
                options={[{ value: '', label: t('None') }, ...(meta?.staff || []).map((s) => ({ value: s._id, label: s.name }))]} />
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}

function TeamForm({ team, onClose }) {
  const toast = useToast();
  const { data: meta } = useHrMeta();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!team) return null;
  const form = f || { name: team.name || '', description: team.description || '', leaderUserId: team.leaderUserId || '', memberIds: (team.memberIds || []).map(String), monthlyTarget: team.monthlyTarget || '' };
  const toggle = (id) => setF({ ...form, memberIds: form.memberIds.includes(id) ? form.memberIds.filter((x) => x !== id) : [...form.memberIds, id] });

  async function save() {
    setSaving(true);
    try {
      const body = { ...form, leaderUserId: form.leaderUserId || null, monthlyTarget: Number(form.monthlyTarget) || 0 };
      const res = team._id ? await api.put(`/hr/teams/${team._id}`, body) : await api.post('/hr/teams', body);
      toast.success(res.message); bust('hr'); setF(null); onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open onClose={() => { setF(null); onClose(); }} title={team._id ? t('Edit team') : t('New team')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} disabled={form.name.trim().length < 2} onClick={save}>{t('Save')}</Button></>}>
      <div className="space-y-3">
        <Input label={t('Team name')} value={form.name} onChange={(e) => setF({ ...form, name: e.target.value })} />
        <Input label={t('Description (optional)')} value={form.description} onChange={(e) => setF({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('Team leader')} value={form.leaderUserId} onChange={(e) => setF({ ...form, leaderUserId: e.target.value })}
            options={[{ value: '', label: t('None') }, ...(meta?.staff || []).map((s) => ({ value: s._id, label: s.name }))]} />
          <Input label={t('Monthly sales target')} prefix="₹" inputMode="decimal" value={form.monthlyTarget} onChange={(e) => setF({ ...form, monthlyTarget: e.target.value })} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">{t('Members')}</p>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {(meta?.staff || []).map((s) => (
              <label key={s._id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={form.memberIds.includes(String(s._id))} onChange={() => toggle(String(s._id))} className="h-4 w-4 accent-brand-600" />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Teams() {
  const toast = useToast();
  const { can } = useAuth();
  const [edit, setEdit] = useState(null);
  const { data } = useQuery(['hr', 'teams'], () => api.get('/hr/teams').then((r) => r.data));
  async function remove(tm) {
    if (!window.confirm(t('Delete team "{n}"?', { n: tm.name }))) return;
    try { await api.delete(`/hr/teams/${tm._id}`); bust('hr'); } catch (err) { toast.error(err.message); }
  }
  return (
    <>
      <div className="mb-3 flex justify-end">{can('hr:edit') && <Button icon={Plus} onClick={() => setEdit({})}>{t('New team')}</Button>}</div>
      {!data?.length ? <EmptyState icon={Users} title={t('No teams yet')} message={t('Group employees into teams, assign a leader and a monthly sales target.')} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((tm) => {
            const pct = tm.monthlyTarget && tm.achieved != null ? Math.min(100, Math.round((tm.achieved / tm.monthlyTarget) * 100)) : null;
            return (
              <Card key={tm._id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{tm.name}</p>
                    <p className="text-xs text-slate-500">{tm.leaderName ? `${t('Leader')}: ${tm.leaderName} · ` : ''}{t('{n} members', { n: tm.members.length })}</p>
                  </div>
                  {can('hr:edit') && (
                    <div className="flex shrink-0">
                      <button type="button" onClick={() => setEdit(tm)} aria-label={t('Edit')} className="rounded p-1.5 text-slate-400 hover:text-slate-800"><Pencil size={15} /></button>
                      <button type="button" onClick={() => remove(tm)} aria-label={t('Delete')} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
                {tm.description && <p className="mt-2 text-sm text-slate-600">{tm.description}</p>}
                <p className="mt-2 text-xs text-slate-500">{tm.members.map((m) => m.name).join(', ') || t('No members')}</p>
                {pct != null && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">{t('This month')}</span><span className="font-medium">{formatMoney(tm.achieved)} / {formatMoney(tm.monthlyTarget)}</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} /></div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <TeamForm team={edit} onClose={() => setEdit(null)} />
    </>
  );
}

export default function OrgTab() {
  const [view, setView] = useState('teams');
  const { allowed, lockedInfo } = useFeature('hr_teams');
  if (!allowed) return <UpgradeCard info={lockedInfo} />;
  return (
    <>
      <Chips className="mb-4" value={view} onChange={setView} options={[{ value: 'teams', label: 'Teams' }, { value: 'structure', label: 'Departments & designations' }]} />
      {view === 'teams' ? <Teams /> : (
        <div className="grid gap-4 md:grid-cols-2">
          <OrgList kind="department" />
          <OrgList kind="designation" />
        </div>
      )}
    </>
  );
}

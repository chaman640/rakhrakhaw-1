import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, Phone, Clock, AlertTriangle, User, Trash2, CalendarClock, MapPin,
} from 'lucide-react';
import api from '@/lib/api';
import { bust, useQuery } from '@/hooks/useQuery';
import { useFeature } from '@/hooks/useBilling';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import {
  Modal, Button, Input, Select, Textarea, Badge, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/*
  CRM ke chhote hisse — Leads, Kaam, Team aur "Aaj ka kaam" teeno me kaam
  aate hain. Ek jagah, taaki kaam ki line har page pe ek jaisi dikhe.
*/

export const STAGES = [
  ['new', 'Naya'], ['contacted', 'Baat hui'], ['interested', 'Interest hai'],
  ['quotation', 'Quotation'], ['negotiation', 'Mol-bhav'], ['won', 'Jeeta'], ['lost', 'Haara'],
];
export const STAGE_LABEL = Object.fromEntries(STAGES);
export const STAGE_TONE = {
  new: 'slate', contacted: 'blue', interested: 'brand', quotation: 'amber', negotiation: 'amber', won: 'green', lost: 'red',
};
export const SOURCES = [
  ['walkin', 'Dukaan pe aaya'], ['referral', 'Kisi ne bataya'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'],
  ['website', 'Website'], ['salesman', 'Salesman'], ['call', 'Call'], ['other', 'Aur'],
];
const KINDS = [['call', 'Call'], ['visit', 'Visit'], ['followup', 'Follow-up'], ['payment', 'Payment lena'], ['delivery', 'Delivery'], ['other', 'Aur']];
const PRIORITIES = [['low', 'Kam'], ['normal', 'Normal'], ['high', 'Zaroori']];

/** Staff you can hand work to — crm_assign (₹100+) */
export function useAssignable() {
  const { allowed } = useFeature('crm_assign');
  const { isOwner, can } = useAuth();
  const manager = isOwner || can?.('parties:edit');
  const { data } = useQuery(['crm', 'staff'], () => api.get('/crm/staff').then((r) => r.data), { enabled: allowed && Boolean(manager), poll: false });
  return { canAssign: allowed && Boolean(manager), staff: data || [] };
}

export function AssigneeSelect({ value, onChange, label = t('Kisko dena hai') }) {
  const { canAssign, staff } = useAssignable();
  const { user } = useAuth();
  if (!canAssign) return null;
  return (
    <Select
      label={t(label)}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      options={[
        { value: '', label: t('Khud ko') },
        ...staff.filter((s) => String(s._id) !== String(user?._id)).map((s) => ({ value: s._id, label: `${s.name} (${s.staffRole})` })),
      ]}
    />
  );
}

const toLocalInput = (d) => (d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const todayEvening = () => { const d = new Date(); d.setHours(18, 0, 0, 0); return toLocalInput(d); };

/* ─────────────────────────────── naya kaam ─────────────────────────────── */

export function TaskFormModal({ open, onClose, preset = {}, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = f || { title: preset.title || '', note: '', kind: preset.kind || 'followup', priority: 'normal', dueAt: todayEvening(), assignedToUserId: preset.assignedToUserId || null };
  const set = (k) => (e) => setF({ ...form, [k]: e?.target ? e.target.value : e });

  async function save() {
    if (form.title.trim().length < 2) { toast.error(t('Kaam ka naam likhein')); return; }
    setSaving(true);
    try {
      const res = await api.post('/crm/tasks', {
        ...form,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        partyId: preset.partyId || null,
        leadId: preset.leadId || null,
      });
      toast.success(res.message);
      bust('crm');
      setF(null);
      onSaved?.(res.data);
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={() => { setF(null); onClose(); }} title={t('Naya kaam')} description={preset.forName}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Rehne dein')}</Button><Button loading={saving} onClick={save}>{t('Kaam banayein')}</Button></>}>
      <div className="space-y-3">
        <Input label={t('Kya karna hai')} required value={form.title} onChange={set('title')} placeholder={t('Jaise: Sharma Traders ko call karna')} />
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('Kis tarah ka')} value={form.kind} onChange={set('kind')} options={KINDS.map(([v, l]) => ({ value: v, label: t(l) }))} />
          <Select label={t('Kitna zaroori')} value={form.priority} onChange={set('priority')} options={PRIORITIES.map(([v, l]) => ({ value: v, label: t(l) }))} />
        </div>
        <Input label={t('Kab tak')} type="datetime-local" value={form.dueAt} onChange={set('dueAt')} />
        <AssigneeSelect value={form.assignedToUserId} onChange={(v) => setF({ ...form, assignedToUserId: v })} />
        <Textarea label={t('Note (marzi)')} rows={2} value={form.note} onChange={set('note')} />
      </div>
    </Modal>
  );
}

/* ─────────────────────────────── ek kaam ki line ─────────────────────────────── */

export function TaskRow({ task, showAssignee = false, onChanged, taskPath = '/crm/tasks' }) {
  const toast = useToast();
  const { user, isOwner } = useAuth();
  const [doneOpen, setDoneOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const who = task.party || task.lead;
  const done = task.status === 'done';

  async function markDone() {
    setBusy(true);
    try {
      await api.put(`${taskPath}/${task._id}`, { status: 'done', doneNote: note });
      toast.success(t('Kaam poora'));
      bust('crm');
      setDoneOpen(false);
      onChanged?.();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  async function reopen() {
    try { await api.put(`${taskPath}/${task._id}`, { status: 'pending' }); bust('crm'); onChanged?.(); } catch (err) { toast.error(err.message); }
  }
  async function remove() {
    if (!window.confirm(t('Ye kaam mita dein?'))) return;
    try { await api.delete(`/crm/tasks/${task._id}`); bust('crm'); onChanged?.(); } catch (err) { toast.error(err.message); }
  }

  return (
    <li className={cn('flex items-start gap-3 py-3', done && 'opacity-60')}>
      <button
        type="button"
        onClick={() => (done ? reopen() : setDoneOpen(true))}
        aria-label={done ? t('Wapas khula karein') : t('Poora hua')}
        className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 focus-ring',
          done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-500')}
      >
        {done && <Check size={14} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium text-slate-900', done && 'line-through')}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {task.dueAt && (
            <span className={cn('inline-flex items-center gap-1', task.overdue && 'font-semibold text-red-600')}>
              {task.overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}{formatDateTime(task.dueAt)}
            </span>
          )}
          {task.priority === 'high' && <Badge tone="red">{t('Zaroori')}</Badge>}
          {task.source === 'auto' && <Badge tone="slate">{t('Apne aap bana')}</Badge>}
          {who && (task.party && taskPath === '/crm/tasks'
            ? <Link to={`/crm/customers/${task.party._id}`} className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline"><User size={12} />{who.name}</Link>
            : <span className="inline-flex items-center gap-1"><User size={12} />{who.name}</span>)}
          {who?.phone && (
            <a href={`tel:${who.phone}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline"><Phone size={12} />{who.phone}</a>
          )}
          {showAssignee && task.assignedToName && <span>→ {task.assignedToName}</span>}
        </p>
        {task.note && <p className="mt-1 text-xs text-slate-600">{task.note}</p>}
        {done && task.doneNote && <p className="mt-1 text-xs text-emerald-700">✓ {task.doneNote}</p>}
        {doneOpen && (
          <div className="mt-2 flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} autoFocus
              placeholder={t('Kya hua? (marzi) — jaise "kal order dega"')}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand-600" />
            <Button size="sm" loading={busy} onClick={markDone}>{t('Poora')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDoneOpen(false)}>{t('Rehne dein')}</Button>
          </div>
        )}
      </div>
      {taskPath === '/crm/tasks' && (isOwner || String(task.createdBy) === String(user?._id)) && (
        <button type="button" onClick={remove} aria-label={t('Mitayein')} className="shrink-0 rounded p-1 text-slate-300 hover:text-red-600">
          <Trash2 size={14} />
        </button>
      )}
    </li>
  );
}

/* ─────────────────────────────── lead ki line ─────────────────────────────── */

export function LeadLine({ lead, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(lead)} className="flex w-full items-start gap-3 py-3 text-left hover:bg-slate-50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{lead.shopName || lead.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          {lead.shopName && <span>{lead.name}</span>}
          {lead.phone && <span>{lead.phone}</span>}
          {lead.city && <span className="inline-flex items-center gap-0.5"><MapPin size={11} />{lead.city}</span>}
          {lead.assignedToName && <span>→ {lead.assignedToName}</span>}
          {lead.nextFollowUpAt && <span className="inline-flex items-center gap-0.5"><CalendarClock size={11} />{formatDate(lead.nextFollowUpAt)}</span>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <Badge tone={STAGE_TONE[lead.stage]}>{t(STAGE_LABEL[lead.stage])}</Badge>
        {lead.expectedValue > 0 && <p className="mt-1 text-xs text-slate-500">{formatMoney(lead.expectedValue)}{!['won', 'lost'].includes(lead.stage) && lead.probability !== undefined ? ` · ${lead.probability}%` : ''}</p>}
        {lead.expectedCloseAt && !['won', 'lost'].includes(lead.stage) && <p className="text-[11px] text-slate-400">{t('Close by {d}', { d: formatDate(lead.expectedCloseAt) })}</p>}
      </div>
    </button>
  );
}

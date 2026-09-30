import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Target, ListChecks, Sparkles, Phone, MessageSquare, Trophy, FileSignature,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, useListQuery, bust, prime } from '@/hooks/useQuery';
import { useSessionState } from '@/hooks/useSessionState';
import { useFeature } from '@/hooks/useBilling';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatDateTime } from '@/lib/format';
import {
  Card, Button, Input, Select, Textarea, Modal, EmptyState, Spinner, useToast,
} from '@/components/ui';
import { UpgradeCard } from '@/components/billing/FeatureGate';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import {
  STAGES, STAGE_LABEL, SOURCES, TaskRow, TaskFormModal, LeadLine, AssigneeSelect,
} from './CrmParts';

/* ═══════════════════════════════ LEADS ═══════════════════════════════ */

export function LeadsTab() {
  const { allowed, lockedInfo } = useFeature('crm_leads');
  const toast = useToast();
  const [stage, setStage] = useSessionState('crm:leadStage', 'open');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [openLead, setOpenLead] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const { data: pipe } = useQuery(['crm', 'pipeline'], () => api.get('/crm/pipeline').then((r) => r.data), { enabled: allowed });
  const { rows, loading } = useListQuery(
    ['crm', 'leads', { stage, q: dq }],
    () => api.get('/crm/leads', { params: { stage, q: dq } }),
    { enabled: allowed, onError: (e) => toast.error(e.message) },
  );

  if (!allowed) return <UpgradeCard info={lockedInfo} />;

  return (
    <div className="space-y-4">
      {/* PIPELINE — har stage me kitne, kitne ka */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(pipe || []).map((p) => (
          <button key={p.stage} type="button" onClick={() => setStage(p.stage)}
            className={cn('min-w-[104px] shrink-0 rounded-xl border px-3 py-2 text-left',
              stage === p.stage ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white')}>
            <p className="text-xs text-slate-500">{t(STAGE_LABEL[p.stage])}</p>
            <p className="text-lg font-semibold text-slate-900">{p.count}</p>
            {p.value > 0 && <p className="text-[11px] text-slate-500">{formatMoney(p.value)}{p.weighted > 0 && !['won', 'lost'].includes(p.stage) ? ` · ${t('likely')} ${formatMoney(p.weighted)}` : ''}</p>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Naam, dukaan, phone ya shehar')}
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600" />
        </div>
        <select value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="open">{t('Sab khule')}</option>
          <option value="">{t('Sab')}</option>
          {STAGES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </select>
        <Button icon={Plus} onClick={() => setNewOpen(true)}>{t('Naya lead')}</Button>
      </div>

      <Card padding={false}>
        {loading ? <div className="flex justify-center py-10"><Spinner /></div>
          : !rows.length ? <EmptyState icon={Target} title={t('Koi lead nahi')} message={t('Naya sambhavit grahak mila? "Naya lead" dabaiye.')} />
            : <ul className="divide-y divide-slate-100 px-4">{rows.map((l) => <li key={l._id}><LeadLine lead={l} onOpen={setOpenLead} /></li>)}</ul>}
      </Card>

      <NewLeadModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={(l) => setOpenLead(l)} />
      {openLead && <LeadModal id={openLead._id} onClose={() => setOpenLead(null)} />}
    </div>
  );
}

function NewLeadModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const blank = { name: '', shopName: '', phone: '', city: '', source: 'walkin', expectedValue: '', assignedToUserId: null, nextFollowUpAt: '', note: '' };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setSaving(true);
    try {
      const res = await api.post('/crm/leads', {
        ...f,
        expectedValue: Number(f.expectedValue || 0),
        nextFollowUpAt: f.nextFollowUpAt ? new Date(f.nextFollowUpAt).toISOString() : null,
      });
      toast.success(res.message);
      bust('crm');
      setF(blank);
      onClose();
      onSaved?.(res.data);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('Naya lead')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Rehne dein')}</Button><Button loading={saving} onClick={save}>{t('Banayein')}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('Naam')} required value={f.name} onChange={set('name')} />
          <Input label={t('Dukaan ka naam')} value={f.shopName} onChange={set('shopName')} />
          <Input label={t('Phone')} type="tel" value={f.phone} onChange={set('phone')} />
          <Input label={t('Shehar')} value={f.city} onChange={set('city')} />
          <Select label={t('Kahan se mila')} value={f.source} onChange={set('source')} options={SOURCES.map(([v, l]) => ({ value: v, label: t(l) }))} />
          <Input label={t('Andazan kitne ka dhanda')} type="number" prefix="₹" value={f.expectedValue} onChange={set('expectedValue')} />
        </div>
        <Input label={t('Agla follow-up kab')} type="datetime-local" value={f.nextFollowUpAt} onChange={set('nextFollowUpAt')}
          hint={t('Is din ka kaam apne aap ban jayega')} />
        <AssigneeSelect value={f.assignedToUserId} onChange={(v) => setF({ ...f, assignedToUserId: v })} />
        <Textarea label={t('Note')} rows={2} value={f.note} onChange={set('note')} placeholder={t('Kya chahiye, kya baat hui')} />
      </div>
    </Modal>
  );
}

function LeadModal({ id, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const quotesOn = useFeature('sales_pro').allowed;
  const { data: lead, refetch } = useQuery(['crm', 'lead', id], () => api.get(`/crm/leads/${id}`).then((r) => r.data), { poll: false });
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('call');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  async function call(fn, msg) {
    setBusy(true);
    try {
      const res = await fn();
      prime(['crm', 'lead', id], res.data);
      bust('crm');
      if (msg) toast.success(msg);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  if (!lead) return <Modal open onClose={onClose} title="…"><div className="flex justify-center py-8"><Spinner /></div></Modal>;

  return (
    <Modal open onClose={onClose} size="lg" title={lead.shopName || lead.name}
      description={[lead.shopName && lead.name, lead.phone, lead.city].filter(Boolean).join(' · ')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={lead.stage} disabled={busy}
            onChange={(e) => call(() => api.put(`/crm/leads/${id}`, { stage: e.target.value }), t('Stage badal di'))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {STAGES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
          {lead.phone && <a href={`tel:${lead.phone}`}><Button variant="secondary" icon={Phone}>{t('Call')}</Button></a>}
          {lead.phone && (
            <a href={`https://wa.me/91${String(lead.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" icon={MessageSquare}>WhatsApp</Button>
            </a>
          )}
          {lead.partyId ? (
            <Button variant="secondary" onClick={() => navigate(`/retailers/${lead.partyId}`)}>{t('Retailer dekhein')}</Button>
          ) : (
            <Button icon={Trophy} loading={busy} onClick={() => call(() => api.post(`/crm/leads/${id}/convert`), t('Retailer ban gaya'))}>
              {t('Jeeta — retailer banayein')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label={t('Expected value')} type="number" prefix="₹" defaultValue={lead.expectedValue || ''} key={`v${lead.expectedValue}`}
            onBlur={(e) => Number(e.target.value || 0) !== (lead.expectedValue || 0) && call(() => api.put(`/crm/leads/${id}`, { expectedValue: Number(e.target.value || 0) }), t('Saved'))} />
          <Input label={t('Chance of winning')} type="number" suffix="%" defaultValue={lead.probability ?? ''} key={`p${lead.probability}`}
            onBlur={(e) => e.target.value !== '' && Number(e.target.value) !== lead.probability && call(() => api.put(`/crm/leads/${id}`, { probability: Math.min(100, Math.max(0, Number(e.target.value))) }), t('Saved'))} />
          <Input label={t('Expected closing')} type="date" defaultValue={lead.expectedCloseAt ? String(lead.expectedCloseAt).slice(0, 10) : ''} key={`c${lead.expectedCloseAt}`}
            onBlur={(e) => call(() => api.put(`/crm/leads/${id}`, { expectedCloseAt: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
          <Input label={t('Interested in')} defaultValue={lead.interest || ''} key={`i${lead.interest}`} placeholder={t('Products')}
            onBlur={(e) => e.target.value !== (lead.interest || '') && call(() => api.put(`/crm/leads/${id}`, { interest: e.target.value }), t('Saved'))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {quotesOn && can('orders:create') && (
            <Button variant="secondary" icon={FileSignature} className="self-end"
              onClick={() => navigate(lead.partyId ? `/quotations/new?partyId=${lead.partyId}` : `/quotations/new?leadId=${id}`)}>{t('Make quotation')}</Button>
          )}
          <AssigneeSelect value={lead.assignedToUserId} label={t('Kiske paas')}
            onChange={(v) => call(() => api.put(`/crm/leads/${id}`, { assignedToUserId: v }), t('Lead de diya'))} />
        </div>

        {/* Call ke baad — note aur agla follow-up ek saath */}
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
              <option value="call">{t('Call')}</option><option value="meeting">{t('Meeting')}</option>
              <option value="visit">{t('Visit')}</option><option value="note">{t('Note')}</option>
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Kya baat hui?')}
              className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">{t('Agla follow-up')}</label>
            <input type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <Button size="sm" className="ml-auto" disabled={!note.trim()} loading={busy}
              onClick={() => call(() => api.post(`/crm/leads/${id}/notes`, { text: note, kind, nextFollowUpAt: next ? new Date(next).toISOString() : null }), t('Likh liya'))
                .then(() => { setNote(''); setNext(''); })}>
              {t('Save')}
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{t('Kaam')}</p>
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setTaskOpen(true)}>{t('Kaam jodein')}</Button>
          </div>
          <ul className="divide-y divide-slate-100">
            {(lead.tasks || []).map((tk) => <TaskRow key={tk._id} task={tk} showAssignee onChanged={refetch} />)}
            {!(lead.tasks || []).length && <li className="py-2 text-sm text-slate-500">{t('Koi kaam nahi')}</li>}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-slate-900">{t('Itihaas')}</p>
          <ul className="space-y-2">
            {[...(lead.notes || [])].reverse().map((n) => (
              <li key={n._id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="text-slate-800">{n.text}</p>
                <p className="text-xs text-slate-500">{n.kind !== 'note' && `${t(n.kind === 'call' ? 'Call' : n.kind === 'visit' ? 'Visit' : 'Meeting')} · `}{n.byName} · {formatDateTime(n.at)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <TaskFormModal open={taskOpen} onClose={() => setTaskOpen(false)} onSaved={refetch}
        preset={{ leadId: id, forName: lead.shopName || lead.name, title: `${t('Follow-up')}: ${lead.shopName || lead.name}`, assignedToUserId: lead.assignedToUserId }} />
    </Modal>
  );
}

/* ═══════════════════════════════ KAAM ═══════════════════════════════ */

export function TasksTab() {
  const toast = useToast();
  const canAssign = useFeature('crm_assign').allowed;
  const { isOwner, can } = useAuth();
  const [status, setStatus] = useSessionState('crm:taskStatus', 'open');
  const [assigned, setAssigned] = useSessionState('crm:taskAssigned', '');
  const [newOpen, setNewOpen] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);

  const { data: staff } = useQuery(['crm', 'staff'], () => api.get('/crm/staff').then((r) => r.data), { poll: false, enabled: canAssign });
  const { rows, loading, refetch } = useListQuery(
    ['crm', 'tasks', { status, assigned }],
    () => api.get('/crm/tasks', { params: { status, assigned } }),
    { onError: (e) => toast.error(e.message) },
  );

  async function auto() {
    setAutoBusy(true);
    try {
      const res = await api.post('/crm/auto-tasks');
      toast.success(t('{n} naye follow-up kaam bane', { n: res.data.created }));
      bust('crm');
    } catch (err) { toast.error(err.message); } finally { setAutoBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[['open', 'Khule'], ['done', 'Poore'], ['', 'Sab']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setStatus(v)}
            className={cn('rounded-full px-3 py-1 text-sm', status === v ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>{t(l)}</button>
        ))}
        {canAssign && (
          <select value={assigned} onChange={(e) => setAssigned(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">{t('Sabke')}</option>
            <option value="me">{t('Mere')}</option>
            {(staff || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          {canAssign && (isOwner || can('parties:edit')) && (
            <Button variant="secondary" icon={Sparkles} loading={autoBusy} onClick={auto}>{t('Follow-up kaam apne aap')}</Button>
          )}
          <Button icon={Plus} onClick={() => setNewOpen(true)}>{t('Naya kaam')}</Button>
        </div>
      </div>
      <Card padding={false}>
        {loading ? <div className="flex justify-center py-10"><Spinner /></div>
          : !rows.length ? <EmptyState icon={ListChecks} title={t('Koi kaam nahi')} />
            : <ul className="divide-y divide-slate-100 px-4">{rows.map((tk) => <TaskRow key={tk._id} task={tk} showAssignee={canAssign} onChanged={refetch} />)}</ul>}
      </Card>
      <TaskFormModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={refetch} />
    </div>
  );
}

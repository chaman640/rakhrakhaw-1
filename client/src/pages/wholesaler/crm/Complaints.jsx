import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, AlertTriangle, ArrowLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { useSessionState } from '@/hooks/useSessionState';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatDateTime, formatPhone } from '@/lib/format';
import {
  Card, Button, Input, Select, Textarea, Modal, Badge, Chips, Combobox, EmptyState, Spinner, Pagination, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { useAssignable } from './CrmParts';
import { COMPLAINT_STATUS, COMPLAINT_PRIORITY, COMPLAINT_CATEGORY } from './crmShared';

const StatusBadge = ({ s }) => <Badge tone={COMPLAINT_STATUS[s]?.[1]}>{t(COMPLAINT_STATUS[s]?.[0] || s)}</Badge>;
const PriorityBadge = ({ p }) => <Badge tone={COMPLAINT_PRIORITY[p]?.[1]}>{t(COMPLAINT_PRIORITY[p]?.[0] || p)}</Badge>;

export function ComplaintFormModal({ open, onClose, party = null, onSaved }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { canAssign, staff } = useAssignable();
  const blank = { partyId: party?._id || '', partyName: party?.name || '', invoiceId: '', subject: '', detail: '', category: 'damaged', priority: 'normal', assignedToUserId: '' };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const partyId = party?._id || f.partyId;

  const fetchParties = useCallback(async (q) => {
    const r = await api.get('/parties', { params: { type: 'retailer', q, limit: 15 } });
    return r.data.map((p) => ({ value: p._id, label: p.shopName || p.name, sublabel: formatPhone(p.phone) }));
  }, []);
  const { data: bills } = useQuery(['crm', 'complaintBills', partyId], () => api.get('/invoices', { params: { partyId, limit: 20 } }).then((r) => r.data), { enabled: Boolean(partyId && open), poll: false });

  async function save() {
    setSaving(true);
    try {
      const res = await api.post('/crm/complaints', {
        partyId, invoiceId: f.invoiceId || null, subject: f.subject, detail: f.detail, category: f.category, priority: f.priority,
        ...(f.assignedToUserId ? { assignedToUserId: f.assignedToUserId } : {}),
      });
      toast.success(res.message);
      bust('crm');
      setF(blank);
      onClose();
      if (onSaved) onSaved(res.data); else navigate(`/crm/complaints/${res.data._id}`);
    } catch (e) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('New complaint')} description={party ? party.name : t('Record the customer’s problem and who will solve it')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} disabled={!partyId || f.subject.trim().length < 3} onClick={save}>{t('Save')}</Button></>}>
      <div className="space-y-3">
        {!party && (
          <Combobox label={t('Customer')} required value={f.partyId} display={f.partyName} fetchOptions={fetchParties} placeholder={t('Search customer')}
            onChange={(o) => setF({ ...f, partyId: o?.value || '', partyName: o?.label || '', invoiceId: '' })} />
        )}
        <Input label={t('Problem')} required value={f.subject} onChange={set('subject')} placeholder={t('e.g. 5 of 50 pieces damaged')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t('Type')} value={f.category} onChange={set('category')} options={COMPLAINT_CATEGORY.map(([value, label]) => ({ value, label: t(label) }))} />
          <Select label={t('Priority')} value={f.priority} onChange={set('priority')} options={Object.entries(COMPLAINT_PRIORITY).map(([value, [label]]) => ({ value, label: t(label) }))} />
          <Select label={t('Related bill')} value={f.invoiceId} onChange={set('invoiceId')} disabled={!partyId}
            options={[{ value: '', label: t('None') }, ...(bills || []).map((b) => ({ value: b._id, label: `${b.invoiceNo} · ${formatDate(b.invoiceDate)}` }))]} />
          {canAssign && (
            <Select label={t('Assign to')} value={f.assignedToUserId} onChange={set('assignedToUserId')}
              options={[{ value: '', label: t('Automatic') }, ...staff.map((s) => ({ value: s._id, label: s.name }))]} />
          )}
        </div>
        <Textarea label={t('Details')} rows={3} value={f.detail} onChange={set('detail')} />
      </div>
    </Modal>
  );
}

export function ComplaintsTab() {
  const toast = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useSessionState('crm:cmpStatus', 'open');
  const [priority, setPriority] = useSessionState('crm:cmpPriority', '');
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);
  const { rows, meta, loading } = useListQuery(['crm', 'complaints', { status, priority, page }], () => api.get('/crm/complaints', { params: { status, priority, page } }), { onError: (e) => toast.error(e.message) });
  const c = meta?.counts || {};
  const openCount = (c.new || 0) + (c.assigned || 0) + (c.processing || 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chips value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
          { value: 'open', label: 'Open', count: openCount }, { value: 'resolved', label: 'Resolved', count: c.resolved }, { value: 'closed', label: 'Closed', count: c.closed }, { value: '', label: 'All' },
        ]} />
        <select aria-label={t('Priority')} value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">{t('Any priority')}</option>
          {Object.entries(COMPLAINT_PRIORITY).map(([v, [l]]) => <option key={v} value={v}>{t(l)}</option>)}
        </select>
        <Button icon={Plus} className="ml-auto" onClick={() => setNewOpen(true)}>{t('New complaint')}</Button>
      </div>
      <Card padding={false}>
        {loading && !rows.length ? <div className="flex justify-center py-10"><Spinner /></div>
          : !rows.length ? <EmptyState icon={AlertTriangle} title={t('No complaints here')} />
            : (
              <ul className="divide-y divide-slate-100">
                {rows.map((x) => (
                  <li key={x._id}>
                    <button type="button" onClick={() => navigate(`/crm/complaints/${x._id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{x.subject}</span>
                        <span className="block truncate text-xs text-slate-500">{[x.complaintNo, x.party?.name, formatDate(x.createdAt), x.assignedToName && `→ ${x.assignedToName}`].filter(Boolean).join(' · ')}</span>
                      </span>
                      <PriorityBadge p={x.priority} />
                      <StatusBadge s={x.status} />
                      <ChevronRight size={15} className="shrink-0 text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
      </Card>
      {meta && <Pagination page={page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onChange={setPage} />}
      <ComplaintFormModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

export function ComplaintDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isOwner, can } = useAuth();
  const { canAssign, staff } = useAssignable();
  const { data: c, loading, refetch } = useQuery(['crm', 'complaint', id], () => api.get(`/crm/complaints/${id}`).then((r) => r.data), { poll: false });
  const [resolution, setResolution] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !c) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (!c) return <EmptyState icon={AlertTriangle} title={t('Complaint not found')} action={<Button variant="secondary" onClick={() => navigate('/crm')}>{t('Back to CRM')}</Button>} />;
  const manager = isOwner || can('parties:edit');
  const mine = [String(c.assignedToUserId), String(c.createdBy)].includes(String(user?._id));
  const editable = manager || mine;
  const res = resolution ?? c.resolution;

  async function update(body, msg) {
    setBusy(true);
    try { await api.put(`/crm/complaints/${id}`, body); if (msg) toast.success(msg); setNote(''); bust('crm'); refetch(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  const closed = ['resolved', 'closed'].includes(c.status);

  return (
    <>
      <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} />{t('Back')}</button>
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{c.complaintNo} · {formatDateTime(c.createdAt)}</p>
            <h1 className="text-lg font-semibold text-slate-900">{c.subject}</h1>
            {c.party && <button type="button" onClick={() => navigate(`/crm/customers/${c.party._id}`)} className="text-sm text-brand-700 hover:underline">{c.party.name}</button>}
            {c.invoiceNo && <span className="ml-2 text-sm text-slate-500">· {t('Bill')} <button type="button" className="text-brand-700 hover:underline" onClick={() => navigate(`/invoices/${c.invoiceId}`)}>{c.invoiceNo}</button></span>}
          </div>
          <div className="flex gap-2"><PriorityBadge p={c.priority} /><StatusBadge s={c.status} /></div>
        </div>
        {c.detail && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{c.detail}</p>}
        <p className="mt-2 text-xs text-slate-500">{t(COMPLAINT_CATEGORY.find(([v]) => v === c.category)?.[1] || c.category)}</p>
      </Card>

      {editable && (
        <Card className="mb-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label={t('Status')} value={c.status} disabled={busy}
              onChange={(e) => { const s = e.target.value; if (['resolved', 'closed'].includes(s) && !res.trim()) { toast.error(t('Write what was done to solve it')); return; } update({ status: s, resolution: res }, t('Status updated')); }}
              options={Object.entries(COMPLAINT_STATUS).map(([value, [label]]) => ({ value, label: t(label) }))} />
            <Select label={t('Priority')} value={c.priority} disabled={busy} onChange={(e) => update({ priority: e.target.value })}
              options={Object.entries(COMPLAINT_PRIORITY).map(([value, [label]]) => ({ value, label: t(label) }))} />
            {canAssign && manager ? (
              <Select label={t('Assigned to')} value={c.assignedToUserId || ''} disabled={busy} onChange={(e) => update({ assignedToUserId: e.target.value || null }, t('Assigned'))}
                options={[{ value: '', label: t('Nobody') }, ...staff.map((s) => ({ value: s._id, label: s.name }))]} />
            ) : <div><p className="text-sm font-medium text-slate-700">{t('Assigned to')}</p><p className="mt-2 text-sm">{c.assignedToName || t('Nobody')}</p></div>}
          </div>
          <div className="mt-3"><Textarea label={t('Solution')} rows={2} value={res} onChange={(e) => setResolution(e.target.value)} placeholder={t('e.g. Replaced 5 pieces on next delivery')} /></div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Add an update (optional)')} aria-label={t('Add an update (optional)')}
              className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600" />
            <Button variant="secondary" loading={busy} disabled={!note.trim() && res === c.resolution} onClick={() => update({ resolution: res, ...(note.trim() ? { note } : {}) }, t('Saved'))}>{t('Save')}</Button>
            {!closed && <Button loading={busy} disabled={!res.trim()} onClick={() => update({ status: 'resolved', resolution: res }, t('Marked resolved'))}>{t('Mark resolved')}</Button>}
          </div>
        </Card>
      )}
      {!editable && c.resolution && <Card className="mb-4"><p className="text-sm font-medium text-slate-700">{t('Solution')}</p><p className="mt-1 text-sm">{c.resolution}</p></Card>}

      <Card>
        <p className="mb-2 text-sm font-semibold text-slate-900">{t('History')}</p>
        <ul className="space-y-2">
          {[...c.history].reverse().map((h, i) => (
            <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <p className="text-slate-800">{h.action === 'created' ? t('Complaint registered') : h.action}{h.note && h.action !== h.note && !h.action.includes(h.note) ? ` — ${h.note}` : ''}</p>
              <p className="text-xs text-slate-500">{h.byName} · {formatDateTime(h.at)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

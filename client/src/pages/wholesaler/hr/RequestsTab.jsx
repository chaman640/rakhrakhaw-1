import { useState } from 'react';
import { CalendarDays, Clock, LifeBuoy, Check, X } from 'lucide-react';
import api from '@/lib/api';
import { useListQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatDateTime } from '@/lib/format';
import {
  Card, Button, Badge, Chips, Modal, Textarea, EmptyState, Spinner, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { REQ_TONE, ATT_LABEL, Cap } from './hrShared';

const KIND_ICON = { leave: CalendarDays, correction: Clock, help: LifeBuoy };

export function requestTitle(r) {
  if (r.kind === 'leave') return `${r.leaveType} · ${r.days} ${r.days === 1 ? t('day') : t('days')}`;
  if (r.kind === 'correction') return `${t('Attendance correction')} · ${r.day}`;
  return r.subject;
}
export function requestWhen(r) {
  if (r.kind === 'leave') return r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`;
  if (r.kind === 'correction') return `${t('Mark as')}: ${t(ATT_LABEL[r.wantStatus] || r.wantStatus)}`;
  return Cap(r.category);
}

export function Thread({ req, onSend, busy }) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-2">
      {req.messages?.map((m) => (
        <div key={m._id || m.at} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-slate-500">{m.byName} · {formatDateTime(m.at)}</p>
          <p className="text-slate-800">{m.text}</p>
        </div>
      ))}
      {req.status !== 'closed' && onSend && (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Write a reply')}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600" />
          <Button size="sm" loading={busy} disabled={!text.trim()} onClick={async () => { await onSend(text.trim()); setText(''); }}>{t('Send')}</Button>
        </div>
      )}
    </div>
  );
}

function ReviewModal({ req, onClose, canAct }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  if (!req) return null;

  async function act(action) {
    setBusy(action);
    try {
      const res = await api.post(`/hr/requests/${req._id}/review`, { action, note });
      toast.success(res.message);
      bust('hr');
      setNote('');
      onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  }
  async function reply(text) {
    setBusy('reply');
    try { await api.post(`/hr/requests/${req._id}/messages`, { text }); bust('hr'); onClose(); } catch (err) { toast.error(err.message); } finally { setBusy(''); }
  }

  const pending = req.status === 'pending';
  return (
    <Modal open onClose={onClose} title={requestTitle(req)} description={`${req.name} · ${requestWhen(req)}`}
      footer={!canAct ? null : req.kind === 'help'
        ? (req.status !== 'closed' && <Button loading={busy === 'close'} onClick={() => act('close')}>{t('Mark resolved')}</Button>)
        : (pending && <><Button variant="danger" loading={busy === 'reject'} onClick={() => act('reject')}>{t('Reject')}</Button><Button loading={busy === 'approve'} onClick={() => act('approve')}>{t('Approve')}</Button></>)}>
      <div className="space-y-3 text-sm">
        {req.reason && <div><p className="text-xs font-medium text-slate-500">{t('Reason')}</p><p className="text-slate-800">{req.reason}</p></div>}
        {req.kind === 'leave' && <p className="text-slate-600">{req.paid ? t('Paid leave') : t('Unpaid leave — salary will be deducted')}</p>}
        {req.kind === 'help' ? <Thread req={req} onSend={reply} busy={busy === 'reply'} /> : pending && canAct && (
          <Textarea label={t('Note for the employee (optional)')} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        )}
        {!pending && req.kind !== 'help' && <p className="text-slate-500">{Cap(req.status)} · {req.reviewedByName} · {formatDateTime(req.reviewedAt)}{req.reviewNote ? ` — ${req.reviewNote}` : ''}</p>}
      </div>
    </Modal>
  );
}

export default function RequestsTab({ userId = '' }) {
  const toast = useToast();
  const { can } = useAuth();
  const [status, setStatus] = useState('pending');
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState(null);
  const { rows, loading, data } = useListQuery(['hr', 'requests', status, kind, userId],
    () => api.get('/hr/requests', { params: { status, kind, userId } }));

  async function quick(r, action) {
    try { const res = await api.post(`/hr/requests/${r._id}/review`, { action }); toast.success(res.message); bust('hr'); } catch (err) { toast.error(err.message); }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Chips value={status} onChange={setStatus} options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }, { value: '', label: 'All' }]} />
        <Chips value={kind} onChange={setKind} options={[{ value: '', label: 'All types' }, { value: 'leave', label: 'Leave' }, { value: 'correction', label: 'Corrections' }, { value: 'help', label: 'Help desk' }]} />
      </div>
      {loading && !data ? <div className="flex justify-center py-10"><Spinner /></div>
        : !rows.length ? <EmptyState icon={CalendarDays} title={status === 'pending' ? t('No pending requests') : t('No requests')} message={t('Leave, attendance correction and help requests from employees appear here.')} />
          : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const Icon = KIND_ICON[r.kind];
                return (
                  <li key={r._id} className="flex items-center gap-3 py-3">
                    <button type="button" onClick={() => setOpen(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-ring rounded-lg">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon size={16} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{r.name} — {requestTitle(r)}</span>
                        <span className="block truncate text-xs text-slate-500">{requestWhen(r)}{r.reason ? ` · ${r.reason}` : ''}</span>
                      </span>
                    </button>
                    <Badge tone={REQ_TONE[r.status]}>{Cap(r.status)}</Badge>
                    {r.status === 'pending' && r.kind !== 'help' && can('hr:approve') && (
                      <span className="hidden gap-1 sm:flex">
                        <button type="button" onClick={() => quick(r, 'approve')} aria-label={t('Approve')} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 focus-ring"><Check size={16} /></button>
                        <button type="button" onClick={() => quick(r, 'reject')} aria-label={t('Reject')} className="rounded-lg p-2 text-red-600 hover:bg-red-50 focus-ring"><X size={16} /></button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      <ReviewModal req={open} canAct={can('hr:approve')} onClose={() => setOpen(null)} />
    </Card>
  );
}

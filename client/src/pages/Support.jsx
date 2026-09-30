import { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, LifeBuoy, Paperclip, ChevronRight, X } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { formatDateTime } from '@/lib/format';
import { shrinkImage } from '@/lib/shrinkImage';
import {
  Card, PageHeader, Button, Input, Select, Textarea, Modal, Badge, Spinner, EmptyState, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const CATS = [['account', 'Account & login'], ['billing', 'Plan & payment'], ['sales', 'Sales & bills'], ['purchase', 'Purchase & expenses'], ['stock', 'Items & stock'],
  ['accounts_gst', 'Accounts & GST'], ['hr', 'HR & employees'], ['app_problem', 'App not working'], ['suggestion', 'Suggestion'], ['other', 'Something else']];
const STATUS = { open: ['Open', 'blue'], in_progress: ['In progress', 'brand'], waiting_user: ['Reply needed', 'amber'], resolved: ['Resolved', 'green'], closed: ['Closed', 'slate'] };
const StatusBadge = ({ s }) => <Badge tone={STATUS[s]?.[1]}>{t(STATUS[s]?.[0] || s)}</Badge>;

function Photos({ files, setFiles }) {
  const ref = useRef(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((f, i) => (
        <span key={i} className="relative">
          <img src={URL.createObjectURL(f)} alt="" className="h-14 w-14 rounded-lg object-cover" />
          <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={t('Remove')} className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-800 p-0.5 text-white"><X size={11} /></button>
        </span>
      ))}
      {files.length < 3 && (
        <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><Paperclip size={14} />{t('Add screenshot')}</button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFiles([...files, await shrinkImage(f)]); }} />
    </div>
  );
}

function NewTicket({ open, onClose }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ category: 'other', subject: '', description: '', priority: 'normal' });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.append(k, v));
      files.forEach((x) => fd.append('files', x));
      const res = await api.post('/support', fd);
      toast.success(res.message);
      bust('support');
      onClose();
      navigate(`/support/${res.data._id}`);
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={t('Contact support')} description={t('Our team usually replies within one working day.')}
      footer={<><Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button><Button loading={saving} onClick={save}>{t('Send')}</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t('Topic')} value={f.category} onChange={set('category')} options={CATS.map(([value, label]) => ({ value, label }))} />
          <Select label={t('How urgent?')} value={f.priority} onChange={set('priority')} options={[{ value: 'normal', label: t('Normal') }, { value: 'high', label: t('Urgent — my work is stuck') }]} />
        </div>
        <Input label={t('Subject')} value={f.subject} onChange={set('subject')} placeholder={t('e.g. Bill PDF not opening')} />
        <Textarea label={t('What happened?')} rows={4} value={f.description} onChange={set('description')} placeholder={t('Tell us what you tried and what you expected')} />
        <Photos files={files} setFiles={setFiles} />
      </div>
    </Modal>
  );
}

function Thread({ id }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const { data: tk, loading } = useQuery(['support', id], () => api.get(`/support/${id}`).then((r) => r.data));
  if (loading && !tk) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (!tk) return <EmptyState title={t('Ticket not found')} action={<Button variant="secondary" onClick={() => navigate('/support')}>{t('All tickets')}</Button>} />;
  async function send() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('text', text);
      files.forEach((x) => fd.append('files', x));
      await api.post(`/support/${id}/messages`, fd);
      setText(''); setFiles([]); bust('support');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  async function close() {
    if (!window.confirm(t('Close this ticket? You can open a new one any time.'))) return;
    try { await api.post(`/support/${id}/close`); bust('support'); } catch (err) { toast.error(err.message); }
  }
  return (
    <>
      <PageHeader title={tk.subject} subtitle={`${tk.ticketNo} · ${t(CATS.find(([v]) => v === tk.category)?.[1] || tk.category)}`} action={<StatusBadge s={tk.status} />} />
      <div className="space-y-3">
        {tk.messages.map((m) => (
          <div key={m._id} className={cn('rounded-xl border p-3', m.by === 'admin' ? 'mr-6 border-brand-200 bg-brand-50' : 'ml-6 border-slate-200 bg-white')}>
            <p className="text-xs text-slate-500">{m.by === 'admin' ? `${m.byName} · RakhRakhav` : t('You')} · {formatDateTime(m.at)}</p>
            {m.text && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{m.text}</p>}
            {m.attachments?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{m.attachments.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={t('Attachment')} className="h-20 w-20 rounded-lg object-cover" /></a>)}</div>}
          </div>
        ))}
      </div>
      {tk.status !== 'closed' ? (
        <Card className="mt-4">
          <Textarea label={t('Reply')} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Photos files={files} setFiles={setFiles} />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={close}>{t('Close ticket')}</Button>
              <Button loading={busy} disabled={!text.trim() && !files.length} onClick={send}>{t('Send')}</Button>
            </div>
          </div>
        </Card>
      ) : <p className="mt-4 text-center text-sm text-slate-500">{t('This ticket is closed.')}</p>}
    </>
  );
}

export default function Support() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get('new') === '1');
  const { data, loading } = useQuery(['support', 'list'], () => api.get('/support').then((r) => r.data));
  if (id) return <Thread id={id} />;
  return (
    <>
      <PageHeader title={t('Support')} subtitle={t('Questions or problems with the app? We are here to help.')} action={<Button icon={Plus} onClick={() => setCreating(true)}>{t('New ticket')}</Button>} />
      {loading && !data ? <div className="flex justify-center py-12"><Spinner /></div> : !data?.length ? (
        <EmptyState icon={LifeBuoy} title={t('No tickets yet')} message={t('Raise a ticket and our team will reply here and in your notifications.')} action={<Button onClick={() => setCreating(true)}>{t('Contact support')}</Button>} />
      ) : (
        <Card padding={false}>
          <ul className="divide-y divide-slate-100">
            {data.map((tk) => (
              <li key={tk._id}>
                <button type="button" onClick={() => navigate(`/support/${tk._id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  {tk.userUnread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label={t('New reply')} />}
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{tk.subject}</span><span className="block text-xs text-slate-500">{tk.ticketNo} · {formatDateTime(tk.lastActivityAt)}</span></span>
                  <StatusBadge s={tk.status} />
                  <ChevronRight size={15} className="shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <NewTicket open={creating} onClose={() => { setCreating(false); if (params.get('new')) setParams({}, { replace: true }); }} />
    </>
  );
}

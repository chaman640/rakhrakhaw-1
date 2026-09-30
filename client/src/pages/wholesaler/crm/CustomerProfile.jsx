import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Phone, MessageSquare, MapPin, FileText, ArrowLeft, Receipt, FileSignature, AlertTriangle, BookOpen,
  PhoneCall, Users, CalendarClock, ShoppingCart, IndianRupee, StickyNote, CheckCircle2, Tag, X, Plus, Bell,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useSessionState } from '@/hooks/useSessionState';
import { useAuth } from '@/context/AuthContext';
import { useFeature } from '@/hooks/useBilling';
import { formatMoney, formatPhone, formatDate, formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Tabs, Spinner, EmptyState, Select, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { TaskRow, useAssignable } from './CrmParts';
import {
  SegmentBadges, ScorePill, COMPLAINT_STATUS, COMPLAINT_PRIORITY, daysText,
} from './crmShared';
import { ComplaintFormModal } from './Complaints';
import { STATUS_LABEL as ORDER_STATUS_LABEL } from '../Orders';

const TL_ICON = {
  ledger: IndianRupee, order: ShoppingCart, complaint: AlertTriangle, call: PhoneCall, meeting: Users, visit: MapPin, note: StickyNote, task: CheckCircle2,
};

function NoteBox({ id, onSaved }) {
  const toast = useToast();
  const [kind, setKind] = useState('call');
  const [text, setText] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const res = await api.post(`/crm/customers/${id}/notes`, { kind, text, nextFollowUpAt: next ? new Date(next).toISOString() : null });
      toast.success(res.data.taskId ? t('Saved — follow-up task created') : t('Saved'));
      setText(''); setNext('');
      bust('crm');
      onSaved?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <select aria-label={t('Type')} value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
          <option value="call">{t('Call')}</option><option value="meeting">{t('Meeting')}</option><option value="visit">{t('Visit')}</option><option value="note">{t('Note')}</option>
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('What was discussed?')} aria-label={t('What was discussed?')}
          className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500" htmlFor="nx">{t('Next follow-up')}</label>
        <input id="nx" type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        <Button size="sm" className="ml-auto" disabled={!text.trim()} loading={busy} onClick={save}>{t('Save')}</Button>
      </div>
    </div>
  );
}

function TagEditor({ id, tags, onSaved }) {
  const toast = useToast();
  const [adding, setAdding] = useState('');
  async function save(next) {
    try { await api.put(`/crm/customers/${id}/tags`, { tags: next }); bust('crm'); onSaved?.(); } catch (e) { toast.error(e.message); }
  }
  const presets = ['VIP', 'Regular', 'New', 'Wholesale', 'Retail', 'Credit hold'].filter((p) => !tags.includes(p));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag size={14} className="text-slate-400" />
      {tags.map((tg) => (
        <span key={tg} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {tg}<button type="button" aria-label={t('Remove')} onClick={() => save(tags.filter((x) => x !== tg))}><X size={11} /></button>
        </span>
      ))}
      {tags.length < 10 && (
        <select aria-label={t('Add tag')} value={adding} onChange={(e) => {
          const v = e.target.value;
          if (v === '__custom') { const c = window.prompt(t('New tag')); if (c?.trim()) save([...tags, c.trim().slice(0, 30)]); } else if (v) save([...tags, v]);
          setAdding('');
        }} className="rounded-full border border-dashed border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
          <option value="">+ {t('Tag')}</option>
          {presets.map((p) => <option key={p} value={p}>{t(p)}</option>)}
          <option value="__custom">{t('Custom…')}</option>
        </select>
      )}
    </div>
  );
}

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can, isOwner } = useAuth();
  const { canAssign, staff } = useAssignable();
  const quotesOn = useFeature('sales_pro').allowed;
  const [tab, setTab] = useSessionState('crm:profileTab', 'timeline');
  const [complaintOpen, setComplaintOpen] = useState(false);
  const { data: c, loading, error, refetch } = useQuery(['crm', 'customer', id], () => api.get(`/crm/customers/${id}`).then((r) => r.data), { poll: false });

  if (loading && !c) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (!c) return <EmptyState icon={Users} title={error?.message || t('Customer not found')} action={<Button variant="secondary" onClick={() => navigate('/crm')}>{t('Back to CRM')}</Button>} />;

  async function assign(userId) {
    try { await api.put(`/crm/customers/${id}/assign`, { userId: userId || null }); toast.success(t('Salesman updated')); bust('crm'); refetch(); } catch (e) { toast.error(e.message); }
  }
  const addr = [c.address?.line1, c.city, c.address?.state, c.address?.pincode].filter(Boolean).join(', ');
  const wa = c.phone ? `https://wa.me/91${String(c.phone).replace(/\D/g, '').slice(-10)}` : null;
  const stats = [
    ['Total sale', formatMoney(c.totalSale)],
    ['Outstanding', formatMoney(Math.max(0, c.outstanding)), c.overdue > 0 ? `${formatMoney(c.overdue)} ${t('overdue')}` : null],
    ['Bills', c.bills, c.orders ? `${c.orders} ${t('app orders')}` : null],
    ['Last order', c.lastOrderAt ? formatDate(c.lastOrderAt) : t('Never'), daysText(c.daysSince)],
    ['Buys every', c.avgGapDays ? t('{n} days', { n: c.avgGapDays }) : '—', c.expectedNextAt ? `${t('Next')} ~${formatDate(c.expectedNextAt)}` : null],
    ['Returns', formatMoney(c.returns)],
  ];
  const tabs = [
    { value: 'timeline', label: 'Timeline' },
    { value: 'history', label: 'Purchase history' },
    { value: 'followups', label: `${t('Follow-ups')}${c.openTasks.length ? ` (${c.openTasks.length})` : ''}` },
    { value: 'complaints', label: `${t('Complaints')}${c.complaints.length ? ` (${c.complaints.length})` : ''}` },
  ];

  return (
    <>
      <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} />{t('Back')}</button>
      <Card className="mb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">{(c.shopName || c.name).charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-slate-900">{c.shopName || c.name}</h1>
                <ScorePill score={c.score} />
                <SegmentBadges list={c.segments} />
              </div>
              {c.shopName && <p className="text-sm text-slate-500">{t('Owner')}: {c.name}</p>}
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                {c.phone && <span className="flex items-center gap-1.5"><Phone size={14} />{formatPhone(c.phone)}</span>}
                {addr && <span className="flex items-center gap-1.5"><MapPin size={14} />{addr}</span>}
                {c.gstin && <span className="flex items-center gap-1.5"><FileText size={14} />{c.gstin}</span>}
                {c.territory && <Badge tone="blue">{c.territory}</Badge>}
              </div>
              <div className="mt-2"><TagEditor id={id} tags={c.tags} onSaved={refetch} /></div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {c.phone && <a href={`tel:${c.phone}`}><Button variant="secondary" size="sm" icon={Phone}>{t('Call')}</Button></a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer"><Button variant="secondary" size="sm" icon={MessageSquare}>WhatsApp</Button></a>}
            {can('invoices:create') && <Button size="sm" icon={Receipt} onClick={() => navigate(`/sale/new?party=${id}`)}>{t('New bill')}</Button>}
            {quotesOn && can('orders:create') && <Button size="sm" variant="secondary" icon={FileSignature} onClick={() => navigate(`/quotations/new?partyId=${id}`)}>{t('Quotation')}</Button>}
            <Button size="sm" variant="secondary" icon={AlertTriangle} onClick={() => setComplaintOpen(true)}>{t('Complaint')}</Button>
            {can('khata:view') && <Button size="sm" variant="ghost" icon={BookOpen} onClick={() => navigate(`/retailers/${id}?tab=khata`)}>{t('Ledger')}</Button>}
          </div>
        </div>
        {(canAssign || c.assignedToName) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
            <span className="text-slate-500">{t('Salesman')}:</span>
            {canAssign && (isOwner || can('parties:edit')) ? (
              <div className="w-56"><Select aria-label={t('Salesman')} value={c.assignedToUserId || ''} onChange={(e) => assign(e.target.value)}
                options={[{ value: '', label: t('Not assigned') }, ...staff.map((s) => ({ value: s._id, label: s.name }))]} /></div>
            ) : <b className="text-slate-800">{c.assignedToName || t('Not assigned')}</b>}
          </div>
        )}
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([l, v, sub]) => (
          <Card key={l} className="!p-3">
            <p className="text-xs text-slate-500">{t(l)}</p>
            <p className="truncate text-base font-semibold text-slate-900 tabular-nums">{v}</p>
            {sub && <p className={cn('truncate text-xs', l === 'Outstanding' ? 'text-red-600' : 'text-slate-500')}>{sub}</p>}
          </Card>
        ))}
      </div>

      {c.scoreParts && (
        <Card className="mb-4">
          <CardHeader title={t('Why this score')} subtitle={t('Out of 100 — updated from bills and payments')} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[['value', 'Purchase value', 30], ['frequency', 'Regular orders', 25], ['recency', 'Recent activity', 20], ['payment', 'Pays on time', 15], ['range', 'Product range', 10]].map(([k, l, max]) => (
              <div key={k}>
                <p className="text-xs text-slate-500">{t(l)}</p>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${(c.scoreParts[k] / max) * 100}%` }} /></div>
                <p className="mt-0.5 text-xs tabular-nums text-slate-600">{c.scoreParts[k]}/{max}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {c.reorder?.some((r) => r.due) && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Bell size={16} />{t('Expected re-order coming up')}</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {c.reorder.filter((r) => r.due).map((r) => (
              <li key={r.itemId}>{t('{item}: about {qty} every {n} days — next around {date}', { item: r.name, qty: r.avgQty, n: r.avgGapDays, date: formatDate(r.expectedAt) })}</li>
            ))}
          </ul>
        </Card>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'timeline' && (
        <div className="space-y-3">
          <NoteBox id={id} onSaved={refetch} />
          <Card padding={false}>
            {!c.timeline.length ? <p className="py-8 text-center text-sm text-slate-500">{t('No activity yet')}</p> : (
              <ul className="divide-y divide-slate-100">
                {c.timeline.map((e, i) => {
                  const Icon = TL_ICON[e.kind] || StickyNote;
                  const link = e.kind === 'order' ? `/orders/${e.refId}` : e.kind === 'complaint' ? `/crm/complaints/${e.refId}` : e.refType === 'Invoice' ? `/invoices/${e.refId}` : e.refType === 'ReturnNote' ? `/returns/${e.refId}` : null;
                  return (
                    <li key={i}>
                      <button type="button" disabled={!link} onClick={() => link && navigate(link)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left enabled:hover:bg-slate-50">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon size={14} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-slate-900">{e.kind === 'ledger' ? `${t(e.label)} ${e.refNo}` : e.title}</span>
                          <span className="block text-xs text-slate-500">{[formatDateTime(e.at), e.by, e.status && t(e.kind === 'complaint' ? COMPLAINT_STATUS[e.status]?.[0] : ORDER_STATUS_LABEL[e.status] || e.status), e.nextFollowUpAt && `${t('Follow-up')} ${formatDate(e.nextFollowUpAt)}`].filter(Boolean).join(' · ')}</span>
                        </span>
                        {e.amount !== undefined && e.amount !== 0 && (
                          <span className={cn('shrink-0 text-sm tabular-nums', e.amount < 0 ? 'text-emerald-700' : 'text-slate-900')}>{e.amount < 0 ? '−' : ''}{formatMoney(Math.abs(e.amount))}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {c.topItems.length > 0 && (
            <Card>
              <CardHeader title={t('What they buy most (last 12 months)')} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs text-slate-500"><tr><th className="py-1.5">{t('Item')}</th><th className="text-right">{t('Qty')}</th><th className="text-right">{t('Amount')}</th><th className="text-right">{t('Times')}</th><th className="text-right">{t('Last bought')}</th>{c.reorder && <th className="text-right">{t('Next expected')}</th>}</tr></thead>
                  <tbody>
                    {c.topItems.map((r) => {
                      const ro = c.reorder?.find((x) => x.itemId === r.itemId);
                      return (
                        <tr key={r.itemId} className="border-t border-slate-100">
                          <td className="py-1.5 font-medium text-slate-900">{r.name}</td><td className="text-right tabular-nums">{r.qty}</td><td className="text-right tabular-nums">{formatMoney(r.amount)}</td>
                          <td className="text-right">{r.times}</td><td className="text-right">{formatDate(r.lastAt)}</td>
                          {c.reorder && <td className={cn('text-right', ro?.due && 'font-semibold text-amber-700')}>{ro ? formatDate(ro.expectedAt) : '—'}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <Card padding={false}>
            {!c.history.length ? <p className="py-8 text-center text-sm text-slate-500">{t('No purchases yet')}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2">{t('Date')}</th><th>{t('Bill')}</th><th>{t('Item')}</th><th className="text-right">{t('Qty')}</th><th className="text-right">{t('Rate')}</th><th className="px-4 text-right">{t('Amount')}</th></tr></thead>
                  <tbody>
                    {c.history.map((h, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2">{formatDate(h.date)}</td>
                        <td><button type="button" className="text-brand-700 hover:underline" onClick={() => navigate(`/invoices/${h.invoiceId}`)}>{h.invoiceNo}</button></td>
                        <td>{h.name}</td><td className="text-right tabular-nums">{h.qty} {h.unit}</td><td className="text-right tabular-nums">{formatMoney(h.rate)}</td><td className="px-4 text-right tabular-nums">{formatMoney(h.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'followups' && (
        <div className="space-y-3">
          <NoteBox id={id} onSaved={refetch} />
          <Card padding={false}>
            {!c.openTasks.length ? <p className="py-8 text-center text-sm text-slate-500">{t('No pending follow-ups')}</p>
              : <ul className="divide-y divide-slate-100 px-4">{c.openTasks.map((tk) => <TaskRow key={tk._id} task={tk} showAssignee onChanged={refetch} />)}</ul>}
          </Card>
        </div>
      )}

      {tab === 'complaints' && (
        <Card padding={false}>
          <div className="flex justify-end p-3"><Button size="sm" icon={Plus} onClick={() => setComplaintOpen(true)}>{t('New complaint')}</Button></div>
          {!c.complaints.length ? <p className="pb-8 text-center text-sm text-slate-500">{t('No complaints')}</p> : (
            <ul className="divide-y divide-slate-100">
              {c.complaints.map((x) => (
                <li key={x._id}>
                  <button type="button" onClick={() => navigate(`/crm/complaints/${x._id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{x.subject}</span><span className="block text-xs text-slate-500">{x.complaintNo} · {formatDate(x.createdAt)}</span></span>
                    <Badge tone={COMPLAINT_PRIORITY[x.priority]?.[1]}>{t(COMPLAINT_PRIORITY[x.priority]?.[0])}</Badge>
                    <Badge tone={COMPLAINT_STATUS[x.status]?.[1]}>{t(COMPLAINT_STATUS[x.status]?.[0])}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ComplaintFormModal open={complaintOpen} onClose={() => setComplaintOpen(false)} party={{ _id: id, name: c.shopName || c.name }} onSaved={() => { refetch(); setTab('complaints'); }} />
      <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-400"><CalendarClock size={12} />{t('Customer since {d}', { d: formatDate(c.createdAt) })}</p>
    </>
  );
}

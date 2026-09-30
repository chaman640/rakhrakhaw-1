import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Send, Check, X, Pencil, Copy, ShoppingCart, Printer, Trash2, MessageSquare,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatDate } from '@/lib/format';
import {
  Card, Button, Badge, Input, Select, Modal, ConfirmModal, Spinner, EmptyState, useToast,
} from '@/components/ui';
import DocSheet from '@/components/sales/DocSheet';
import { t } from '@/lib/i18n';
import { QUOTE_STATUS } from './quoteShared';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const { data: q, loading, refetch } = useQuery(['quotations', id], () => api.get(`/quotations/${id}`).then((r) => r.data), { poll: false });
  const [busy, setBusy] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [convOpen, setConvOpen] = useState(false);
  const [conv, setConv] = useState({ expectedDeliveryAt: '', paymentMode: 'UDHAAR' });
  const [delOpen, setDelOpen] = useState(false);

  if (loading && !q) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (!q) return <EmptyState title={t('Quotation not found')} action={<Button variant="secondary" onClick={() => navigate('/quotations')}>{t('All quotations')}</Button>} />;

  async function act(key, fn, after) {
    setBusy(key);
    try { const res = await fn(); toast.success(res.message); bust('quotations', 'crm', 'orders'); if (after) after(res.data); else refetch(); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  }
  const status = (s, extra = {}) => act(s, () => api.post(`/quotations/${id}/status`, { status: s, ...extra }));
  const editable = ['draft', 'sent'].includes(q.status) && can('orders:edit');
  const canConvert = ['sent', 'accepted'].includes(q.status) && can('orders:create');
  const phone = String(q.customer?.phone || '').replace(/\D/g, '').slice(-10);
  const waText = encodeURIComponent(`${t('Quotation')} ${q.quoteNo} — ${q.business?.name}\n${q.items.map((l) => `• ${l.name}: ${l.qty} ${l.unit} × ₹${l.rate}${l.discountPct ? ` (-${l.discountPct}%)` : ''}`).join('\n')}\n${t('Total')}: ₹${q.total}${q.validUntil ? `\n${t('Valid until')} ${formatDate(q.validUntil)}` : ''}`);

  return (
    <>
      <button type="button" onClick={() => navigate('/quotations')} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 no-print"><ArrowLeft size={15} />{t('All quotations')}</button>
      <Card className="mb-4 no-print">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold text-slate-900">{q.quoteNo}</h1><Badge tone={QUOTE_STATUS[q.status]?.[1]}>{t(QUOTE_STATUS[q.status]?.[0])}</Badge></div>
            <p className="mt-1 text-sm text-slate-600">
              {q.partyId ? <Link className="text-brand-700 hover:underline" to={`/crm/customers/${q.partyId}`}>{q.customer?.shopName || q.customer?.name}</Link> : `${q.customer?.shopName || q.customer?.name} (${t('lead')})`}
              {' · '}{formatMoney(q.total)}{q.validUntil ? ` · ${t('valid till')} ${formatDate(q.validUntil)}` : ''}
            </p>
            {q.rejectReason && <p className="mt-1 text-sm text-red-700">{q.rejectReason}</p>}
            {q.orderId && <Link to={`/orders/${q.orderId}`} className="mt-1 inline-block text-sm font-medium text-brand-700 hover:underline">{t('Open sales order →')}</Link>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>{t('Print / PDF')}</Button>
            {phone && <a href={`https://wa.me/91${phone}?text=${waText}`} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary" icon={MessageSquare}>WhatsApp</Button></a>}
            {editable && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => navigate(`/quotations/${id}/edit`)}>{t('Edit')}</Button>}
            {q.status !== 'converted' && can('orders:create') && <Button size="sm" variant="ghost" icon={Copy} loading={busy === 'rev'} onClick={() => act('rev', () => api.post(`/quotations/${id}/revise`), (d) => navigate(`/quotations/${d._id}`))}>{t('Revise')}</Button>}
            {q.status === 'draft' && can('orders:delete') && <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDelOpen(true)}>{t('Delete')}</Button>}
          </div>
        </div>
        {can('orders:edit') && ['draft', 'expired', 'sent', 'accepted'].includes(q.status) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
            {['draft', 'expired'].includes(q.status) && <Button icon={Send} loading={busy === 'sent'} onClick={() => status('sent')}>{t('Mark as sent')}</Button>}
            {q.status === 'sent' && <Button variant="secondary" icon={Check} loading={busy === 'accepted'} onClick={() => status('accepted')}>{t('Customer accepted')}</Button>}
            {['sent', 'accepted'].includes(q.status) && <Button variant="ghost" icon={X} onClick={() => setRejectOpen(true)}>{t('Customer rejected')}</Button>}
            {canConvert && <Button icon={ShoppingCart} onClick={() => setConvOpen(true)}>{t('Create sales order')}</Button>}
            {q.status === 'draft' && <p className="text-sm text-slate-500">{t('Share it (print or WhatsApp), then mark it sent — you’ll get a follow-up reminder if there’s no reply.')}</p>}
          </div>
        )}
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <DocSheet visible title={'Quotation'} no={q.quoteNo} date={q.quoteDate} business={q.business} party={q.customer}
          rows={q.items} signLabels={['Customer’s acceptance', 'Authorised signatory']}
          meta={[['Valid until', q.validUntil && formatDate(q.validUntil)], ['Payment', q.paymentTerms], ['Delivery', q.deliveryTerms]]}
          totals={[['Sub-total', formatMoney(q.subTotal)], ...(q.discountTotal ? [['Discount', `−${formatMoney(q.discountTotal)}`]] : []), ...(q.taxTotal ? [['GST', formatMoney(q.taxTotal)]] : []), ['Total', formatMoney(q.total), true]]}
          notes={[['Note', q.notes], ['Terms & conditions', q.terms]]} />
      </div>

      {q.revisions?.length > 0 && (
        <Card className="mt-4 no-print">
          <p className="mb-2 text-sm font-semibold text-slate-900">{t('Other versions')}</p>
          <ul className="space-y-1 text-sm">{q.revisions.map((r) => <li key={r._id}><Link className="text-brand-700 hover:underline" to={`/quotations/${r._id}`}>{r.quoteNo}</Link> · {formatMoney(r.total)} · {t(QUOTE_STATUS[r.status]?.[0])}</li>)}</ul>
        </Card>
      )}

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title={t('Customer rejected')}
        footer={<><Button variant="secondary" onClick={() => setRejectOpen(false)}>{t('Cancel')}</Button><Button variant="danger" loading={busy === 'rejected'} onClick={() => { setRejectOpen(false); status('rejected', { reason }); }}>{t('Mark rejected')}</Button></>}>
        <Input label={t('Reason (optional)')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('e.g. Price too high, bought elsewhere')} />
      </Modal>
      <Modal open={convOpen} onClose={() => setConvOpen(false)} title={t('Create sales order')}
        description={q.partyId ? undefined : t('This lead will be added as a customer.')}
        footer={<><Button variant="secondary" onClick={() => setConvOpen(false)}>{t('Cancel')}</Button><Button loading={busy === 'conv'} onClick={() => act('conv', () => api.post(`/quotations/${id}/convert`, { paymentMode: conv.paymentMode, expectedDeliveryAt: conv.expectedDeliveryAt ? new Date(conv.expectedDeliveryAt).toISOString() : null }), (d) => navigate(`/orders/${d.order._id}`))}>{t('Create order')}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('Expected delivery')} type="date" value={conv.expectedDeliveryAt} onChange={(e) => setConv({ ...conv, expectedDeliveryAt: e.target.value })} />
          <Select label={t('Payment')} value={conv.paymentMode} onChange={(e) => setConv({ ...conv, paymentMode: e.target.value })}
            options={[{ value: 'UDHAAR', label: t('Credit') }, { value: 'CASH', label: t('Cash') }, { value: 'UPI', label: 'UPI' }]} />
        </div>
        <p className="mt-3 text-sm text-slate-500">{t('Quoted rates (after discount) are copied to the order. Stock reduces only when the bill is made.')}</p>
      </Modal>
      <ConfirmModal open={delOpen} onClose={() => setDelOpen(false)} loading={busy === 'del'} title={t('Delete this draft?')} message={q.quoteNo} confirmLabel={t('Delete')}
        onConfirm={() => act('del', () => api.delete(`/quotations/${id}`), () => navigate('/quotations', { replace: true }))} />
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Package, Phone, XCircle, CheckCircle2, Pencil, Save, X,
  TriangleAlert, FileText, Printer, Store } from
'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatQty, formatDateTime, formatPhone } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Spinner, ConfirmModal, Modal, Textarea,
  QtyStepper, ReadLineItem, ReadField, useToast } from
'@/components/ui';
import { STATUS_TONE, STATUS_LABEL } from '../Orders';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const FLOW = ['PLACED', 'PACKED', 'READY', 'DELIVERED'];

const NEXT_ACTION = {
  PACKED: { label: 'Pack shuru karein', tone: 'primary' },
  READY: { label: 'Tayyar mark karein', tone: 'success' },
  DELIVERED: { label: 'De diya mark karein', tone: 'success' }
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      toast.error(err.message);
      navigate('/orders', { replace: true });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {load();}, [load]);

  async function setStatus(status) {
    setBusy(true);
    try {
      const res = await api.post(`/orders/${id}/status`, { status });
      setOrder(res.data);
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      const res = await api.post(`/orders/${id}/cancel`, { reason: cancelReason });
      setOrder(res.data);
      toast.success(res.message);
      setConfirmCancel(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  if (!order) return null;

  const cancelled = order.status === 'CANCELLED';
  const closed = cancelled || order.status === 'DELIVERED';
  const currentStep = FLOW.indexOf(order.status);
  const nextStatus = order.nextStatuses?.find((s) => s !== 'CANCELLED');

  return (
    <>
      {/* ---- Header ---- */}
      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{order.orderNo}</h1>
              <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{t("{a0} · {a1} item · {a2}", { a0:
                formatDateTime(order.createdAt), a1: order.itemCount, a2: formatMoney(order.itemsTotal) })}
            </p>

            {order.party &&
            <Link to={`/retailers/${order.partyId}`}
            className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100">
                <Store size={15} className="text-slate-400" />
                <span className="font-medium text-slate-900">
                  {order.party.shopName || order.party.name}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Phone size={13} /> {formatPhone(order.party.phone)}
                </span>
              </Link>
            }
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 no-print">
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>{t('Print')}</Button>
            {!closed &&
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
                {t('Quantity badlein')}
              </Button>
            }
            {!closed &&
            <Button variant="danger" size="sm" icon={XCircle} onClick={() => setConfirmCancel(true)}>
                {t('Cancel')}
              </Button>
            }
          </div>
        </div>

        {/* ---- Status flow ---- */}
        {!cancelled &&
        <div className="mt-6 flex items-center">
            {FLOW.map((step, i) =>
          <div key={step} className={cn('flex flex-1 items-center', i === FLOW.length - 1 && 'flex-none')}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                i <= currentStep ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'
              )}>
                    {i < currentStep ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  <span className={cn('text-center text-[11px] leading-tight',
              i <= currentStep ? 'font-medium text-slate-900' : 'text-slate-400')}>
                    {STATUS_LABEL[step]}
                  </span>
                </div>
                {i < FLOW.length - 1 &&
            <div className={cn('mx-1 mb-5 h-0.5 flex-1',
            i < currentStep ? 'bg-brand-600' : 'bg-slate-200')} />
            }
              </div>
          )}
          </div>
        }

        {cancelled &&
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">{t("Ye order cancel ho gaya{a0}.", { a0:
            order.cancelReason ? ` — ${order.cancelReason}` : '' })}
        </p>
        }

        {/* ---- Next action ---- */}
        {nextStatus &&
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 no-print">
            <Button size="lg" loading={busy} onClick={() => setStatus(nextStatus)}
          variant={NEXT_ACTION[nextStatus]?.tone || 'primary'}>
              {NEXT_ACTION[nextStatus]?.label || nextStatus}
            </Button>
            <p className="text-sm text-slate-500">
              {nextStatus === 'READY' ?
            'Retailer ko turant khabar chali jayegi' :
            nextStatus === 'DELIVERED' ?
            'Bill Part 8 me yahin se ban jayega' :
            'Retailer ko dikh jayega ki kaam shuru ho gaya'}
            </p>
          </div>
        }

        {!cancelled &&
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 no-print">
            {order.invoiceId ?
          <>
                <Link to={`/invoices/${order.invoiceId}`}>
                  <Button size="lg" variant="secondary" icon={FileText}>{t('Bill dekhein')}</Button>
                </Link>
                <p className="text-sm text-slate-500">{t('Is order ka bill ban chuka hai')}</p>
              </> :

          <>
                <Button size="lg" icon={FileText}
            onClick={() => navigate(`/invoices/new?order=${order._id}`)}>
                  {t('Bill banayein')}
                </Button>
                <p className="text-sm text-slate-500">
                  {t('Bill banate hi stock ghatega aur retailer ke khate me udhaar chadhega')}
                </p>
              </>
          }
          </div>
        }
      </Card>

      {/* ---- Stock warning ---- */}
      {!closed && !order.canFulfil &&
      <Card className="mb-5 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-medium text-amber-900">{t("{a0} item ka stock poora nahi hai", { a0:
                order.shortLines })}
            </p>
              <p className="mt-0.5 text-sm text-amber-800">
                {t('Neeche list me laal me dikha hai. "Quantity badlein" se utna kar dein jitna bhej sakte hain — retailer ko apne aap pata chal jayega.')}
              </p>
            </div>
          </div>
        </Card>
      }

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding={false}>
          <div className="px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">{t('Order ka saman')}</h3>
            <p className="mt-0.5 text-sm text-slate-500">{t('Har item ke saamne abhi ka stock bhi dikha hai')}</p>
          </div>

          {/* Badi screen — table */}
          <div className="hidden overflow-x-auto border-t border-slate-200 md:block">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 text-left font-semibold">{t('Item')}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t('Mangi')}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t('Abhi stock')}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t('Rate')}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{t('Total')}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, i) =>
                <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <Package size={14} />
                        </div>
                        <span className="font-medium text-slate-900">{it.name}</span>
                      </div>
                    </td>
                    <td className="tabular px-4 py-3 text-right">{formatQty(it.qty, it.unit)}</td>
                    <td className="px-4 py-3 text-right">
                      {it.itemGone ?
                    <Badge tone="red">{t('Item hat gaya')}</Badge> :

                    <span className={cn('tabular', it.enough ? 'text-slate-600' : 'font-medium text-red-600')}>
                          {formatQty(it.currentStock, it.unit)}
                        </span>
                    }
                    </td>
                    <td className="tabular px-4 py-3 text-right">{formatMoney(it.rate)}</td>
                    <td className="tabular px-4 py-3 text-right font-medium">{formatMoney(it.amount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Phone — har item ki apni line */}
          <div className="divide-y divide-slate-100 border-t border-slate-200 md:hidden">
            {order.items.map((it, i) =>
            <ReadLineItem key={i} title={it.name} total={formatMoney(it.amount)}>
                <ReadField label={t('Mangi')} value={formatQty(it.qty, it.unit)} />
                <ReadField label={t('Rate')} value={formatMoney(it.rate)} />
                {it.itemGone ?
              <div className="flex gap-1.5">
                    <dt className="text-slate-400">{t('Stock')}</dt>
                    <dd><Badge tone="red">{t('Item hat gaya')}</Badge></dd>
                  </div> :

              <ReadField label={t('Abhi stock')} value={formatQty(it.currentStock, it.unit)}
              tone={it.enough ? undefined : 'red'} />
              }
              </ReadLineItem>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <span className="font-semibold text-slate-900">{t('Kul')}</span>
            <span className="tabular text-xl font-semibold text-slate-900">{formatMoney(order.itemsTotal)}</span>
          </div>

          {order.retailerNote &&
          <p className="border-t border-slate-200 px-5 py-3 text-sm text-slate-700">
              <span className="text-slate-500">{t('Retailer ka note:')}</span> {order.retailerNote}
            </p>
          }
        </Card>

        <Card>
          <CardHeader title={t('Kya kya hua')} />
          <ol className="space-y-4">
            {[...(order.statusHistory || [])].reverse().map((h, i) =>
            <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn('h-2.5 w-2.5 rounded-full', i === 0 ? 'bg-brand-600' : 'bg-slate-300')} />
                  {i < order.statusHistory.length - 1 && <div className="mt-1 w-px flex-1 bg-slate-200" />}
                </div>
                <div className="pb-1">
                  <p className="text-sm font-medium text-slate-900">{STATUS_LABEL[h.status]}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(h.at)}</p>
                  {h.note && <p className="mt-0.5 text-xs text-slate-500">{h.note}</p>}
                </div>
              </li>
            )}
          </ol>
        </Card>
      </div>

      <EditItemsModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        order={order}
        onSaved={(o) => {setOrder(o);setEditOpen(false);}} />
      

      <ConfirmModal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        loading={busy}
        title={`${order.orderNo} cancel karein?`}
        message={t('Retailer ko turant khabar chali jayegi. Cancel kiya hua order wapas nahi aata.')}
        confirmLabel={t("Haan, cancel karein")} />
      
    </>);

}

/* ------------------------------------------------------------- edit qty */

function EditItemsModal({ open, onClose, order, onSaved }) {
  const toast = useToast();
  const [qtys, setQtys] = useState({});
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQtys(Object.fromEntries(order.items.map((i) => [String(i.itemId), i.qty])));
    setNote('');
  }, [open, order]);

  const total = order.items.reduce((s, i) => {
    const q = Number(qtys[String(i.itemId)] ?? i.qty);
    return s + (q > 0 ? q * i.rate : 0);
  }, 0);

  async function save() {
    setSaving(true);
    try {
      const res = await api.put(`/orders/${order._id}/items`, {
        items: order.items.map((i) => ({ itemId: i.itemId, qty: Number(qtys[String(i.itemId)] ?? i.qty) })),
        note
      });
      toast.success(res.message);
      onSaved(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('Quantity badlein')}
      description={t('Jitna bhej sakte hain utna kar dein — 0 karne pe item order se hat jayega')}
      footer={
      <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={save} loading={saving} icon={Save}>{t('Save karein')}</Button>
        </>
      }>
      
      <div className="space-y-4">
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {order.items.map((it) => {
            const q = qtys[String(it.itemId)] ?? it.qty;
            const short = it.currentStock !== null && Number(q) > it.currentStock;
            return (
              <li key={String(it.itemId)} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{it.name}</p>
                  <p className="text-xs text-slate-500">
                    {t('Mangi {q} · abhi stock', { q: formatQty(it.qty, it.unit) })}{' '}
                    <span className={cn(it.enough ? '' : 'font-medium text-red-600')}>
                      {it.itemGone ? '—' : formatQty(it.currentStock, it.unit)}
                    </span>
                  </p>
                </div>

                <QtyStepper
                  value={q}
                  onChange={(v) => setQtys((s) => ({ ...s, [String(it.itemId)]: v }))}
                  min={0}
                  size="sm"
                  unit={it.unit}
                  label={`${it.name} quantity`} />
                

                <div className="w-24 text-right">
                  {Number(q) > 0 ?
                  <span className={cn('tabular text-sm font-medium',
                  short ? 'text-amber-700' : 'text-slate-900')}>
                      {formatMoney(Number(q) * it.rate)}
                    </span> :

                  <span className="text-xs text-red-600">{t('Hat jayega')}</span>
                  }
                </div>
              </li>);

          })}
        </ul>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="font-medium text-slate-900">{t('Naya total')}</span>
          <span className="tabular text-lg font-semibold text-slate-900">{formatMoney(total)}</span>
        </div>

        <Textarea label={t('Retailer ko kya batayein')} rows={2} value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('Bearing sirf 6 hai, baaki agle hafte')} />
      </div>
    </Modal>);

}

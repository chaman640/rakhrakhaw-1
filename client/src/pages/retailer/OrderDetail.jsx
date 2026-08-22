import { useCallback, useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Package, XCircle, Store, Clock, Receipt } from 'lucide-react';
import api from '@/lib/api';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty, formatDateTime } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Spinner, ConfirmModal, useToast } from
'@/components/ui';
import { STATUS_TONE, STATUS_LABEL } from './MyOrders';
import { cn } from '@/lib/cn';

const FLOW = ['PLACED', 'PACKED', 'READY', 'DELIVERED'];

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { business } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const isNew = params.get('new') === '1';

  const load = useCallback(async (chupChaap = false) => {
    // `chupChaap` — apne aap taaza hote waqt skeleton mat dikhao (useAutoRefresh.js)
    if (!chupChaap) setLoading(true);
    try {
      const res = await api.get(`/my-orders/${id}`);
      setOrder(res.data);
    } catch (err) {
      toast.error(err.message);
      navigate('/my-orders', { replace: true });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {load();}, [load]);
  // Bina refresh dabaye screen khud taaza — wajah useAutoRefresh.js me
  useAutoRefresh(load);

  async function cancel() {
    setBusy(true);
    try {
      const res = await api.post(`/my-orders/${id}/cancel`);
      setOrder(res.data);
      toast.success(res.message);
      setConfirm(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  if (!order) return null;

  const cancelled = order.status === 'CANCELLED';
  const currentStep = FLOW.indexOf(order.status);

  return (
    <>
      {isNew &&
      <Card className="mb-5 border-emerald-200 bg-emerald-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-medium text-emerald-900">{t("Order chala gaya!")}</p>
              <p className="mt-0.5 text-sm text-emerald-800">{t("{a0} ko aapka order mil gaya hai. Tayyar hote hi aapko yahin status dikh jayega.", { a0:
                business?.name || 'Wholesaler' })}

            </p>
            </div>
          </div>
        </Card>
      }

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{order.orderNo}</h1>
              <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">{t("{a0} · {a1} item", { a0:
                formatDateTime(order.orderDate || order.createdAt), a1: order.itemCount })}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {order.invoiceId &&
            <Link to={`/my-bills/${order.invoiceId}`}>
                <Button variant="secondary" size="sm" icon={Receipt}>{t("Bill dekhein")}</Button>
              </Link>
            }
            {order.status === 'PLACED' &&
            <Button variant="secondary" size="sm" icon={XCircle} onClick={() => setConfirm(true)}>{t("Order cancel karein")}

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
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">{t("Ye order cancel ho gaya tha{a0}.", { a0:
            order.cancelReason ? ` — ${order.cancelReason}` : '' })}
        </p>
        }

        {order.retailerNote &&
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{t("Aapka note: {a0}", { a0:
            order.retailerNote })}
        </p>
        }
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding={false}>
          <div className="px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">{t("Order ka saman")}</h3>
          </div>
          <ul className="divide-y divide-slate-100 border-t border-slate-200">
            {order.items.map((it, i) =>
            <li key={i} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <Package size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{it.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatQty(it.qty, it.unit)} × {formatMoney(it.rate)}
                  </p>
                </div>
                <span className="tabular shrink-0 font-medium text-slate-900">{formatMoney(it.amount)}</span>
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <span className="font-semibold text-slate-900">{t("Kul")}</span>
            <span className="tabular text-xl font-semibold text-slate-900">{formatMoney(order.itemsTotal)}</span>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("Kya kya hua")} />
          <ol className="space-y-4">
            {[...(order.statusHistory || [])].reverse().map((h, i) =>
            <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={cn('h-2.5 w-2.5 rounded-full',
                i === 0 ? 'bg-brand-600' : 'bg-slate-300')} />
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

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <Clock size={13} className="mt-0.5 shrink-0" />
              {order.invoiceId ?
              'Is order ka bill ban chuka hai — upar "Bill dekhein" dabaein.' :
              `Bill order ke saath nahi banta — ${business?.name || 'wholesaler'} maal dete waqt banayenge.`}
            </p>
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={cancel}
        loading={busy}
        title={t("Order cancel karein?")}
        message={t("Ye order wapas nahi aayega. Zarurat ho to naya order kar sakte hain.")}
        confirmLabel={t("Haan, cancel karein")} />
      
    </>);

}

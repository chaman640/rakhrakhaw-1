import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Trash2, Truck, Package, Printer, Undo2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty, formatDate, formatPhone } from '@/lib/format';
import {
  Card, CardHeader, Button, Badge, Spinner, ConfirmModal,
  ReadLineItem, ReadField, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';

const payTone = { unpaid: 'red', partial: 'amber', paid: 'green' };
const payLabel = { unpaid: 'Poora udhaar', partial: 'Kuch diya', paid: 'Poora diya' };

export default function PurchaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { gstEnabled } = useAuth();

  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/purchases/${id}`);
      setP(res.data);
    } catch (err) {
      toast.error(err.message);
      navigate('/purchases', { replace: true });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function remove() {
    setBusy(true);
    try {
      const res = await api.delete(`/purchases/${id}`);
      toast.success(res.message);
      navigate('/purchases', { replace: true });
    } catch (err) {
      toast.error(err.message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  if (!p) return null;

  return (
    <>
      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{p.purchaseNo}</h1>
              <Badge tone={payTone[p.paymentStatus]}>{payLabel[p.paymentStatus]}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(p.purchaseDate)}
              {p.supplierBillNo && ` · Supplier bill: ${p.supplierBillNo}`}
            </p>
            {p.supplier && (
              <Link to={`/suppliers/${p.supplierId}`}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100">
                <Truck size={15} className="text-slate-400" />
                <span className="font-medium text-slate-900">{p.supplier.shopName || p.supplier.name}</span>
                <span className="text-slate-500">{formatPhone(p.supplier.phone)}</span>
              </Link>
            )}
          </div>

          {/* Phone pe teen button ek line me nahi aate — Delete bahar nikal
              jata tha. Isliye chhoti screen pe wrap, badi pe pehle jaisa. */}
          <div className="flex flex-wrap gap-2 no-print sm:shrink-0">
            <Button variant="secondary" size="sm" icon={Undo2}
              onClick={() => navigate(`/returns/new?type=PURCHASE_RETURN&doc=${p._id}`)}>
              Maal wapas bheja
            </Button>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print</Button>
            <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirm(true)}>Delete</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding={false}>
          <div className="px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">Maal</h3>
          </div>
          {/* Badi screen — table */}
          <div className="hidden overflow-x-auto border-t border-slate-200 md:block">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 text-left font-semibold">Item</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Qty</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
                  {gstEnabled && <th className="px-4 py-2.5 text-right font-semibold">GST</th>}
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{it.name}</p>
                      {it.discount > 0 && (
                        <p className="text-xs text-emerald-700">Discount {formatMoney(it.discount)}</p>
                      )}
                    </td>
                    <td className="tabular px-4 py-3 text-right">{formatQty(it.qty, it.unit)}</td>
                    <td className="tabular px-4 py-3 text-right">{formatMoney(it.rate)}</td>
                    {gstEnabled && (
                      <td className="tabular px-4 py-3 text-right text-slate-500">
                        {it.gstRate}% · {formatMoney(it.taxAmount)}
                      </td>
                    )}
                    <td className="tabular px-4 py-3 text-right font-medium">{formatMoney(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone — har item ki apni line */}
          <div className="divide-y divide-slate-100 border-t border-slate-200 md:hidden">
            {p.items.map((it, i) => (
              <ReadLineItem
                key={i}
                title={it.name}
                total={formatMoney(it.total)}
                sub={it.discount > 0 && (
                  <p className="text-xs text-emerald-700">Discount {formatMoney(it.discount)}</p>
                )}
              >
                <ReadField label="Qty" value={formatQty(it.qty, it.unit)} />
                <ReadField label="Rate" value={formatMoney(it.rate)} />
                {gstEnabled && (
                  <ReadField label="GST" value={`${it.gstRate}% · ${formatMoney(it.taxAmount)}`} />
                )}
              </ReadLineItem>
            ))}
          </div>

          {p.notes && (
            <p className="border-t border-slate-200 px-5 py-3 text-sm text-slate-600">{p.notes}</p>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Hisaab" />
            <dl className="space-y-2 text-sm">
              <Row label="Kul maal" value={formatMoney(p.subTotal)} />
              {p.discountTotal > 0 && <Row label="Discount" value={`− ${formatMoney(p.discountTotal)}`} tone="green" />}
              {gstEnabled && <Row label="GST" value={formatMoney(p.taxTotal)} />}
              {p.roundOff !== 0 && <Row label="Round off" value={formatMoney(p.roundOff)} tone="muted" />}
              <div className="!mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">Kul</dt>
                <dd className="tabular text-xl font-semibold text-slate-900">{formatMoney(p.grandTotal)}</dd>
              </div>
              <Row label="Diya" value={formatMoney(p.paidAmount)} tone="green" />
              <div className={cn('flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                p.dueAmount > 0 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}>
                <span>{p.dueAmount > 0 ? 'Baaki' : 'Poora ho gaya'}</span>
                <strong className="tabular">{formatMoney(p.dueAmount)}</strong>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Stock pe asar" subtitle="Is purchase se kitna maal badha" />
            <ul className="divide-y divide-slate-100">
              {p.movements?.length ? p.movements.map((m) => {
                const line = p.items.find((it) => String(it.itemId) === String(m.itemId));
                return (
                  <li key={m._id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Package size={15} className="shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-slate-700">{line?.name || 'Item'}</span>
                    <Badge tone="green">+{m.qty}</Badge>
                    <span className="tabular shrink-0 text-xs text-slate-500">→ {m.balanceAfter}</span>
                  </li>
                );
              }) : (
                <li className="py-3 text-sm text-slate-500">Koi movement record nahi</li>
              )}
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        loading={busy}
        title={`${p.purchaseNo} delete karein?`}
        message="Stock utna hi wapas ghat jayega aur supplier ka khata bhi ulta ho jayega. Agar wo maal bik chuka hai to delete nahi hoga."
        confirmLabel="Haan, delete karein"
      />
    </>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('tabular',
        tone === 'green' ? 'text-emerald-700' : tone === 'muted' ? 'text-slate-400' : 'text-slate-900')}>
        {value}
      </dd>
    </div>
  );
}

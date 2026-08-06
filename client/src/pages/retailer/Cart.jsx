import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, ShoppingCart, Package, TriangleAlert, Send, Store, Tag,
} from 'lucide-react';
import api from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, Button, Badge, Textarea, Spinner,
  EmptyState, ConfirmModal, QtyStepper, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';

export default function Cart() {
  const toast = useToast();
  const navigate = useNavigate();
  const { business } = useAuth();
  const { refresh: refreshCart } = useCart();

  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [busyItem, setBusyItem] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/cart');
      setCart(res.data);
      setNote(res.data.note || '');
      res.data.warnings?.forEach((w) => toast.info(w.message));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setQty(itemId, qty) {
    setBusyItem(itemId);
    try {
      const res = await api.put(`/cart/items/${itemId}`, { qty });
      setCart(res.data);
      await refreshCart();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(itemId) {
    setBusyItem(itemId);
    try {
      const res = await api.delete(`/cart/items/${itemId}`);
      setCart(res.data);
      await refreshCart();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyItem(null);
    }
  }

  async function clearAll() {
    try {
      const res = await api.delete('/cart');
      setCart(res.data);
      await refreshCart();
      setConfirmClear(false);
      toast.info('Cart khali kar diya');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await api.post('/my-orders', { note });
      await refreshCart();
      toast.success(res.message);
      navigate(`/my-orders/${res.data._id}?new=1`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }

  if (!cart?.items?.length) {
    return (
      <>
        <PageHeader title="Cart" />
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title="Cart khali hai"
            message="Catalog se item chun kar cart me daalein, phir yahan se ek saath order kar dein."
            action={<Button icon={Store} onClick={() => navigate('/shop')}>Catalog kholein</Button>}
          />
        </Card>
      </>
    );
  }

  const hasShortage = cart.items.some((l) => !l.enough);

  return (
    <>
      <PageHeader
        title="Cart"
        subtitle={`${cart.itemCount} item · ${business?.name || ''}`}
        action={
          <Button variant="ghost" icon={Trash2} onClick={() => setConfirmClear(true)}>
            Khali karein
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padding={false}>
            <ul className="divide-y divide-slate-100">
              {cart.items.map((l) => (
                <li key={l.itemId} className={cn('flex gap-3 p-4', busyItem === l.itemId && 'opacity-50')}>
                  {l.imageUrl ? (
                    <img src={l.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Package size={22} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{l.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatMoney(l.rate)} / {l.unit}
                          {l.hasSpecialRate && (
                            <span className="ml-2 inline-flex items-center gap-1 text-brand-700">
                              <Tag size={10} /> aapka rate
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(l.itemId)}
                        aria-label={`${l.name} hatayein`}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {!l.enough && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                        <TriangleAlert size={12} />
                        {l.inStock
                          ? `Abhi sirf ${formatQty(l.stockQty, l.unit)} hai`
                          : 'Abhi khatam hai'}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <QtyStepper
                        value={l.qty}
                        onChange={(v) => setQty(l.itemId, v)}
                        min={0}
                        size="sm"
                        unit={l.unit}
                        label={`${l.name} quantity`}
                      />
                      <span className="tabular font-semibold text-slate-900">{formatMoney(l.amount)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <Textarea
              label="Wholesaler ke liye note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Aaj shaam tak chahiye / gaadi bhej raha hoon"
            />
          </Card>
        </div>

        <div>
          <Card className="lg:sticky lg:top-20">
            <CardHeader title="Order summary" />

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Items</dt>
                <dd className="tabular text-slate-900">{cart.itemCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Kul quantity</dt>
                <dd className="tabular text-slate-900">{cart.totalQty}</dd>
              </div>
              <div className="!mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">Kul</dt>
                <dd className="tabular text-xl font-semibold text-slate-900">{formatMoney(cart.total)}</dd>
              </div>
            </dl>

            {hasShortage && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                Kuch item ka stock kam hai. Order phir bhi ja sakta hai — wholesaler jitna hoga utna bhej dega.
              </p>
            )}

            <Button className="mt-5 w-full" size="lg" icon={Send} loading={placing} onClick={placeOrder}>
              Order bhejein
            </Button>

            <p className="mt-3 text-center text-xs text-slate-500">
              Bill abhi nahi banega — {business?.name || 'wholesaler'} order dekh kar maal tayyar karenge.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title="Cart khali karein?"
        message="Saare item cart se hat jayenge."
        confirmLabel="Haan, khali karein"
      />
    </>
  );
}

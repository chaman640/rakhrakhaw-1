import { useCallback, useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, ShoppingCart, Package, TriangleAlert, Send, Store, Tag, ArrowUp, ArrowDown } from
'lucide-react';
import api from '@/lib/api';
import { useQuery, prime, bust } from '@/hooks/useQuery';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, Button, Badge, Textarea, Spinner,
  EmptyState, ConfirmModal, QtyStepper, useToast } from
'@/components/ui';
import { cn } from '@/lib/cn';

/*
  Teen hi chunav hain, aur teeno wahi hain jo dukaan me sach me bole jate hain.
  `label` bina `t()` ke hai — wo chaabi hai; anuvaad wahan hota hai jahan
  chhapta hai, warna bhasha badalne par ye list purani reh jati.
*/
const PAY_MODES = [
  { value: 'UDHAAR', label: 'Udhaar', hint: 'Khate me chadha dein' },
  { value: 'CASH', label: 'Cash', hint: 'Maal ke saath de denge' },
  { value: 'UPI', label: 'UPI', hint: 'Online bhej denge' },
];

export default function Cart() {
  const toast = useToast();
  const navigate = useNavigate();
  const { business } = useAuth();
  const { refresh: refreshCart } = useCart();

  const [note, setNote] = useState('');

  /*
    Paise ka irada order ke SAATH jata hai.

    Pehle har order chup-chaap udhaar maan liya jata tha, aur "cash pe lunga"
    wali baat phone pe alag se hoti thi. Wholesaler ko maal tayyar karte waqt
    ye pata hona chahiye — warna gaadi nikal jane ke baad pata chalta hai ki
    paisa aana tha.

    Default `UDHAAR` hi hai: jo aadmi kuch nahi chunta, uske liye aaj tak jo
    hota aaya hai wahi hota rahe.
  */
  const [paymentMode, setPaymentMode] = useState('UDHAAR');
  const [busyItem, setBusyItem] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  /*
    CACHE — Catalog se laut kar aane par cart khali nahi dikhta.

    Retailer ka aadha waqt Catalog aur Cart ke beech aane-jane me jata hai.
    Pehle har baar spinner aata tha.

    Mutation (quantity badalna, hatana) ka jawab server POORA NAYA CART hi
    deta hai — isliye use `prime()` se seedha cache me rakh dete hain. `bust()`
    lagakar dobara mangwate to ek bekaar ka round-trip hota aur beech ke us pal
    me purana number dikhta.
  */
  const { data: cart, loading } = useQuery(
    ['cart'],
    () => api.get('/cart').then((r) => {
      r.data.warnings?.forEach((w) => toast.info(w.message));
      return r.data;
    }),
    { onError: (err) => toast.error(err.message) },
  );

  // Server se abhi mila cart — seedha cache me
  const setCart = (data) => prime(['cart'], data);

  useEffect(() => { if (cart) setNote(cart.note || ''); }, [cart]);

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
      toast.info(t('Cart khali kar diya'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await api.post('/my-orders', { note, paymentMode });
      await refreshCart();
      // Cart khali ho gaya aur ek naya order bana — dono jagah ka purana data hata do
      bust('cart', 'my-orders');
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
        <PageHeader title={t("Cart")} />
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title={t("Cart khali hai")}
            message={t("Catalog se item chun kar cart me daalein, phir yahan se ek saath order kar dein.")}
            action={<Button icon={Store} onClick={() => navigate('/shop')}>{t("Catalog kholein")}</Button>} />
          
        </Card>
      </>);

  }

  const hasShortage = cart.items.some((l) => !l.enough);

  return (
    <>
      <PageHeader
        title={t("Cart")}
        subtitle={`${t('{n} item', { n: cart.itemCount })} · ${business?.name || ''}`}
        action={
        <Button variant="ghost" icon={Trash2} onClick={() => setConfirmClear(true)}>{t("Khali karein")}

        </Button>
        } />
      

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padding={false}>
            <ul className="divide-y divide-slate-100">
              {cart.items.map((l) =>
              <li key={l.itemId} className={cn('flex gap-3 p-4', busyItem === l.itemId && 'opacity-50')}>
                  {l.imageUrl ?
                <img src={l.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" /> :

                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <Package size={22} />
                    </div>
                }

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{l.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatMoney(l.rate)} / {l.unit}
                          {l.hasSpecialRate &&
                        <span className="ml-2 inline-flex items-center gap-1 text-brand-700">
                              <Tag size={10} /> {t('aapka rate')}
                            </span>
                        }
                        </p>
                        {/*
                        Rate cart me daalne ke baad badla — chup-chaap naya
                        number dikha dena dhokha lagta hai. Order naye rate
                        pe hi jayega (wahi theek hai), par retailer ko dikhna
                        chahiye ki wo badla hai aur kis taraf.
                        */}
                        {l.rateChanged &&
                      <p className={cn('mt-0.5 flex items-center gap-1 text-xs',
                      l.rate > l.addedRate ? 'text-amber-700' : 'text-emerald-700')}>
                            {l.rate > l.addedRate ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                            {t('Pehle {rate} tha', { rate: formatMoney(l.addedRate) })}
                          </p>
                      }
                      </div>
                      <button
                      onClick={() => removeItem(l.itemId)}
                      aria-label={t('{naam} hatayein', { naam: l.name })}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {!l.enough &&
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                        <TriangleAlert size={12} />
                        {l.inStock
                    ? t('Abhi sirf {q} hai', { q: formatQty(l.stockQty, l.unit) })
                    : t('Abhi khatam hai')}
                      </p>
                  }

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <QtyStepper
                      value={l.qty}
                      onChange={(v) => setQty(l.itemId, v)}
                      min={0}
                      size="sm"
                      unit={l.unit}
                      label={`${l.name} quantity`} />
                    
                      <span className="tabular font-semibold text-slate-900">{formatMoney(l.amount)}</span>
                    </div>
                  </div>
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <p className="mb-2 text-sm font-medium text-slate-700">{t('Paisa kaise denge')}</p>
            <div className="flex flex-wrap gap-2">
              {PAY_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={paymentMode === m.value}
                  onClick={() => setPaymentMode(m.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-ring',
                    paymentMode === m.value
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {t(m.label)}
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-500">{t(m.hint)}</span>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Textarea
                label={t("Wholesaler ke liye note")}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("Aaj shaam tak chahiye / gaadi bhej raha hoon")} />
            </div>
          </Card>
        </div>

        <div>
          <Card className="lg:sticky lg:top-20">
            <CardHeader title={t("Order summary")} />

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("Items")}</dt>
                <dd className="tabular text-slate-900">{cart.itemCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("Kul quantity")}</dt>
                <dd className="tabular text-slate-900">{cart.totalQty}</dd>
              </div>
              <div className="!mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">{t("Kul")}</dt>
                <dd className="tabular text-xl font-semibold text-slate-900">{formatMoney(cart.total)}</dd>
              </div>
            </dl>

            {hasShortage &&
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                {t('Kuch item ka stock kam hai. Order phir bhi ja sakta hai — wholesaler jitna hoga utna bhej dega.')}
              </p>
            }

            <Button className="mt-5 w-full" size="lg" icon={Send} loading={placing} onClick={placeOrder}>{t("Order bhejein")}

            </Button>

            <p className="mt-3 text-center text-xs text-slate-500">{t("Bill abhi nahi banega — {a0} order dekh kar maal tayyar karenge.", { a0:
                business?.name || 'wholesaler' })}
            </p>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAll}
        title={t("Cart khali karein?")}
        message={t("Saare item cart se hat jayenge.")}
        confirmLabel={t("Haan, khali karein")} />
      
    </>);

}

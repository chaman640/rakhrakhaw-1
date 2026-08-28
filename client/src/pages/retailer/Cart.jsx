import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trash2, ShoppingCart, Package, TriangleAlert, Send, Store, Tag, ArrowUp, ArrowDown,
  MessageSquarePlus, CheckCircle2, ChevronRight, Clock,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, bust } from '@/hooks/useQuery';
import { useCart } from '@/context/CartContext';
import { useShop } from '@/context/ShopContext';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, Button, Badge, Textarea, Spinner,
  EmptyState, ConfirmModal, QtyStepper, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * CART — HAR DUKAAN KA APNA DABBA.
 *
 * Pehle cart ek seedhi list thi aur neeche ek jod. Us waqt wo theek tha, kyunki
 * dukaan ek hi hoti thi.
 *
 * Ab teen dukaanon ka maal ek hi cart me ho sakta hai, aur us halat me ek jod
 * jhooth bolta hai: ₹5,700 kisi ek ko nahi dene — ₹4,500 ek ko, ₹1,200 doosre
 * ko. Isliye har dukaan ka apna dabba hai: upar uska naam aur logo, neeche uska
 * maal, aur usi ke andar uska apna jod. Sabse aakhir me kul jod — jo bas ye
 * batata hai ki aaj kul kitna kharch ho raha hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PAISE KA IRADA AUR NOTE — HAR DUKAAN KA ALAG.
 *
 * Ek chunaav sab pe laga dena aasan tha, par wo ek jhooth bolta. Dukaandaar
 * aksar ek se udhaar leta hai aur doosre ko nakad deta hai — aur ye baat order
 * ke saath bechne wale tak jati hai, jiske hisaab se wo maal tayyar karta hai.
 * Isliye chunaav har dabbe ke andar hai.
 *
 * Note collapsed rehta hai. Sau me se navve baar koi note likhta hi nahi, aur
 * teen dukaanon ke teen khule hue textarea poori screen kha jate hain.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * EK CONFIRM, PAR ORDER ALAG ALAG. Server har dukaan ka apna order banata hai,
 * uske apne number ke saath — isliye har wholesaler ko uski apni khabar jati
 * hai, aur bechne wale ko bilkul wahi dikhta hai jo pehle dikhta tha.
 */

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
  const { refresh: refreshCart } = useCart();
  const { selectShop } = useShop();

  // Har dukaan ka apna irada aur apna note — chaabi dukaan ki id
  const [perShop, setPerShop] = useState({});
  const [busyItem, setBusyItem] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(null);   // { shopId, name }
  const [result, setResult] = useState(null);               // checkout ke baad

  /*
    CHETAVNI TOAST ME NAHI, SCREEN PE.

    Pehle yahan har chetavni `toast.info` se dikhayi jati thi. Wo ek asli
    dikkat ban gayi: ye page har 20 second me apne aap taaza hota hai, aur har
    baar wahi teen toast dobara upar aa jate the. Aadmi cart bharta rehta aur
    har bees second me screen pe wahi baat dobara — kaam karna hi mushkil.

    Ab wo ek dabbe me neeche likhi rehti hai: hamesha dikhti hai, par apni jagah
    par baithi rehti hai. Toast us cheez ke liye hai jo ABHI HUI ho; ye us cheez
    ke liye hai jo ABHI SACH hai.
  */
  const { data, loading, refetch } = useQuery(
    ['buy-cart'],
    () => api.get('/buy/cart').then((r) => r.data),
    { onError: (err) => toast.error(err.message) },
  );

  const shops = data?.shops || [];
  const warnings = data?.warnings || [];

  // Server pe pada note pehli baar dabbe me bhar do
  useEffect(() => {
    if (!shops.length) return;
    setPerShop((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const row of shops) {
        const key = String(row.shop._id);
        if (!next[key]) {
          next[key] = { paymentMode: 'UDHAAR', note: row.note || '', noteOpen: Boolean(row.note) };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [shops]);

  const setFor = (shopId, patch) => setPerShop((s) => ({
    ...s,
    [shopId]: { ...(s[shopId] || { paymentMode: 'UDHAAR', note: '', noteOpen: false }), ...patch },
  }));

  /*
    Har call apni DUKAAN khud bhejti hai (`X-Shop-Id`).

    "Abhi khuli hui dukaan" pe bharosa karna yahan sabse bada khatra hota:
    screen pe teen dukaanein hain, aur doosri dukaan ki quantity pehli me badal
    jati — bina kisi error ke, bilkul chup-chaap.
  */
  const withShop = (shopId) => ({ headers: { 'X-Shop-Id': String(shopId) } });

  async function setQty(shopId, itemId, qty) {
    setBusyItem(`${shopId}|${itemId}`);
    try {
      await api.put(`/cart/items/${itemId}`, { qty }, withShop(shopId));
      await Promise.all([refetch(), refreshCart()]);
      bust('cart');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyItem(null);
    }
  }

  async function removeItem(shopId, itemId) {
    setBusyItem(`${shopId}|${itemId}`);
    try {
      await api.delete(`/cart/items/${itemId}`, withShop(shopId));
      await Promise.all([refetch(), refreshCart()]);
      bust('cart');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyItem(null);
    }
  }

  async function clearShop() {
    if (!confirmClear) return;
    try {
      await api.delete('/cart', withShop(confirmClear.shopId));
      await Promise.all([refetch(), refreshCart()]);
      bust('cart');
      toast.info(t('{naam} ka cart khali kar diya', { naam: confirmClear.name }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmClear(null);
    }
  }

  async function placeOrders() {
    const orders = shops
      .filter((row) => row.canOrder)
      .map((row) => {
        const key = String(row.shop._id);
        const mine = perShop[key] || {};
        return {
          shopId: key,
          paymentMode: mine.paymentMode || 'UDHAAR',
          note: (mine.note || '').trim(),
        };
      });

    if (!orders.length) {
      toast.error(t('Abhi koi dukaan order lene layak nahi hai'));
      return;
    }

    setPlacing(true);
    try {
      const res = await api.post('/buy/checkout', { orders });
      await Promise.all([refetch(), refreshCart()]);
      bust('cart', 'buy-cart', 'my-orders');

      setResult(res.data);
      if (res.data.failed?.length) toast.error(res.message);
      else toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPlacing(false);
    }
  }

  /** Order khol do — pehle us dukaan me pahuncho, phir uska order */
  function openOrder(row) {
    selectShop(row.shopId);
    navigate(`/my-orders/${row.orderId}`);
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }

  /* ─── checkout ke baad ka jawab ─── */
  if (result) {
    return (
      <>
        <PageHeader title={t('Order chala gaya')} />

        <Card padding={false} className="mb-4">
          <ul className="divide-y divide-slate-100">
            {result.placed.map((row) => (
              <li key={row.orderId}>
                <button
                  onClick={() => openOrder(row)}
                  className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50 focus-ring"
                >
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{row.shopName}</span>
                    <span className="block text-xs text-slate-500">{row.orderNo}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {result.failed?.length > 0 && (
          <Card className="mb-4 border-amber-200 bg-amber-50/50">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
              <TriangleAlert size={15} />
              {t('Inka order nahi ja saka — inka maal cart me hi hai')}
            </p>
            <ul className="space-y-1.5">
              {result.failed.map((row) => (
                <li key={String(row.shopId)} className="text-xs text-amber-900">
                  <span className="font-medium">{row.shopName}</span>
                  <span className="text-amber-700"> — {row.message}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Store} onClick={() => { setResult(null); navigate('/buy'); }}>
            {t('Aur maal lein')}
          </Button>
          <Button variant="ghost" onClick={() => setResult(null)}>{t('Cart dekhein')}</Button>
        </div>
      </>
    );
  }

  if (!shops.length) {
    return (
      <>
        <PageHeader title={t('Cart')} />
        <Card>
          <EmptyState
            icon={ShoppingCart}
            title={t('Cart khali hai')}
            message={t('Dukaan chun kar item cart me daalein — kai dukaanon ka maal ek saath bhi bhej sakte hain.')}
            action={<Button icon={Store} onClick={() => navigate('/buy')}>{t('Dukaan kholein')}</Button>}
          />
        </Card>
      </>
    );
  }

  const blocked = shops.filter((row) => !row.canOrder).length;

  return (
    <>
      <PageHeader
        title={t('Cart')}
        subtitle={`${t('{n} dukaan', { n: data.shopCount })} · ${t('{n} item', { n: data.itemCount })}`}
      />

      {/*
        Dhyan dene layak baatein — rate badla, stock kam pada, item hat gaya.
        Har chetavni ke saath DUKAAN ka naam: paanch dukaanon ka maal ek screen
        pe hai, bina naam ke pata hi nahi chalta ki kiski baat ho rahi hai.
      */}
      {warnings.length > 0 && (
        <Card className="mb-5 border-amber-200 bg-amber-50/60">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
            <TriangleAlert size={15} />
            {t('Ye dekh lijiye')}
          </p>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={`${w.shopId || ''}-${i}`} className="text-xs text-amber-900">
                {w.shopName && <span className="font-medium">{w.shopName}: </span>}
                {w.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {shops.map((row) => (
            <ShopBlock
              key={String(row.shop._id)}
              row={row}
              state={perShop[String(row.shop._id)] || { paymentMode: 'UDHAAR', note: '', noteOpen: false }}
              onState={(patch) => setFor(String(row.shop._id), patch)}
              busyItem={busyItem}
              onQty={(itemId, qty) => setQty(row.shop._id, itemId, qty)}
              onRemove={(itemId) => removeItem(row.shop._id, itemId)}
              onClear={() => setConfirmClear({ shopId: row.shop._id, name: row.shop.name })}
              onOpenShop={() => { selectShop(row.shop._id); navigate('/shop'); }}
            />
          ))}
        </div>

        {/* ─── kul jod ─── */}
        <div>
          <Card className="lg:sticky lg:top-20">
            <p className="mb-3 text-base font-semibold text-slate-900">{t('Kul jod')}</p>

            <dl className="space-y-2 text-sm">
              {shops.map((row) => (
                <div key={String(row.shop._id)} className="flex justify-between gap-3">
                  <dt className="min-w-0 truncate text-slate-500">{row.shop.name}</dt>
                  <dd className="tabular shrink-0 text-slate-900">{formatMoney(row.total)}</dd>
                </div>
              ))}
              <div className="!mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">{t('Kul')}</dt>
                <dd className="tabular text-xl font-semibold text-slate-900">
                  {formatMoney(data.grandTotal)}
                </dd>
              </div>
            </dl>

            {blocked > 0 && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <Clock size={14} className="mt-0.5 shrink-0" />
                {t('{n} dukaan ne abhi approve nahi kiya — unka order nahi jayega, maal cart me hi rahega.', { n: blocked })}
              </p>
            )}

            <Button className="mt-5 w-full" size="lg" icon={Send} loading={placing} onClick={placeOrders}>
              {t('Order bhejein')}
            </Button>

            <p className="mt-3 text-center text-xs text-slate-500">
              {t('Har dukaan ko uska apna order jayega — bill abhi nahi banega.')}
            </p>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmClear)}
        onClose={() => setConfirmClear(null)}
        onConfirm={clearShop}
        title={t('Is dukaan ka cart khali karein?')}
        message={t('Sirf {naam} ka maal hatega — baaki dukaanon ka waise ka waisa rahega.', {
          naam: confirmClear?.name || '',
        })}
        confirmLabel={t('Haan, khali karein')}
      />
    </>
  );
}

/* ────────────────────────── ek dukaan ka dabba ────────────────────────── */

function ShopBlock({ row, state, onState, busyItem, onQty, onRemove, onClear, onOpenShop }) {
  const { shop } = row;
  const hasShortage = row.items.some((l) => !l.enough);

  return (
    <Card padding={false}>
      {/* ─── hedline: dukaan ka naam aur logo ─── */}
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <button
          type="button"
          onClick={onOpenShop}
          aria-label={t('{naam} kholein', { naam: shop.name })}
          className="shrink-0 rounded-lg focus-ring"
        >
          {shop.logoUrl ? (
            <img src={shop.logoUrl} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Store size={20} />
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-semibold text-slate-900">{shop.name}</p>
            {!row.canOrder && <Badge tone="amber">{t('Approve baaki')}</Badge>}
          </div>
          <p className="truncate text-xs text-slate-500">
            {t('{n} item', { n: row.itemCount })}
          </p>
        </div>

        <span className="tabular shrink-0 text-base font-semibold text-slate-900">
          {formatMoney(row.total)}
        </span>

        <button
          type="button"
          onClick={onClear}
          aria-label={t('{naam} ka cart khali karein', { naam: shop.name })}
          title={t('Khali karein')}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-ring"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ─── us dukaan ka maal ─── */}
      <ul className="divide-y divide-slate-100">
        {row.items.map((l) => (
          <li
            key={l.itemId}
            className={cn('flex gap-3 p-4', busyItem === `${shop._id}|${l.itemId}` && 'opacity-50')}
          >
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
                        <Tag size={10} /> {t('aapka rate')}
                      </span>
                    )}
                  </p>
                  {/*
                    Rate cart me daalne ke baad badla — chup-chaap naya number
                    dikha dena dhokha lagta hai. Order naye rate pe hi jayega
                    (wahi theek hai), par dikhna chahiye ki wo badla hai aur kis
                    taraf.
                  */}
                  {l.rateChanged && (
                    <p className={cn('mt-0.5 flex items-center gap-1 text-xs',
                      l.rate > l.addedRate ? 'text-amber-700' : 'text-emerald-700')}>
                      {l.rate > l.addedRate ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                      {t('Pehle {rate} tha', { rate: formatMoney(l.addedRate) })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onRemove(l.itemId)}
                  aria-label={t('{naam} hatayein', { naam: l.name })}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-ring"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {!l.enough && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                  <TriangleAlert size={12} />
                  {l.inStock
                    ? t('Abhi sirf {q} hai', { q: formatQty(l.stockQty, l.unit) })
                    : t('Abhi khatam hai')}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-3">
                <QtyStepper
                  value={l.qty}
                  onChange={(v) => onQty(l.itemId, v)}
                  min={0}
                  size="sm"
                  unit={l.unit}
                  label={t('{naam} quantity', { naam: l.name })}
                />
                <span className="tabular font-semibold text-slate-900">{formatMoney(l.amount)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* ─── isi dukaan ka jod, irada aur note ─── */}
      <div className="border-t border-slate-100 bg-slate-50/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-600">{t('Is dukaan ka jod')}</span>
          <span className="tabular text-base font-semibold text-slate-900">{formatMoney(row.total)}</span>
        </div>

        {hasShortage && (
          <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            {t('Kuch item ka stock kam hai. Order phir bhi ja sakta hai — wholesaler jitna hoga utna bhej dega.')}
          </p>
        )}

        <p className="mb-1.5 text-xs font-medium text-slate-600">{t('Paisa kaise denge')}</p>
        <div className="flex flex-wrap gap-2">
          {PAY_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={state.paymentMode === m.value}
              onClick={() => onState({ paymentMode: m.value })}
              className={cn(
                'flex-1 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors focus-ring',
                state.paymentMode === m.value
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {t(m.label)}
              <span className="mt-0.5 block text-[10px] font-normal leading-tight text-slate-500">
                {t(m.hint)}
              </span>
            </button>
          ))}
        </div>

        {/*
          Note chhupa hua kyun: sau me se navve baar koi likhta hi nahi, aur
          teen dukaanon ke teen khule textarea poori screen kha jate hain.
        */}
        {state.noteOpen ? (
          <div className="mt-3">
            <Textarea
              label={t('{naam} ke liye note', { naam: shop.name })}
              rows={2}
              value={state.note}
              onChange={(e) => onState({ note: e.target.value })}
              placeholder={t('Aaj shaam tak chahiye / gaadi bhej raha hoon')}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onState({ noteOpen: true })}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline focus-ring"
          >
            <MessageSquarePlus size={13} />
            {t('Note likhein')}
          </button>
        )}
      </div>
    </Card>
  );
}

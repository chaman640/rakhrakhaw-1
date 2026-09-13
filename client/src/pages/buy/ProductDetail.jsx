import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Package, ShoppingCart, Check, ShieldCheck, MessageCircle, Images,
} from 'lucide-react';
import api from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useShop } from '@/context/ShopContext';
import { bust } from '@/hooks/useQuery';
import { formatMoney, formatQty } from '@/lib/format';
import { Spinner, EmptyState, QtyStepper, Button, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const LIMIT = 24; // ShopPage ke grid jitna hi — taaki page/index ekdum match kare

/**
 * PRODUCT REEL — Instagram jaisa, ek item se agle item tak scroll karke.
 *
 * ShopPage ke grid me jo filter/sort/page laga hua tha, wahi query string me
 * yahan aata hai — taaki scroll karte hi USI list ka agla item khule, koi
 * alag list nahi. Grid khud jaisa tha waisa hi rehta hai; ye poora-screen
 * wala reel sirf tab khulta hai jab ek item ke upar tap kiya jaaye.
 *
 * Jahan Instagram me heart hota hai, wahan yahan RATE hai. Jahan likes ki
 * ginti hoti hai, wahan yahan kitni photo hain — dono jagah "iska nishaan
 * kitna bada hai" wahi kaam kar rahe hain, bas cheez badal gayi.
 */
export default function ProductDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const filters = useMemo(() => ({
    q: searchParams.get('q') || '',
    categoryId: searchParams.get('categoryId') || '',
    stock: searchParams.get('stock') || 'all',
    sort: searchParams.get('sort') || 'name',
  }), [searchParams]);
  const startPage = Number(searchParams.get('page') || 1);

  const [items, setItems] = useState(null); // null = pehli list abhi load ho rahi hai
  const [startIndex, setStartIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [nextPage, setNextPage] = useState(startPage + 1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollRef = useRef(null);
  const sectionRefs = useRef([]);
  const jumpedRef = useRef(false);

  // ─── pehli list — jis page se click hua tha wahi utha lo, item wahi dhoondo ───
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setLoadError(false);
    jumpedRef.current = false;

    (async () => {
      try {
        const body = await api.get('/catalog', { params: { ...filters, page: startPage, limit: LIMIT } });
        if (cancelled) return;
        const list = body.data || [];
        const idx = list.findIndex((i) => i._id === id);

        if (idx === -1) {
          // Link seedha khula hoga, ya list badal chuki — akela item dikha do
          const item = await api.get(`/catalog/item/${id}`).then((r) => r.data);
          if (cancelled) return;
          setItems([item]);
          setStartIndex(0);
          setHasMore(false);
        } else {
          setItems(list);
          setStartIndex(idx);
          setHasMore(startPage < (body.meta?.totalPages || 1));
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─── shuru me seedha clicked item par kood jao — animation nahi, turant ───
  useLayoutEffect(() => {
    if (!items || jumpedRef.current) return;
    const el = sectionRefs.current[startIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      setActiveIndex(startIndex);
      jumpedRef.current = true;
    }
  }, [items, startIndex]);

  // ─── agla page — jab aakhri ke paas pahunch jaye ───
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const body = await api.get('/catalog', { params: { ...filters, page: nextPage, limit: LIMIT } });
      const list = body.data || [];
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i._id));
        return [...cur, ...list.filter((i) => !seen.has(i._id))];
      });
      setHasMore(nextPage < (body.meta?.totalPages || 1));
      setNextPage((p) => p + 1);
    } catch {
      setHasMore(false); // chup-chaap ruk jao — reel to chal hi raha hai
    } finally {
      setLoadingMore(false);
    }
  }

  // ─── kaunsa panel abhi screen par hai — usi se bottom bar aur "aur mangao" chalta hai ───
  useEffect(() => {
    if (!items?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number(e.target.dataset.reelIndex);
            setActiveIndex(idx);
            if (idx >= items.length - 3) loadMore();
          }
        }
      },
      { root: scrollRef.current, threshold: 0.6 },
    );
    sectionRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (loadError) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-white p-4">
        <EmptyState
          icon={Package}
          title={t('Item nahi mila')}
          message={t('Ye item ab available nahi hai, ya hata diya gaya hai.')}
          action={<Button icon={ArrowLeft} onClick={() => navigate(-1)}>{t('Wapas jaayein')}</Button>}
        />
      </div>
    );
  }

  if (!items) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-white">
        <Spinner size={28} className="text-slate-400" />
      </div>
    );
  }

  const active = items[activeIndex] || items[0];

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <div
        ref={scrollRef}
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {items.map((item, i) => (
          <ReelPanel
            key={item._id}
            item={item}
            sectionRef={(el) => { sectionRefs.current[i] = el; }}
            index={i}
          />
        ))}

        {loadingMore && (
          <div className="flex h-24 items-center justify-center text-slate-400">
            <Spinner size={22} />
          </div>
        )}
      </div>

      {/* ─── hamesha upar — back button, jahan photo/panel badalte rahein ─── */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label={t('Wapas')}
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm focus-ring"
      >
        <ArrowLeft size={20} />
      </button>

      {/* ─── hamesha neeche — jo panel abhi dikh raha hai usi ka cart-bar ─── */}
      {active && <ReelActionBar item={active} />}
    </div>
  );
}

/* ────────────────────────── ek panel — poori screen, ek product ────────────────────────── */

function ReelPanel({ item, sectionRef, index }) {
  const photos = item.images?.length ? item.images : [];
  const [slide, setSlide] = useState(0);

  return (
    <section
      ref={sectionRef}
      data-reel-index={index}
      className="relative flex h-full w-full snap-start flex-col bg-black"
    >
      {/* ─── photo — jitni screen mil sake utni ─── */}
      <div className="relative flex-1 overflow-hidden bg-slate-900">
        {photos.length ? (
          <img src={photos[slide]} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600">
            <Package size={64} />
          </div>
        )}

        {/*
          Stock ka rang — bilkul upar, jahan aam taur pe back button hota hai
          (yahan back button poori reel ke liye ek hi hai, upar alag se laga hai).
        */}
        <span className={cn(
          'absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white shadow',
          item.inStock ? 'bg-emerald-600' : 'bg-red-600',
        )}>
          {item.inStock ? t('Stock me hai') : t('Stock khatam')}
        </span>

        {photos.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                aria-label={t('Photo {n}', { n: i + 1 })}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === slide ? 'w-5 bg-white' : 'w-1.5 bg-white/40',
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── byora — Instagram ke caption jaisa hissa, andar hi scroll ho sake ─── */}
      <div className="max-h-[42%] overflow-y-auto bg-white px-4 pb-28 pt-3">
        {/* Jahan heart hota hai wahan rate, jahan likes ki ginti hoti hai wahan photo ki ginti */}
        <div className="flex items-center justify-between">
          <span className="tabular text-2xl font-bold text-slate-900">{formatMoney(item.rate)}</span>
          {photos.length > 1 && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Images size={13} /> {t('{n} photo', { n: photos.length })}
            </span>
          )}
        </div>
        {item.mrp > item.rate && (
          <span className="text-sm text-slate-400 line-through">{formatMoney(item.mrp)}</span>
        )}

        <p className="mt-2 truncate text-base font-semibold text-slate-900">{item.name}</p>
        <p className="truncate text-sm text-slate-500">
          {item.brand || item.category || item.sku || ' '}
          {item.modelNo && <span className="text-slate-400"> · {item.modelNo}</span>}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.warrantyText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              <ShieldCheck size={12} /> {t('{w} warranty', { w: item.warrantyText })}
            </span>
          )}
          {item.minOrderQty > 1 && (
            <span className="text-xs text-slate-400">
              {t('Kam se kam {a0}', { a0: formatQty(item.minOrderQty, item.unit) })}
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{item.description}</p>
        )}
      </div>
    </section>
  );
}

/* ────────────────────────── neeche chipka hua — hamesha ek hi, active item ka ────────────────────────── */

function ReelActionBar({ item }) {
  const toast = useToast();
  const { refresh: refreshCart } = useCart();
  const { shopId } = useShop();
  const [qty, setQty] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [sentChat, setSentChat] = useState(false);

  // Panel badalte hi qty aur "bhej diya" turant reset ho jaye
  useEffect(() => { setQty(null); setAdded(false); setSentChat(false); }, [item._id]);

  const minQty = Math.max(1, Number(item.minOrderQty || 0));

  async function add() {
    const q = Math.max(minQty, Number(qty || minQty));
    setAdding(true);
    try {
      await api.post('/cart/items', { itemId: item._id, qty: q });
      await refreshCart();
      bust('cart', 'buy-cart');
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function sendInChat() {
    if (!shopId || sendingChat) return;
    setSendingChat(true);
    try {
      const fd = new FormData();
      fd.append('type', 'item');
      fd.append('refId', item._id);
      // X-Shop-Id yahan alag se — "abhi chuni hui dukaan" ko chhede bina
      // (ChatThread.jsx me isi tarike ki poori wajah likhi hai)
      await api.post('/my/chat/messages', fd, { headers: { 'X-Shop-Id': shopId } });
      bust('my-chat-conversations');
      setSentChat(true);
      setTimeout(() => setSentChat(false), 2200);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingChat(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <Button
          variant="secondary"
          icon={sentChat ? Check : MessageCircle}
          onClick={sendInChat}
          loading={sendingChat}
          className="shrink-0"
          aria-label={t('Chat me bhejein')}
        />

        {item.inStock ? (
          <div className="flex flex-1 items-center gap-2">
            <QtyStepper
              value={qty ?? minQty}
              onChange={setQty}
              min={minQty}
              unit={item.unit}
              label={t('{naam} quantity', { naam: item.name })}
            />
            <Button className="flex-1" loading={adding} onClick={add}
              variant={added ? 'success' : 'primary'} icon={added ? Check : ShoppingCart}>
              {added ? t('Cart me daal diya') : t('Daal dein')}
            </Button>
          </div>
        ) : (
          <Button className="flex-1" disabled>{t('Stock khatam')}</Button>
        )}
      </div>
    </div>
  );
}

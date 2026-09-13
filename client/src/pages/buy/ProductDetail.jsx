import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Package, ShoppingCart, Check, ShieldCheck, MessageCircle, Images, Store,
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
 * LAYOUT (Part 37 se poora Instagram jaisa) — photo hi poori screen hai, aur
 * sab kuch usi ke upar overlay hota hai, bilkul reel ki tarah:
 *
 *   DAAYEN taraf ka column   — jahan Instagram me like/comment hote hain,
 *                              wahan yahan RATE, chat-me-bhejein, photo ki
 *                              ginti, aur sabse neeche dukaan ka logo hai.
 *
 *   NEECHE-BAAYEN            — dukaan ka logo + naam (username row jaisa),
 *                              phir item ka naam/daam (caption jaisa).
 *
 *   JAHAN "FOLLOW" HOTA HAI  — wahan yahan "Add to Cart" hai, quantity
 *                              chunne ke option ke saath.
 */
export default function ProductDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { shop } = useShop();

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

  const scrollRef = useRef(null);
  const sectionRefs = useRef([]);
  const jumpedRef = useRef(false);

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

  useLayoutEffect(() => {
    if (!items || jumpedRef.current) return;
    const el = sectionRefs.current[startIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      jumpedRef.current = true;
    }
  }, [items, startIndex]);

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
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!items?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number(e.target.dataset.reelIndex);
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
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
        <Spinner size={28} className="text-white/60" />
      </div>
    );
  }

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
            shop={shop}
            sectionRef={(el) => { sectionRefs.current[i] = el; }}
            index={i}
          />
        ))}

        {loadingMore && (
          <div className="flex h-24 items-center justify-center text-white/50">
            <Spinner size={22} />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label={t('Wapas')}
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm focus-ring"
      >
        <ArrowLeft size={20} />
      </button>
    </div>
  );
}

/* ────────────────────────── ek panel — poori screen, ek product, Instagram jaisa ────────────────────────── */

function ReelPanel({ item, shop, sectionRef, index }) {
  const toast = useToast();
  const { refresh: refreshCart } = useCart();
  const photos = item.images?.length ? item.images : [];
  const [slide, setSlide] = useState(0);

  const [showQty, setShowQty] = useState(false);
  const [qty, setQty] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const [sendingChat, setSendingChat] = useState(false);
  const [sentChat, setSentChat] = useState(false);

  const minQty = Math.max(1, Number(item.minOrderQty || 0));

  async function add() {
    const q = Math.max(minQty, Number(qty || minQty));
    setAdding(true);
    try {
      await api.post('/cart/items', { itemId: item._id, qty: q });
      await refreshCart();
      bust('cart', 'buy-cart');
      setAdded(true);
      setTimeout(() => { setAdded(false); setShowQty(false); setQty(null); }, 2000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function sendInChat() {
    if (!shop?._id || sendingChat) return;
    setSendingChat(true);
    try {
      const fd = new FormData();
      fd.append('type', 'item');
      fd.append('refId', item._id);
      await api.post('/my/chat/messages', fd, { headers: { 'X-Shop-Id': shop._id } });
      bust('my-chat-conversations');
      setSentChat(true);
      setTimeout(() => setSentChat(false), 2000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingChat(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      data-reel-index={index}
      className="relative flex h-full w-full snap-start bg-black"
    >
      <div className="absolute inset-0 overflow-hidden bg-slate-900">
        {photos.length ? (
          <img src={photos[slide]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600">
            <Package size={64} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
      </div>

      {photos.length > 1 && (
        <div className="absolute inset-x-3 top-3 flex gap-1">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              aria-label={t('Photo {n}', { n: i + 1 })}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i === slide ? 'bg-white' : 'bg-white/30',
              )}
            />
          ))}
        </div>
      )}

      <span className={cn(
        'absolute right-3 top-8 rounded-full px-3 py-1 text-xs font-semibold text-white shadow',
        item.inStock ? 'bg-emerald-600' : 'bg-red-600',
      )}>
        {item.inStock ? t('Stock me hai') : t('Stock khatam')}
      </span>

      {/* DAAYAN COLUMN — like/comment/share ki jagah: rate, chat, photo count, dukaan ka logo */}
      <div className="absolute bottom-32 right-3 flex flex-col items-center gap-4 text-white">
        <div className="flex flex-col items-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-bold backdrop-blur-sm">
            ₹
          </span>
          <span className="mt-1 max-w-16 truncate text-center text-xs font-semibold tabular">
            {formatMoney(item.rate)}
          </span>
        </div>

        <button
          type="button"
          onClick={sendInChat}
          disabled={sendingChat}
          aria-label={t('Chat me bhejein')}
          className="flex flex-col items-center focus-ring"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
            {sentChat ? <Check size={19} /> : <MessageCircle size={19} />}
          </span>
          <span className="mt-1 text-xs">{sentChat ? t('Bhej diya') : t('Chat')}</span>
        </button>

        {photos.length > 1 && (
          <div className="flex flex-col items-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              <Images size={18} />
            </span>
            <span className="mt-1 text-xs">{photos.length}</span>
          </div>
        )}

        {shop?.logoUrl ? (
          <img src={shop.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover ring-2 ring-white/70" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white ring-2 ring-white/70">
            <Store size={16} />
          </span>
        )}
      </div>

      {/* NEECHE-BAAYAN — dukaan ka profile (username row jaisa) + caption */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-5 pr-24 text-white">
        <div className="flex items-center gap-2">
          {shop?.logoUrl ? (
            <img src={shop.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/50" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/50">
              <Store size={14} />
            </span>
          )}
          <span className="truncate text-sm font-semibold">{shop?.name || t('Dukaan')}</span>
        </div>

        <p className="mt-2 truncate text-base font-semibold">{item.name}</p>
        <p className="truncate text-xs text-white/70">
          {item.brand || item.category || item.sku || ' '}
          {item.modelNo && <span> · {item.modelNo}</span>}
          {item.mrp > item.rate && (
            <span className="ml-2 text-white/50 line-through">{formatMoney(item.mrp)}</span>
          )}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {item.warrantyText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/40">
              <ShieldCheck size={12} /> {t('{w} warranty', { w: item.warrantyText })}
            </span>
          )}
          {item.minOrderQty > 1 && (
            <span className="text-xs text-white/60">
              {t('Kam se kam {a0}', { a0: formatQty(item.minOrderQty, item.unit) })}
            </span>
          )}
        </div>

        {item.description && (
          <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-xs text-white/70">{item.description}</p>
        )}
      </div>

      {/* "FOLLOW" WALI JAGAH — ab yahan Add to Cart hai, quantity ke saath */}
      <div className="absolute bottom-5 right-3 z-10">
        {item.inStock ? (
          showQty ? (
            <div className="flex items-center gap-2 rounded-full bg-white p-1 pl-3 shadow-lg">
              <QtyStepper
                value={qty ?? minQty}
                onChange={setQty}
                min={minQty}
                unit={item.unit}
                label={t('{naam} quantity', { naam: item.name })}
              />
              <Button
                size="sm"
                loading={adding}
                onClick={add}
                variant={added ? 'success' : 'primary'}
                icon={added ? Check : ShoppingCart}
                className="rounded-full"
              >
                {added ? t('Ho gaya') : t('Daal dein')}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              icon={ShoppingCart}
              onClick={() => setShowQty(true)}
              className="rounded-full shadow-lg"
            >
              {t('Add to Cart')}
            </Button>
          )
        ) : (
          <Button size="sm" disabled className="rounded-full">{t('Stock khatam')}</Button>
        )}
      </div>
    </section>
  );
}

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
        className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

  const containerRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, mode: null, originX: 50, originY: 50 });
  const zoomTimerRef = useRef(null);

  const [dragX, setDragX] = useState(0);       // swipe ke waqt track kitna khisak gaya (px)
  const [animating, setAnimating] = useState(false); // ungli chhutne ke baad ka animation
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');

  /*
    EK HI FINGER, TEEN KAAM (Part 41) — swipe (agli/pichhli photo, Instagram
    jaisa animation ke saath), zoom (ungli tika kar rakhein to badi ho jaye,
    hatate hi wapas chhoti), ya panel khud upar-neeche scroll ho (agar ungli
    zyada seedhi upar-neeche chali). Pehle 8px tak koi faisla nahi lete — us
    thodi si harkat se pata chalta hai ki teenon me se kaun sa hai.
  */
  function onTouchStart(e) {
    const p = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    touchRef.current = {
      x: p.clientX,
      y: p.clientY,
      mode: null,
      originX: rect ? ((p.clientX - rect.left) / rect.width) * 100 : 50,
      originY: rect ? ((p.clientY - rect.top) / rect.height) * 100 : 50,
    };
    clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => {
      if (touchRef.current.mode) return; // tab tak swipe/scroll shuru ho chuka hoga to zoom nahi
      touchRef.current.mode = 'zoom';
      setZoomOrigin(`${touchRef.current.originX}% ${touchRef.current.originY}%`);
      setZoomScale(1.8);
    }, 280);
  }

  function onTouchMove(e) {
    const p = e.touches[0];
    const dx = p.clientX - touchRef.current.x;
    const dy = p.clientY - touchRef.current.y;

    if (touchRef.current.mode === 'zoom') return; // zoom ke waqt ungli hilne se kuch nahi hota

    if (!touchRef.current.mode) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimeout(zoomTimerRef.current);
      touchRef.current.mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'swipe' : 'scroll';
    }
    if (touchRef.current.mode !== 'swipe' || photos.length < 2) return;

    // Kinaron pe rubber-band — pehli/aakhri photo pe aage-peeche khichne se
    // thoda hi hilta hai, batata hai ki aage kuch nahi hai
    const atStart = slide === 0 && dx > 0;
    const atEnd = slide === photos.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx / 3 : dx);
  }

  function onTouchEnd() {
    clearTimeout(zoomTimerRef.current);
    if (touchRef.current.mode === 'zoom') {
      setZoomScale(1);
      touchRef.current.mode = null;
      return;
    }
    if (touchRef.current.mode !== 'swipe') {
      touchRef.current.mode = null;
      return;
    }
    touchRef.current.mode = null;

    const width = containerRef.current?.offsetWidth || window.innerWidth;
    const threshold = width * 0.22;
    if (dragX <= -threshold && slide < photos.length - 1) {
      finishSwipe(width, 1);
    } else if (dragX >= threshold && slide > 0) {
      finishSwipe(width, -1);
    } else {
      setAnimating(true);
      setDragX(0);
      setTimeout(() => setAnimating(false), 220);
    }
  }

  function finishSwipe(width, dir) {
    setAnimating(true);
    setDragX(dir > 0 ? -width : width);
    setTimeout(() => {
      setSlide((s) => s + dir);
      setDragX(0);
      setAnimating(false);
    }, 220);
  }

  useEffect(() => () => clearTimeout(zoomTimerRef.current), []);

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
      <div
        ref={containerRef}
        className="absolute inset-x-0 top-16 bottom-20 overflow-hidden rounded-2xl bg-slate-900"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {photos.length ? (
          <>
            {/* ZOOM — sirf scale karta hai, ungli tikaye rakhne se badi hoti hai */}
            <div
              className="h-full w-full"
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: zoomOrigin,
                transition: zoomScale === 1 ? 'transform 200ms ease-out' : 'transform 150ms ease-out',
              }}
            >
              {/* SWIPE — sirf khisakta hai, photo se photo Instagram jaisi animation ke saath */}
              <div
                className="flex h-full"
                style={{
                  transform: `translateX(${-slide * (containerRef.current?.offsetWidth || 0) + dragX}px)`,
                  transition: animating ? 'transform 220ms ease-out' : 'none',
                }}
              >
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" className="h-full w-full flex-shrink-0 object-cover" />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600">
            <Package size={64} />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
      </div>

      {/* Kitni photo hai, kaun si chal rahi hai — jaise Instagram carousel me */}
      {photos.length > 1 && (
        <span className="absolute left-3 top-8 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {slide + 1}/{photos.length}
        </span>
      )}

      <span className={cn(
        'absolute right-3 top-8 rounded-full px-3 py-1 text-xs font-semibold text-white shadow',
        item.inStock ? 'bg-emerald-600' : 'bg-red-600',
      )}>
        {item.inStock ? t('Stock me hai') : t('Stock khatam')}
      </span>

      {/* Dots — ab neeche, photo ke bilkul upar-caption se pehle (Instagram jaisa) */}
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-[190px] flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              aria-label={t('Photo {n}', { n: i + 1 })}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === slide ? 'w-4 bg-white' : 'w-1.5 bg-white/40',
              )}
            />
          ))}
        </div>
      )}

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

        {item.inStock && (
          <button
            type="button"
            onClick={() => setShowQty(true)}
            aria-label={t('Add to Cart')}
            className="flex flex-col items-center focus-ring"
          >
            <span className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm',
              added ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white',
            )}>
              {added ? <Check size={19} /> : <ShoppingCart size={19} />}
            </span>
            <span className="mt-1 text-xs">{t('Cart')}</span>
          </button>
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

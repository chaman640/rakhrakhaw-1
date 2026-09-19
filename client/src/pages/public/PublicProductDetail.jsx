import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, ShoppingCart, ShieldCheck, Images } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatQty } from '@/lib/format';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import useSeo from '@/lib/useSeo';

const LIMIT = 24;

/**
 * PRODUCT REEL — BINA LOGIN KE (Part 55).
 *
 * `buy/ProductDetail.jsx` ka hi jaisa dikhta hai (reel, swipe, zoom, dots —
 * poora visual kaam wahi hai), par teen farak jaan-boojh kar:
 *
 *   1. Data `/public/shop/:code/*` se aata hai, `/catalog` se nahi —
 *      login ki zarurat nahi.
 *   2. "Add to Cart" ki jagah "Order karein" hai — dabate hi seedha
 *      signup/join pe (`ShopPreview.jsx` jaisa hi rasta).
 *   3. Chat wala button hai hi nahi — bina login chat nahi ho sakti.
 *
 * Baaki (swipe, hold-to-zoom, dots, photo ka size) `ProductDetail.jsx` se
 * hoo-ba-hoo — do jagah alag-alag na ho jaaye isliye jitna ho sake, wahi
 * tarika copy kiya gaya hai.
 */
export default function PublicProductDetail() {
  const { code, itemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState(null);
  const [items, setItems] = useState(null);
  const [startIndex, setStartIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const startPage = Number(searchParams.get('page') || 1);
  const [nextPage, setNextPage] = useState(startPage + 1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const scrollRef = useRef(null);
  const sectionRefs = useRef([]);
  const jumpedRef = useRef(false);

  useSeo({
    title: items?.[startIndex] ? `${items[startIndex].name} — ${shop?.name || 'Rakh Rakhav'}` : 'Rakh Rakhav',
    description: shop ? `${shop.name} ka poora maal aur daam dekhein.` : '',
    path: `/s/${code}/item/${itemId}`,
  });

  useEffect(() => {
    api.get(`/public/shop/${code}`).then((r) => setShop(r.data)).catch(() => {});
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setLoadError(false);
    jumpedRef.current = false;

    (async () => {
      try {
        const body = await api.get(`/public/shop/${code}/items?page=${startPage}&limit=${LIMIT}`);
        if (cancelled) return;
        const list = body.data?.items || [];
        const idx = list.findIndex((i) => i._id === itemId);

        if (idx === -1) {
          const item = await api.get(`/public/shop/${code}/item/${itemId}`).then((r) => r.data);
          if (cancelled) return;
          setItems([item]);
          setStartIndex(0);
          setHasMore(false);
        } else {
          setItems(list);
          setStartIndex(idx);
          setHasMore(body.data?.hasMore || false);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, itemId]);

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
      const body = await api.get(`/public/shop/${code}/items?page=${nextPage}&limit=${LIMIT}`);
      const list = body.data?.items || [];
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i._id));
        return [...cur, ...list.filter((i) => !seen.has(i._id))];
      });
      setHasMore(body.data?.hasMore || false);
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

  const joinLink = () => navigate(`/join/${code}`);

  if (loadError) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-white p-4 text-center">
        <Package size={40} className="text-slate-300" />
        <p className="text-slate-700">{t('Ye item ab available nahi hai, ya hata diya gaya hai.')}</p>
        <button type="button" onClick={() => navigate(-1)} className="text-sm font-semibold text-brand-700 underline">
          {t('Wapas jaayein')}
        </button>
      </div>
    );
  }

  if (!items) {
    return <div className="fixed inset-0 z-40 bg-black" />;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <div ref={scrollRef} className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <PublicReelPanel
            key={item._id}
            item={item}
            shop={shop}
            sectionRef={(el) => { sectionRefs.current[i] = el; }}
            index={i}
            onOrder={joinLink}
          />
        ))}
        {loadingMore && <div className="flex h-24 items-center justify-center text-white/50">…</div>}
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

function PublicReelPanel({ item, shop, sectionRef, index, onOrder }) {
  const photos = item.images?.length ? item.images : [item.imageUrl].filter(Boolean);
  const [slide, setSlide] = useState(0);
  const containerRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, mode: null, originX: 50, originY: 50 });
  const zoomTimerRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');

  function onTouchStart(e) {
    const p = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    touchRef.current = {
      x: p.clientX, y: p.clientY, mode: null,
      originX: rect ? ((p.clientX - rect.left) / rect.width) * 100 : 50,
      originY: rect ? ((p.clientY - rect.top) / rect.height) * 100 : 50,
    };
    clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => {
      if (touchRef.current.mode) return;
      touchRef.current.mode = 'zoom';
      setZoomOrigin(`${touchRef.current.originX}% ${touchRef.current.originY}%`);
      setZoomScale(1.8);
    }, 280);
  }

  function onTouchMove(e) {
    const p = e.touches[0];
    const dx = p.clientX - touchRef.current.x;
    const dy = p.clientY - touchRef.current.y;
    if (touchRef.current.mode === 'zoom') return;
    if (!touchRef.current.mode) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimeout(zoomTimerRef.current);
      touchRef.current.mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'swipe' : 'scroll';
    }
    if (touchRef.current.mode !== 'swipe' || photos.length < 2) return;
    const atStart = slide === 0 && dx > 0;
    const atEnd = slide === photos.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx / 3 : dx);
  }

  function onTouchEnd() {
    clearTimeout(zoomTimerRef.current);
    if (touchRef.current.mode === 'zoom') { setZoomScale(1); touchRef.current.mode = null; return; }
    if (touchRef.current.mode !== 'swipe') { touchRef.current.mode = null; return; }
    touchRef.current.mode = null;
    const width = containerRef.current?.offsetWidth || window.innerWidth;
    const threshold = width * 0.22;
    if (dragX <= -threshold && slide < photos.length - 1) finishSwipe(width, 1);
    else if (dragX >= threshold && slide > 0) finishSwipe(width, -1);
    else { setAnimating(true); setDragX(0); setTimeout(() => setAnimating(false), 220); }
  }

  function finishSwipe(width, dir) {
    setAnimating(true);
    setDragX(dir > 0 ? -width : width);
    setTimeout(() => { setSlide((s) => s + dir); setDragX(0); setAnimating(false); }, 220);
  }

  useEffect(() => () => clearTimeout(zoomTimerRef.current), []);

  return (
    <section ref={sectionRef} data-reel-index={index} className="relative flex h-full w-full snap-start bg-black">
      <div
        ref={containerRef}
        className="absolute inset-x-0 top-16 bottom-20 overflow-hidden rounded-2xl bg-slate-900"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {photos.length ? (
          <div className="h-full w-full" style={{
            transform: `scale(${zoomScale})`, transformOrigin: zoomOrigin,
            transition: zoomScale === 1 ? 'transform 200ms ease-out' : 'transform 150ms ease-out',
          }}>
            <div className="flex h-full" style={{
              transform: `translateX(${-slide * (containerRef.current?.offsetWidth || 0) + dragX}px)`,
              transition: animating ? 'transform 220ms ease-out' : 'none',
            }}>
              {photos.map((src, i) => (
                <img key={i} src={src} alt="" className="h-full w-full flex-shrink-0 object-cover" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600"><Package size={64} /></div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
      </div>

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

      {/* Rail — chat/cart nahi, sirf rate aur photo count (login ke bina yahi kaam ka hai) */}
      <div className="absolute bottom-32 right-3 flex flex-col items-center gap-4 text-white">
        <div className="flex flex-col items-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-bold backdrop-blur-sm">₹</span>
          <span className="mt-1 max-w-16 truncate text-center text-xs font-semibold tabular">{formatMoney(item.rate)}</span>
        </div>
        {photos.length > 1 && (
          <div className="flex flex-col items-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm"><Images size={18} /></span>
            <span className="mt-1 text-xs">{photos.length}</span>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 px-4 pb-5 pr-24 text-white">
        <div className="flex items-center gap-2">
          {shop?.logoUrl ? (
            <img src={shop.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-white/50" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/50">🏬</span>
          )}
          <span className="truncate text-sm font-semibold">{shop?.name || t('Dukaan')}</span>
        </div>
        <p className="mt-2 truncate text-base font-semibold">{item.name}</p>
        <p className="truncate text-xs text-white/70">
          {item.brand || item.category || item.sku || ' '}
          {item.mrp > item.rate && <span className="ml-2 text-white/50 line-through">{formatMoney(item.mrp)}</span>}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {item.warrantyText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-200 ring-1 ring-inset ring-emerald-400/40">
              <ShieldCheck size={12} /> {t('{w} warranty', { w: item.warrantyText })}
            </span>
          )}
          {item.minOrderQty > 1 && (
            <span className="text-xs text-white/60">{t('Kam se kam {a0}', { a0: formatQty(item.minOrderQty, item.unit) })}</span>
          )}
        </div>
        {item.description && <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-xs text-white/70">{item.description}</p>}
      </div>

      {/* "Add to Cart" ki jagah — bina login ke order nahi ho sakta, isliye seedha signup/join */}
      <div className="absolute bottom-5 right-3 z-10">
        <button
          type="button"
          onClick={onOrder}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-700"
        >
          <ShoppingCart size={16} /> {t('Order karein')}
        </button>
      </div>
    </section>
  );
}

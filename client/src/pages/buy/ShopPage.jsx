import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ShoppingCart, Check, Store, Tag, ShieldCheck, SlidersHorizontal,
  Bookmark, BookmarkCheck, Layers, Search, X, ArrowLeftRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { useCart } from '@/context/CartContext';
import { useShop } from '@/context/ShopContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatQty } from '@/lib/format';
import {
  Card, Button, Badge, SearchInput, Chips, Select, Modal,
  Pagination, EmptyState, Spinner, QtyStepper, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * DUKAAN KA PAGE — Instagram wali window.
 *
 * Pehle ye "Catalog" tha: upar page ka naam, neeche char filter ek line me, aur
 * phir maal. Ek hi dukaan thi, isliye ye chal jata tha.
 *
 * Ab kai dukaanein hain, aur pehla sawal badal gaya hai. Aadmi yahan pahunchta
 * hai "Bada Traders ke paas kya hai?" poochhne ke liye — "kaunsa bearing hai?"
 * poochhne ke liye nahi. Isliye upar wo hai jo Instagram ke profile pe hota
 * hai: logo, naam, number, aur do ginti — kitna maal aur kitni category. Ye do
 * number hi batate hain ki dukaan bhari hai ya khali; bina inke aadmi jud kar
 * khali catalog dekhta hai aur samajh nahi pata ki galti uski hai ya dukaan ki.
 *
 * SAVE ka button follow jaisa hai. Save karte hi wo dukaan agli baar search
 * kholte hi saamne dikhti hai — number dobara likhna nahi padta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FILTER EK BUTTON KE ANDAR — kyun.
 *
 * Naam wali khoj, category, stock aur kram — chaar dabbe. Pehle ye chaaron
 * hamesha screen pe pade rehte the. 390px ke phone pe wo do line kha jate the,
 * aur maal — jiske liye aadmi aaya hai — teesri line se shuru hota tha. Sau me
 * se navve baar wo chaaron chhue hi nahi jate.
 *
 * Ab wo ek "Filter" button ke andar hain. Button pe hi likha rehta hai ki kitne
 * lage hue hain, isliye chhup kar bhool nahi jate — aur screen khali rehti hai.
 * ─────────────────────────────────────────────────────────────────────────
 */

const SORTS = [
  { value: 'name', label: 'Naam (A-Z)' },
  { value: 'rate', label: 'Sasta pehle' },
  { value: '-rate', label: 'Mehnga pehle' },
  { value: '-createdAt', label: 'Naye pehle' },
];

const DEFAULTS = { q: '', categoryId: '', stock: 'all', sort: 'name' };

export default function ShopPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { shopId, isBuyMode, refreshShops } = useShop();
  const { refresh: refreshCart, count: cartCount } = useCart();

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  const [filterOpen, setFilterOpen] = useState(false);
  const [savingShop, setSavingShop] = useState(false);

  const [qtys, setQtys] = useState({});
  const [adding, setAdding] = useState(null);
  /*
    "DAAL DIYA" WALA JAWAB — har add ka apna number (`n`).

    Wahi item dobara daalo to `setJustAdded(sameId)` se state badalti hi nahi
    thi aur React dobara chhapta hi nahi — aadmi ko koi jawab nahi milta tha, wo
    dobara dabata tha, aur cart me teen chale jate the. Number badalne se state
    hamesha badalti hai. Purana timer naya lagane se pehle mit jata hai, aur
    page chhodte hi timer bhi chala jata hai.
  */
  const [justAdded, setJustAdded] = useState(null);
  const addTimer = useRef(null);
  const addSeq = useRef(0);
  useEffect(() => () => clearTimeout(addTimer.current), []);

  // Buy mode me dukaan chuni na ho to kuch bhi mat maango (warna har page ek
  // bekaar ki request bhejta hai jiska jawab pehle se pata hai)
  const needShop = isBuyMode && !shopId;

  const { data: shop } = useQuery(
    ['shop-info', shopId],
    () => api.get('/catalog/shop').then((r) => r.data),
    { enabled: !needShop },
  );

  const { rows: items, meta, loading } = useListQuery(
    ['catalog', { q: debouncedQ, categoryId, stock, sort, page }],
    () => api.get('/catalog', { params: { q: debouncedQ, categoryId, stock, sort, page, limit: 24 } }),
    { enabled: !needShop, onError: (err) => toast.error(err.message) },
  );

  const { data: categories = [] } = useQuery(
    ['catalog-categories'],
    () => api.get('/catalog/categories').then((r) => r.data),
    { enabled: !needShop },
  );

  useEffect(() => { setPage(1); }, [debouncedQ, categoryId, stock, sort]);

  const minQty = (item) => Math.max(1, Number(item.minOrderQty || 0));

  const clearFilters = useCallback(() => {
    setQ(DEFAULTS.q);
    setCategoryId(DEFAULTS.categoryId);
    setStock(DEFAULTS.stock);
    setSort(DEFAULTS.sort);
  }, []);

  async function add(item) {
    const qty = Number(qtys[item._id] || minQty(item));
    if (qty <= 0) return;
    setAdding(item._id);
    try {
      const res = await api.post('/cart/items', { itemId: item._id, qty });
      await refreshCart();
      setQtys((s) => ({ ...s, [item._id]: minQty(item) }));

      const line = res.data?.items?.find((l) => String(l.itemId) === String(item._id));
      addSeq.current += 1;
      setJustAdded({ id: item._id, qty: line?.qty ?? qty, n: addSeq.current });

      // Dono cart — is dukaan ka apna, aur sab dukaanon wala jod
      bust('cart', 'buy-cart');

      clearTimeout(addTimer.current);
      addTimer.current = setTimeout(() => setJustAdded(null), 2200);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(null);
    }
  }

  /** Save — follow jaisa. Agli baar search kholte hi ye dukaan saamne. */
  async function toggleSave() {
    if (!shop?._id) return;
    setSavingShop(true);
    try {
      const res = shop.saved
        ? await api.delete(`/shops/${shop._id}/save`)
        : await api.post(`/shops/${shop._id}/save`);
      bust('shop-info');
      await refreshShops();
      toast.info(res.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingShop(false);
    }
  }

  if (needShop) {
    return (
      <Card>
        <EmptyState
          icon={Store}
          title={t('Abhi koi dukaan khuli nahi hai')}
          message={t('Jis dukaan se maal lena hai uska number daal kar jud jaiye — uske baad uska poora maal yahin dikhega.')}
          action={<Button icon={Search} onClick={() => navigate('/buy')}>{t('Dukaan dhundhein')}</Button>}
        />
      </Card>
    );
  }

  const activeFilters = [
    debouncedQ && DEFAULTS.q !== debouncedQ,
    categoryId !== DEFAULTS.categoryId,
    stock !== DEFAULTS.stock,
    sort !== DEFAULTS.sort,
  ].filter(Boolean).length;

  return (
    <>
      <ShopHeader
        shop={shop}
        saving={savingShop}
        onToggleSave={toggleSave}
        onSwitch={() => navigate('/buy')}
        onCart={() => navigate('/cart')}
        cartCount={cartCount}
      />

      {/* ─── ek button, saara filter uske andar ─── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant={activeFilters ? 'primary' : 'secondary'}
          icon={SlidersHorizontal}
          onClick={() => setFilterOpen(true)}
        >
          {activeFilters ? t('Filter ({n})', { n: activeFilters }) : t('Filter')}
        </Button>

        {activeFilters > 0 && (
          <Button variant="ghost" icon={X} onClick={clearFilters}>{t('Sab hatayein')}</Button>
        )}

        <span className="ml-auto text-xs text-slate-500">
          {t('{n} item', { n: meta.total })}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={activeFilters ? Package : Store}
            title={activeFilters ? t('Kuch nahi mila') : t('Abhi catalog khali hai')}
            message={activeFilters
              ? t('Doosre naam se dhundh kar dekhein ya filter hata dein.')
              : t('{naam} ne abhi koi item nahi daala. Thodi der baad dekhein.', {
                naam: shop?.name || t('Wholesaler'),
              })}
            action={activeFilters
              ? <Button variant="secondary" onClick={clearFilters}>{t('Filter hatayein')}</Button>
              : <Button variant="secondary" icon={ArrowLeftRight} onClick={() => navigate('/buy')}>
                {t('Doosri dukaan dekhein')}
              </Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                qty={qtys[item._id] ?? minQty(item)}
                onQty={(v) => setQtys((s) => ({ ...s, [item._id]: v }))}
                onAdd={() => add(item)}
                adding={adding === item._id}
                added={justAdded?.id === item._id ? justAdded : null}
              />
            ))}
          </div>

          <Card className="mt-5" padding={false}>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </Card>
        </>
      )}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        q={q} setQ={setQ}
        categoryId={categoryId} setCategoryId={setCategoryId}
        stock={stock} setStock={setStock}
        sort={sort} setSort={setSort}
        categories={categories}
        activeFilters={activeFilters}
        onClear={clearFilters}
      />
    </>
  );
}

/* ────────────────────────── upar wala hissa (Instagram jaisa) ────────────────────────── */

function ShopHeader({ shop, saving, onToggleSave, onSwitch, onCart, cartCount }) {
  if (!shop) {
    return <Card className="mb-4"><div className="h-24 animate-pulse rounded-lg bg-slate-100" /></Card>;
  }

  return (
    <Card className="mb-4">
      <div className="flex items-start gap-4">
        {shop.logoUrl ? (
          <img src={shop.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-slate-200 sm:h-20 sm:w-20" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 sm:h-20 sm:w-20">
            <Store size={26} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-900">{shop.name}</h1>
              <p className="truncate text-xs text-slate-500">
                {shop.phone}
                {shop.city ? ` · ${shop.city}` : ''}
              </p>
            </div>

            {/* Save — follow jaisa. Juda hua ho tabhi. */}
            {shop.connected && (
              <button
                type="button"
                onClick={onToggleSave}
                disabled={saving}
                aria-label={shop.saved ? t('Save hatayein') : t('Save karein')}
                title={shop.saved ? t('Save hatayein') : t('Save karein')}
                className={cn(
                  'shrink-0 rounded-lg p-2 transition-colors focus-ring',
                  shop.saved ? 'text-brand-600 hover:bg-brand-50' : 'text-slate-400 hover:bg-slate-100',
                )}
              >
                {shop.saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
              </button>
            )}
          </div>

          {/*
            Do ginti — Instagram ke "posts / followers" jaisi.
            Inhi se pata chalta hai ki dukaan bhari hai ya khali.
          */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <Package size={14} className="text-slate-400" />
              <span className="font-semibold">{shop.itemCount ?? 0}</span>
              <span className="text-xs text-slate-500">{t('item')}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <Layers size={14} className="text-slate-400" />
              <span className="font-semibold">{shop.categoryCount ?? 0}</span>
              <span className="text-xs text-slate-500">{t('category')}</span>
            </span>
            {shop.balance > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <span className="tabular font-semibold">{formatMoney(shop.balance)}</span>
                <span className="text-xs">{t('baaki')}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button size="sm" variant="secondary" icon={ArrowLeftRight} onClick={onSwitch}>
          {t('Dukaan badlein')}
        </Button>
        {cartCount > 0 && (
          <Button size="sm" icon={ShoppingCart} onClick={onCart}>
            {t('Cart ({a0})', { a0: cartCount })}
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ────────────────────────── filter ka darwaza ────────────────────────── */

function FilterSheet({
  open, onClose, q, setQ, categoryId, setCategoryId, stock, setStock,
  sort, setSort, categories, activeFilters, onClear,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Filter')}
      description={t('Jo badlenge wo peeche turant lag jayega')}
      footer={
        <>
          {activeFilters > 0 && (
            <Button variant="ghost" onClick={onClear}>{t('Sab hatayein')}</Button>
          )}
          <Button onClick={onClose}>{t('Ho gaya')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">{t('Naam ya code se')}</p>
          <SearchInput value={q} onChange={setQ} placeholder={t('Item ka naam ya code...')} />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">{t('Stock')}</p>
          <Chips
            value={stock}
            onChange={setStock}
            options={[{ value: 'all', label: 'Sab' }, { value: 'in', label: 'Jo available hai' }]}
          />
        </div>

        <Select
          label={t('Category')}
          placeholder={t('Sab categories')}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={categories.map((c) => ({ value: c._id, label: `${c.name} (${c.itemCount})` }))}
        />

        <Select
          label={t('Kram')}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={SORTS}
        />
      </div>
    </Modal>
  );
}

/* ────────────────────────── ek item ka card ────────────────────────── */

function ItemCard({ item, qty, onQty, onAdd, adding, added }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-square bg-slate-50">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Package size={36} />
          </div>
        )}

        {!item.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Badge tone="red">{t('Abhi khatam')}</Badge>
          </div>
        )}
        {item.inStock && item.hasSpecialRate && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Tag size={10} /> {t('Aapka rate')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {item.brand || item.category || item.sku || ' '}
          {item.modelNo && <span className="text-slate-400"> · {item.modelNo}</span>}
        </p>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="tabular text-lg font-semibold text-slate-900">{formatMoney(item.rate)}</span>
          <span className="text-xs text-slate-500">/ {item.unit}</span>
          {/* MRP tabhi jab wo rate se zyada ho — warna "MRP ₹100, rate ₹120" mazaak lagta hai */}
          {item.mrp > item.rate && (
            <span className="text-xs text-slate-400 line-through">{formatMoney(item.mrp)}</span>
          )}
        </div>

        {item.warrantyText && (
          <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <ShieldCheck size={10} /> {t('{w} warranty', { w: item.warrantyText })}
          </span>
        )}

        <p className={cn('mt-1 text-xs',
          !item.inStock ? 'text-red-600' : item.isLowStock ? 'text-amber-600' : 'text-slate-500')}>
          {item.inStock
            ? t('{q} available', { q: formatQty(item.stockQty, item.unit) })
            : t('Stock khatam')}
        </p>

        {item.minOrderQty > 1 && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            {t('Kam se kam {a0}', { a0: formatQty(item.minOrderQty, item.unit) })}
          </p>
        )}

        <div className="mt-3 flex-1" />

        {item.inStock ? (
          <div className="flex flex-col gap-2">
            <QtyStepper value={qty} onChange={onQty} min={Math.max(1, item.minOrderQty || 1)}
              size="sm" unit={item.unit} label={t('{naam} quantity', { naam: item.name })} />
            <Button size="sm" className="w-full" loading={adding} onClick={onAdd}
              variant={added ? 'success' : 'primary'} icon={added ? Check : ShoppingCart}>
              {/*
                Unit yahan JAAN-BOOJH KAR nahi hai. 390px ke phone pe card aadhi
                chaudai ka hota hai, aur "Cart me 2 PCS" kat kar "Cart me 2 P..."
                dikhta tha — jo jawab dene ke bajaye tooti hui cheez lagti hai.
                Unit upar stepper me pehle se likha hai.
              */}
              {added ? t('Cart me {q}', { q: added.qty }) : t('Daal dein')}
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full" disabled>{t('Abhi khatam')}</Button>
        )}
      </div>
    </div>
  );
}

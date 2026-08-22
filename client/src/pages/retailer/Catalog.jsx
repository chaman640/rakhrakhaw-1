import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, Check, Store, Tag, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useQuery, useListQuery, bust } from '@/hooks/useQuery';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, Button, Badge, SearchInput, Chips, Select,
  Pagination, EmptyState, Spinner, QtyStepper, useToast } from
'@/components/ui';
import { cn } from '@/lib/cn';

const SORTS = [
{ value: 'name', label: 'Naam (A-Z)' },
{ value: 'rate', label: 'Sasta pehle' },
{ value: '-rate', label: 'Mehnga pehle' },
{ value: '-createdAt', label: 'Naye pehle' }];


export default function Catalog() {
  const toast = useToast();
  const navigate = useNavigate();
  const { business } = useAuth();
  const { refresh: refreshCart, count: cartCount } = useCart();


  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  const [qtys, setQtys] = useState({});
  const [adding, setAdding] = useState(null);
  /*
    "DAAL DIYA" WALA JAWAB — ye teen jagah se toota hua tha.

    1. Wahi item dobara daalo to `setJustAdded(sameId)` se state badalti hi
       nahi thi — React dobara chhapta hi nahi, aur aadmi ko koi jawab nahi
       milta tha. Wo dobara dabata tha, aur cart me teen chale jate the.
    2. Pehle add ka timer chalta rehta tha. Doosre add ke 0.2 second baad wahi
       purana timer "Daal diya" hata deta tha — jawab poora dikhne se pehle hi
       gayab.
    3. Page chhod dene par timer chalta rehta tha aur hate hue component pe
       state set karta tha.

    Ab: har add ka apna number (`n`) hai — isliye state hamesha badalti hai;
    purana timer naya lagane se pehle mita diya jata hai; aur page chhodte hi
    timer bhi chala jata hai.

    Sabse zaroori: ab jawab me cart ka ASLI number dikhta hai. "Daal diya"
    dobara dekhna aur "Cart me 6" dekhna — dono me farq saaf hai.
  */
  const [justAdded, setJustAdded] = useState(null);   // { id, qty, n }
  const addTimer = useRef(null);
  const addSeq = useRef(0);
  useEffect(() => () => clearTimeout(addTimer.current), []);

  /*
    CACHE — page dobara kholne par khali nahi hota.

    Pehle yahan seedha `api.get` tha. Iska matlab tha: catalog se ek item
    dekha, cart me daala, wapas aaye — aur poora catalog phir se khali hokar
    spinner dikhata tha. Dukaan me aadmi ye chakkar din me bees baar lagata
    hai, aur har baar do second ka intezaar aur apni jagah ka kho jana.

    `useQuery` purana data TURANT de deta hai aur naya peeche-peeche laata
    hai. Isliye wapas aane par list wahin ki wahin dikhti hai, aur agar rate
    badla hoga to ek pal me chup-chaap sudhar jayega.
  */
  const { rows: items, meta, loading } = useListQuery(
    ['catalog', { q: debouncedQ, categoryId, stock, sort, page }],
    () => api.get('/catalog', { params: { q: debouncedQ, categoryId, stock, sort, page, limit: 24 } }),
    { onError: (err) => toast.error(err.message) },
  );

  const { data: categories = [] } = useQuery(
    ['catalog-categories'],
    () => api.get('/catalog/categories').then((r) => r.data),
  );

  useEffect(() => {setPage(1);}, [debouncedQ, categoryId, stock, sort]);

  // Kuch item pe wholesaler ne "kam se kam itna hi lena" laga rakha hai —
  // default 1 rakhne se "Daal dein" dabate hi server mana kar deta tha
  const minQty = (item) => Math.max(1, Number(item.minOrderQty || 0));

  async function add(item) {
    const qty = Number(qtys[item._id] || minQty(item));
    if (qty <= 0) return;
    setAdding(item._id);
    try {
      const res = await api.post('/cart/items', { itemId: item._id, qty });
      await refreshCart();
      setQtys((s) => ({ ...s, [item._id]: minQty(item) }));

      // Cart me is item ke ab kitne hain — jawab me yahi dikhana hai
      const line = res.data?.items?.find((l) => String(l.itemId) === String(item._id));
      addSeq.current += 1;
      setJustAdded({ id: item._id, qty: line?.qty ?? qty, n: addSeq.current });

      bust('cart');

      clearTimeout(addTimer.current);
      addTimer.current = setTimeout(() => setJustAdded(null), 2200);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(null);
    }
  }

  const hasFilters = Boolean(debouncedQ || categoryId || stock !== 'all');

  return (
    <>
      <PageHeader
        title={t("Catalog")}
        subtitle={business?.name
          ? t('{naam} ka saman', { naam: business.name })
          : t('Order karne ke liye item chunein')}
        action={
        cartCount > 0 &&
        <Button icon={ShoppingCart} onClick={() => navigate('/cart')}>{t("Cart ({a0})", { a0:
            cartCount })}
        </Button>

        } />
      

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t("Item ka naam ya code...")}
          className="w-full sm:w-64" />
          <Chips value={stock} onChange={setStock}
          options={[{ value: 'all', label: 'Sab' }, { value: 'in', label: 'Jo available hai' }]} />
          <div className="w-44">
            <Select placeholder={t("Sab categories")} value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categories.map((c) => ({ value: c._id, label: `${c.name} (${c.itemCount})` }))} />
          </div>
          <div className="w-40">
            <Select placeholder="" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS} />
          </div>
        </div>
      </Card>

      {loading ?
      <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div> :
      !items.length ?
      <Card>
          <EmptyState
          icon={hasFilters ? Package : Store}
          title={hasFilters ? t('Kuch nahi mila') : t('Abhi catalog khali hai')}
          message={hasFilters
          ? t('Doosre naam se dhundh kar dekhein ya filter hata dein.')
          : t('{naam} ne abhi koi item nahi daala. Thodi der baad dekhein.', {
            naam: business?.name || t('Wholesaler'),
          })}
          action={hasFilters &&
          <Button variant="secondary" onClick={() => {setQ('');setCategoryId('');setStock('all');}}>{t("Filter hatayein")}

          </Button>
          } />
        
        </Card> :

      <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) =>
          <ItemCard
            key={item._id}
            item={item}
            qty={qtys[item._id] ?? minQty(item)}
            onQty={(v) => setQtys((s) => ({ ...s, [item._id]: v }))}
            onAdd={() => add(item)}
            adding={adding === item._id}
            added={justAdded?.id === item._id ? justAdded : null} />

          )}
          </div>

          <Card className="mt-5" padding={false}>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
          limit={meta.limit} onChange={setPage} />
          </Card>
        </>
      }
    </>);

}

function ItemCard({ item, qty, onQty, onAdd, adding, added }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-square bg-slate-50">
        {item.imageUrl ?
        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> :

        <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Package size={36} />
          </div>
        }

        {!item.inStock &&
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Badge tone="red">{t("Abhi khatam")}</Badge>
          </div>
        }
        {item.inStock && item.hasSpecialRate &&
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Tag size={10} /> {t('Aapka rate')}
          </span>
        }
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-medium text-slate-900">{item.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {item.brand || item.category || item.sku || ' '}
          {item.modelNo && <span className="text-slate-400"> · {item.modelNo}</span>}
        </p>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="tabular text-lg font-semibold text-slate-900">{formatMoney(item.rate)}</span>
          <span className="text-xs text-slate-500">/ {item.unit}</span>
          {/* MRP tabhi jab wo rate se zyada ho — warna "MRP ₹100, rate ₹120" mazaak lagta hai */}
          {item.mrp > item.rate &&
          <span className="text-xs text-slate-400 line-through">{formatMoney(item.mrp)}</span>
          }
        </div>

        {item.warrantyText &&
        <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <ShieldCheck size={10} /> {t('{w} warranty', { w: item.warrantyText })}
          </span>
        }

        <p className={cn('mt-1 text-xs',
        !item.inStock ? 'text-red-600' : item.isLowStock ? 'text-amber-600' : 'text-slate-500')}>
          {item.inStock ? `${formatQty(item.stockQty, item.unit)} available` : 'Stock khatam'}
        </p>

        {item.minOrderQty > 1 &&
        <p className="mt-0.5 text-[11px] text-slate-400">{t("Kam se kam {a0}", { a0:
            formatQty(item.minOrderQty, item.unit) })}
        </p>
        }

        <div className="mt-3 flex-1" />

        {item.inStock ?
        <div className="flex flex-col gap-2">
            <QtyStepper value={qty} onChange={onQty} min={Math.max(1, item.minOrderQty || 1)}
          size="sm" unit={item.unit} label={t('{naam} quantity', { naam: item.name })} />
            <Button size="sm" className="w-full" loading={adding} onClick={onAdd}
          variant={added ? 'success' : 'primary'} icon={added ? Check : ShoppingCart}>
              {/*
                Unit yahan JAAN-BOOJH KAR nahi hai. 390px ke phone pe card
                aadhi chaudai ka hota hai, aur "Cart me 2 PCS" kat kar
                "Cart me 2 P..." dikhta tha — jo jawab dene ke bajaye tooti
                hui cheez lagti hai. Unit upar stepper me pehle se likha hai.
              */}
              {added ? t('Cart me {q}', { q: added.qty }) : t('Daal dein')}
            </Button>
          </div> :

        <Button size="sm" className="w-full" disabled>{t("Abhi khatam")}</Button>
        }
      </div>
    </div>);

}

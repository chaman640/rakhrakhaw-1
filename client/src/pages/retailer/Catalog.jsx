import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, Check, Store, Tag, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, Button, Badge, SearchInput, Chips, Select,
  Pagination, EmptyState, Spinner, QtyStepper, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';

const SORTS = [
  { value: 'name', label: 'Naam (A-Z)' },
  { value: 'rate', label: 'Sasta pehle' },
  { value: '-rate', label: 'Mehnga pehle' },
  { value: '-createdAt', label: 'Naye pehle' },
];

export default function Catalog() {
  const toast = useToast();
  const navigate = useNavigate();
  const { business } = useAuth();
  const { refresh: refreshCart, count: cartCount } = useCart();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 24, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [categoryId, setCategoryId] = useState('');
  const [stock, setStock] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);

  const [qtys, setQtys] = useState({});
  const [adding, setAdding] = useState(null);
  const [justAdded, setJustAdded] = useState(null);

  const load = useCallback(async (chupChaap = false) => {
    // `chupChaap` = list ko khali karke skeleton mat dikhao, sirf badal do.
    // Wapas aane par poori list ka gayab ho kar dobara aana aisa lagta hai
    // jaise page toot gaya ho.
    if (!chupChaap) setLoading(true);
    try {
      const res = await api.get('/catalog', {
        params: { q: debouncedQ, categoryId, stock, sort, page, limit: 24 },
      });
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, categoryId, stock, sort, page]);

  useEffect(() => {
    api.get('/catalog/categories').then((r) => setCategories(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, categoryId, stock, sort]);

  /*
    WAPAS AANE PAR CATALOG TAAZA.

    Ye page ghanton khula pada reh sakta hai — retailer subah kholta hai, phone
    jeb me daal deta hai, shaam ko order karta hai. Us beech wholesaler rate
    badal chuka hota hai aur stock khatam ho chuka hota hai, par screen wahi
    purani tasveer dikhati rehti hai. Retailer ₹100 dekh kar order karta hai
    aur bill ₹120 ka aata hai — aur galti app ki dikhti hai.

    Isliye jab bhi ye tab dobara saamne aata hai, list chup-chaap taaza ho jati
    hai. `visibilitychange` isi ke liye hai: dobara khulne par hi chalta hai,
    background me nahi — na battery jati hai, na bekaar request.
  */
  useEffect(() => {
    const onWapas = () => { if (document.visibilityState === 'visible') load(true); };
    document.addEventListener('visibilitychange', onWapas);
    window.addEventListener('focus', onWapas);
    return () => {
      document.removeEventListener('visibilitychange', onWapas);
      window.removeEventListener('focus', onWapas);
    };
  }, [load]);

  // Kuch item pe wholesaler ne "kam se kam itna hi lena" laga rakha hai —
  // default 1 rakhne se "Daal dein" dabate hi server mana kar deta tha
  const minQty = (item) => Math.max(1, Number(item.minOrderQty || 0));

  async function add(item) {
    const qty = Number(qtys[item._id] || minQty(item));
    if (qty <= 0) return;
    setAdding(item._id);
    try {
      await api.post('/cart/items', { itemId: item._id, qty });
      await refreshCart();
      setQtys((s) => ({ ...s, [item._id]: minQty(item) }));
      setJustAdded(item._id);
      setTimeout(() => setJustAdded((v) => (v === item._id ? null : v)), 1800);
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
        title="Catalog"
        subtitle={business?.name ? `${business.name} ka saman` : 'Order karne ke liye item chunein'}
        action={
          cartCount > 0 && (
            <Button icon={ShoppingCart} onClick={() => navigate('/cart')}>
              Cart ({cartCount})
            </Button>
          )
        }
      />

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder="Item ka naam ya code..."
            className="w-full sm:w-64" />
          <Chips value={stock} onChange={setStock}
            options={[{ value: 'all', label: 'Sab' }, { value: 'in', label: 'Jo available hai' }]} />
          <div className="w-44">
            <Select placeholder="Sab categories" value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={categories.map((c) => ({ value: c._id, label: `${c.name} (${c.itemCount})` }))} />
          </div>
          <div className="w-40">
            <Select placeholder="" value={sort} onChange={(e) => setSort(e.target.value)} options={SORTS} />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={hasFilters ? Package : Store}
            title={hasFilters ? 'Kuch nahi mila' : 'Abhi catalog khali hai'}
            message={hasFilters
              ? 'Doosre naam se dhundh kar dekhein ya filter hata dein.'
              : `${business?.name || 'Wholesaler'} ne abhi koi item nahi daala. Thodi der baad dekhein.`}
            action={hasFilters && (
              <Button variant="secondary" onClick={() => { setQ(''); setCategoryId(''); setStock('all'); }}>
                Filter hatayein
              </Button>
            )}
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
                added={justAdded === item._id}
              />
            ))}
          </div>

          <Card className="mt-5" padding={false}>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </Card>
        </>
      )}
    </>
  );
}

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
            <Badge tone="red">Abhi khatam</Badge>
          </div>
        )}
        {item.inStock && item.hasSpecialRate && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            <Tag size={10} /> Aapka rate
          </span>
        )}
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
          {item.mrp > item.rate && (
            <span className="text-xs text-slate-400 line-through">{formatMoney(item.mrp)}</span>
          )}
        </div>

        {item.warrantyText && (
          <span className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <ShieldCheck size={10} /> {item.warrantyText} warranty
          </span>
        )}

        <p className={cn('mt-1 text-xs',
          !item.inStock ? 'text-red-600' : item.isLowStock ? 'text-amber-600' : 'text-slate-500')}>
          {item.inStock ? `${formatQty(item.stockQty, item.unit)} available` : 'Stock khatam'}
        </p>

        {item.minOrderQty > 1 && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            Kam se kam {formatQty(item.minOrderQty, item.unit)}
          </p>
        )}

        <div className="mt-3 flex-1" />

        {item.inStock ? (
          <div className="flex flex-col gap-2">
            <QtyStepper value={qty} onChange={onQty} min={Math.max(1, item.minOrderQty || 1)}
              size="sm" unit={item.unit} label={`${item.name} quantity`} />
            <Button size="sm" className="w-full" loading={adding} onClick={onAdd}
              variant={added ? 'success' : 'primary'} icon={added ? Check : ShoppingCart}>
              {added ? 'Daal diya' : 'Daal dein'}
            </Button>
          </div>
        ) : (
          <Button size="sm" className="w-full" disabled>Abhi khatam</Button>
        )}
      </div>
    </div>
  );
}

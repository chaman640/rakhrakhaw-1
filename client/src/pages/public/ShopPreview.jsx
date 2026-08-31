import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Search, Store, ShoppingCart, ArrowRight, Package } from 'lucide-react';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import useSeo from '@/lib/useSeo';

/*
  DUKAAN — BINA LOGIN KE.

  Account tabhi maanga jata hai jab aadmi SACH ME kuch lena chahe. Us pal tak
  use pata hota hai ki dukaan me kya hai aur kis daam pe — aur tab account
  banana uske liye ek kaam ka kadam hota hai, ek rukawat nahi.

  Khaas rate yahan nahi dikhta; wo har retailer ka apna hota hai aur login ke
  baad hi banta hai. Isliye neeche saaf likha rehta hai.
*/
export default function ShopPreview() {
  const { code } = useParams();
  const nav = useNavigate();

  const [shop, setShop] = useState(null);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState('');

  useSeo({
    title: shop ? `${shop.name} — Rakh Rakhav` : 'Dukaan — Rakh Rakhav',
    description: shop ? `${shop.name} ka poora maal aur daam dekhein. Order karne ke liye free account banayein.` : '',
    path: `/s/${code}`,
  });

  useEffect(() => {
    api.get(`/public/shop/${code}`).then((r) => setShop(r.data))
      .catch((e) => setErr(e.message));
  }, [code]);

  const load = useCallback(async (p, search) => {
    const r = await api.get(`/public/shop/${code}/items?page=${p}&q=${encodeURIComponent(search)}`);
    setItems((old) => (p === 1 ? r.data.items : [...old, ...r.data.items]));
    setMore(r.data.hasMore);
  }, [code]);

  useEffect(() => {
    const id = setTimeout(() => { setPage(1); load(1, q).catch(() => {}); }, 300);
    return () => clearTimeout(id);
  }, [q, load]);

  const lenaHai = () => nav(`/join/${code}`);

  if (err) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Store className="mx-auto mb-3 text-slate-300" size={40} />
        <p className="text-slate-700">{err}</p>
        <Link to="/" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">
          {t('Home')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          {shop?.logoUrl
            ? <img src={shop.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
            : <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white"><Store size={18} /></div>}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900 dark:text-slate-100">{shop?.name || '...'}</p>
            {shop?.city && <p className="text-xs text-slate-500">{shop.city}{shop.state ? `, ${shop.state}` : ''}</p>}
          </div>
          <button
            type="button"
            onClick={lenaHai}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {t('Order karein')}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Maal dhundhein')}
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 outline-none focus:border-brand-600 dark:border-slate-600 dark:bg-slate-800"
          />
        </div>

        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            {q ? t('Kuch nahi mila') : t('Ruko...')}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((i) => (
              <button
                key={i._id}
                type="button"
                onClick={lenaHai}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex aspect-square items-center justify-center bg-slate-50 dark:bg-slate-700">
                  {i.imageUrl
                    ? <img src={i.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <Package size={28} className="text-slate-300" />}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-slate-100">{i.name}</p>
                  {i.brand && <p className="text-[11px] text-slate-500">{i.brand}</p>}
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    ₹{i.rate}<span className="text-xs font-normal text-slate-500"> / {i.unit}</span>
                  </p>
                  {!i.inStock && <p className="text-[11px] text-amber-700">{t('Abhi khatam hai')}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {more && (
          <button
            type="button"
            onClick={() => { const n = page + 1; setPage(n); load(n, q).catch(() => {}); }}
            className="mx-auto mt-5 block rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            {t('Aur dikhayein')}
          </button>
        )}
      </main>

      {/* Neeche chipki patti — yahi wo pal hai jab account maanga jata hai */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('Order karne aur apna khaas rate dekhne ke liye free account banayein')}
          </p>
          <button
            type="button"
            onClick={lenaHai}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700"
          >
            <ShoppingCart size={16} /> {t('Order karein')} <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

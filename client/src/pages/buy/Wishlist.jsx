import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Package, Trash2, Plus, MessageSquarePlus } from 'lucide-react';
import api from '@/lib/api';
import { useShop } from '@/context/ShopContext';
import { useQuery, bust } from '@/hooks/useQuery';
import { formatMoney, formatDate } from '@/lib/format';
import { PageHeader, Card, Button, EmptyState, Spinner, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * WISHLIST — kharidaar ki "ye chahiye" list, har dukaan ki alag.
 *
 * Upar ek chhota dabba: jo maal dukaan me mila hi nahi, wo yahan likh do —
 * dukaandaar ko uski "Maang" wali list me dikhta hai. Neeche wo sab jo dil
 * (❤) daba kar rakha hai, aur saath me likha hua maal.
 */
export default function Wishlist() {
  const navigate = useNavigate();
  const toast = useToast();
  /*
    Dukaan `X-Shop-Id` header se jaati hai (api.js khud lagata hai); purane
    retailer ki dukaan server khud jaanta hai. Isliye yahan dukaan ka object
    zaroori nahi — sirf naam dikhane ke liye. Dukaan badalte hi poora cache
    saaf hota hai (ShopContext), isliye chaabi me dukaan nahi.
  */
  const { shop } = useShop();

  const { data: rows, loading, error, refetch } = useQuery(
    ['wishlist'],
    () => api.get('/wishlist').then((r) => r.data),
    { poll: false },
  );

  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  async function addText(e) {
    e.preventDefault();
    if (text.trim().length < 2) return;
    setAdding(true);
    try {
      await api.post('/wishlist', { text: text.trim() });
      setText('');
      toast.success(t('Dukaan ko bata diya ki aapko ye chahiye'));
      bust('wishlist');
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function remove(row) {
    try {
      await api.delete(`/wishlist/${row._id}`);
      bust('wishlist');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (error && !rows) {
    return (
      <>
        <PageHeader title={t('Wishlist')} />
        <Card>
          <EmptyState icon={Heart} title={t('Pehle dukaan chunein')} message={error.message}
            action={<Button onClick={() => navigate('/buy')}>{t('Dukaan dhundhein')}</Button>} />
        </Card>
      </>
    );
  }

  const list = rows || [];

  return (
    <>
      <PageHeader title={t('Wishlist')} subtitle={shop?.name} />

      <Card className="mb-4">
        <form onSubmit={addText} className="space-y-2">
          <label htmlFor="wish-text" className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <MessageSquarePlus size={16} className="text-brand-600" />
            {t('Jo maal dukaan me nahi mila, yahan likhein')}
          </label>
          <div className="flex gap-2">
            <input
              id="wish-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              placeholder={t('Jaise: Redmi 13 ka back cover, 20 pc')}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-600"
            />
            <Button type="submit" icon={Plus} loading={adding} disabled={text.trim().length < 2}>
              {t('Jodein')}
            </Button>
          </div>
          <p className="text-xs text-slate-500">{t('Dukaandaar ko dikhega ki aap kya dhoondh rahe hain')}</p>
        </form>
      </Card>

      <Card>
        {loading && !rows ? (
          <div className="flex justify-center py-12 text-slate-400"><Spinner size={24} /></div>
        ) : !list.length ? (
          <EmptyState
            icon={Heart}
            title={t('Wishlist khali hai')}
            message={t('Kisi bhi maal pe ❤ dabaiye — wo yahan aa jayega')}
            action={<Button variant="secondary" onClick={() => navigate('/shop')}>{t('Maal dekhein')}</Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((row) => (
              <li key={row._id} className="flex items-center gap-3 py-3">
                {row.item?.imageUrl ? (
                  <img src={row.item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    {row.itemId ? <Package size={20} /> : <MessageSquarePlus size={20} />}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!row.item}
                  onClick={() => row.item && navigate(`/shop/item/${row.item._id}`)}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  {row.item ? (
                    <>
                      <p className="truncate text-sm font-medium text-slate-900">{row.item.name}</p>
                      <p className="text-sm text-slate-700">
                        {formatMoney(row.item.rate)} <span className="text-xs text-slate-500">/ {row.item.unit}</span>
                      </p>
                      <p className={row.item.inStock ? 'text-xs text-emerald-700' : 'text-xs text-amber-700'}>
                        {row.item.inStock ? t('Stock me hai') : t('Abhi khatam hai')}
                      </p>
                    </>
                  ) : row.itemId ? (
                    <>
                      <p className="text-sm text-slate-500">{t('Ye maal ab dukaan me nahi dikh raha')}</p>
                      <p className="text-xs text-slate-400">{formatDate(row.createdAt)}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-900">{row.text}</p>
                      <p className="text-xs text-slate-500">
                        {t('Aapne maanga')} · {formatDate(row.createdAt)}
                      </p>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => remove(row)}
                  aria-label={t('Wishlist se hatayein')}
                  className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 focus-ring"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

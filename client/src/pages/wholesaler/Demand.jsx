import { useNavigate } from 'react-router-dom';
import { Heart, Package, MessageSquarePlus } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { formatQty, formatDate } from '@/lib/format';
import { PageHeader, Card, CardHeader, Badge, EmptyState, Spinner, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * MAANG — retailer kya chahte hain (unki wishlist se).
 *
 * Do hisse, kyunki dono ka kaam alag hai:
 *   - Apna maal jo logon ne ❤ kiya — khatam hai aur maang zyada hai to
 *     dobara mangwane ka seedha ishara.
 *   - Wo maal jo dukaan me HAI HI NAHI, retailer ne likh kar maanga — naya
 *     maal rakhne ka faisla isi se hota hai.
 */
export default function Demand() {
  const navigate = useNavigate();
  const toast = useToast();

  const { data, loading } = useQuery(
    ['wishlist-demand'],
    () => api.get('/wishlist-demand').then((r) => r.data),
    { onError: (err) => toast.error(err.message) },
  );

  const items = data?.items || [];
  const asks = data?.asks || [];

  return (
    <>
      <PageHeader
        title={t('Maang')}
        subtitle={t('Retailer kya chahte hain — unki wishlist se')}
      />

      {loading && !data ? (
        <div className="flex justify-center py-16 text-slate-400"><Spinner size={26} /></div>
      ) : (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={t('Jo maal dukaan me nahi hai')}
              subtitle={t('Retailer ne likh kar maanga — naya maal rakhne ka ishara')}
            />
            {!asks.length ? (
              <EmptyState icon={MessageSquarePlus} title={t('Abhi kisi ne kuch nahi maanga')} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {asks.map((a) => (
                  <li key={a._id} className="flex items-start gap-3 py-3">
                    <MessageSquarePlus size={16} className="mt-0.5 shrink-0 text-brand-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{a.text}</p>
                      <p className="text-xs text-slate-500">
                        {a.partyName ? (
                          <button type="button" className="underline" onClick={() => navigate(`/retailers/${a.partyId}`)}>
                            {a.partyName}
                          </button>
                        ) : t('Retailer')}
                        {' · '}{formatDate(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={t('Aapka maal jo wishlist me hai')}
              subtitle={t('Kitne retailers ne ❤ kiya — sabse zyada upar')}
            />
            {!items.length ? (
              <EmptyState icon={Heart} title={t('Abhi kisi ne wishlist me kuch nahi rakha')} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((it) => (
                  <li key={it.itemId} className="flex items-center gap-3 py-3">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Package size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{it.name}</p>
                      <p className="text-xs text-slate-500">
                        {t('Stock')}: {formatQty(it.stockQty, it.unit)}
                        {it.hidden && ` · ${t('Chhupa hua')}`}
                      </p>
                    </div>
                    {it.stockQty <= 0 && <Badge tone="red">{t('Khatam')}</Badge>}
                    <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-rose-600">
                      <Heart size={14} className="fill-current" /> {it.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

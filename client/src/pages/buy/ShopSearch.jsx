import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Store, Bookmark, BookmarkCheck, Package, Layers, Clock, ArrowRight, Phone,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { formatMoney } from '@/lib/format';
import {
  PageHeader, Card, Button, Badge, EmptyState, Spinner, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * DUKAAN DHOONDHO — NUMBER SE.
 *
 * Yahi wo page hai jisne "ek retailer, ek hi wholesaler" wali gaanth kholi hai.
 *
 * Pehle doosri dukaan se judne ka ek hi rasta tha: uska invite link maango,
 * WhatsApp pe aane ka intezaar karo, aur usse ek NAYA account banao — naye
 * number pe, naye khate ke saath. Ab: number daalo, dukaan saamne, ek tap me
 * jud jao. Purana khata, purane bill, purane order — sab apni jagah rehte hain.
 *
 * Number se hi kyun (naam se khoj kyun nahi):
 * Naam se khoj ka matlab hota har dukaan ka naam, catalog aur rate har kisi ko
 * dikhna. Number bill pe pehle se chhapta hai — jise sach me kaam hai uske paas
 * wo pehle se hai. Poora 10 ank sahi milna zaroori hai, isliye koi anjaan aadmi
 * ek ek karke dukaanein nahi taad sakta.
 *
 * Neeche "Save ki hui dukaanein" wali list Instagram ki search history jaisi
 * hai: ek baar jud gaye to logo, naam aur number saamne rehte hain — number
 * dobara likhna hi nahi padta.
 */

const TEN_DIGITS = /^\d{10}$/;

export default function ShopSearch() {
  const toast = useToast();
  const navigate = useNavigate();
  const { isRetailer } = useAuth();
  const { shops, shopId, loadingShops, selectShop, refreshShops } = useShop();

  const [phone, setPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Page khulte hi list taaza — doosre phone se koi dukaan judi ho to yahin dikhe
  useEffect(() => { refreshShops(); }, [refreshShops]);

  const clean = phone.replace(/\D/g, '').slice(-10);
  const ready = TEN_DIGITS.test(clean);

  async function search(e) {
    e?.preventDefault();
    if (!ready) {
      toast.error(t('Poora 10 digit ka number daalein'));
      return;
    }
    setSearching(true);
    setFound(null);
    try {
      const res = await api.get('/shops/lookup', { params: { phone: clean } });
      setFound(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  }

  /** Judo — us dukaan ke andar apni entry ban jati hai */
  async function connect(shop) {
    setBusyId(shop._id);
    try {
      const res = await api.post('/shops/connect', { businessId: shop._id });
      setFound(res.data);
      await refreshShops();
      toast.success(res.message);
      // Approve ho chuka hai to seedha uske maal me le chalo
      if (res.data.partyStatus !== 'pending') open(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  /** Save / save hatana — follow wala button */
  async function toggleSave(shop) {
    setBusyId(shop._id);
    try {
      const res = shop.saved
        ? await api.delete(`/shops/${shop._id}/save`)
        : await api.post(`/shops/${shop._id}/save`);
      if (found && found._id === shop._id) setFound(res.data);
      await refreshShops();
      toast.info(res.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  /** Dukaan kholo — ab se har request isi dukaan ke andar jayegi */
  function open(shop) {
    if (shop.partyStatus === 'pending') {
      toast.info(t('Ye dukaan abhi aapko approve nahi kar payi hai'));
      return;
    }
    selectShop(shop._id);
    navigate('/shop');
  }

  return (
    <>
      <PageHeader
        title={t('Dukaan')}
        subtitle={t('Jis dukaan se maal lena hai uska number daalein')}
      />

      {/* ─── number wali khoj ─── */}
      <Card className="mb-5">
        <form onSubmit={search} className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="shop-phone" className="mb-1 block text-sm font-medium text-slate-700">
              {t('Dukaan ka number')}
            </label>
            <div className="relative">
              <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="shop-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                maxLength={15}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('10 digit ka mobile number')}
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-base tracking-wide
                           placeholder:text-sm placeholder:tracking-normal placeholder:text-slate-400
                           hover:border-slate-400 focus-ring"
              />
            </div>
          </div>
          <Button type="submit" icon={Search} loading={searching} size="lg" disabled={!ready}>
            {t('Dhundhein')}
          </Button>
        </form>

        <p className="mt-2 text-xs text-slate-400">
          {t('Wahi number jo unke bill pe chhapta hai. Aadha number kaam nahi karega.')}
        </p>
      </Card>

      {/* ─── jo mila ─── */}
      {searching && (
        <div className="flex justify-center py-10 text-slate-400"><Spinner size={26} /></div>
      )}

      {!searching && found && (
        <div className="mb-6">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('Ye dukaan mili')}
          </p>
          <ShopCard
            shop={found}
            busy={busyId === found._id}
            onConnect={() => connect(found)}
            onOpen={() => open(found)}
            onToggleSave={() => toggleSave(found)}
            big
          />
        </div>
      )}

      {/* ─── save ki hui dukaanein (search history jaisi) ─── */}
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {t('Aapki dukaanein')}
        </p>
        {shops.length > 0 && (
          <span className="text-xs text-slate-400">{t('{n} dukaan', { n: shops.length })}</span>
        )}
      </div>

      {loadingShops && !shops.length ? (
        <div className="flex justify-center py-10 text-slate-400"><Spinner size={26} /></div>
      ) : !shops.length ? (
        <Card>
          <EmptyState
            icon={Store}
            title={t('Abhi koi dukaan judi nahi hai')}
            message={isRetailer
              ? t('Upar number daal kar dhundhein. Jud jane ke baad wo yahan hamesha dikhegi.')
              : t('Jis wholesaler se aap maal lete hain uska number upar daalein. Jud jane ke baad wo yahan hamesha dikhegi.')}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {shops.map((shop) => (
            <ShopCard
              key={shop._id}
              shop={shop}
              active={String(shop._id) === String(shopId)}
              busy={busyId === shop._id}
              onOpen={() => open(shop)}
              onToggleSave={() => toggleSave(shop)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────── ek dukaan ka card ─────────────────────────────── */

function ShopCard({ shop, active, busy, big, onConnect, onOpen, onToggleSave }) {
  const pending = shop.partyStatus === 'pending';

  return (
    <Card className={cn(active && 'ring-2 ring-brand-500')} padding={false}>
      <div className="flex items-start gap-3 p-4">
        {shop.logoUrl ? (
          <img
            src={shop.logoUrl}
            alt=""
            className={cn('shrink-0 rounded-xl object-cover', big ? 'h-16 w-16' : 'h-12 w-12')}
          />
        ) : (
          <div className={cn(
            'flex shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400',
            big ? 'h-16 w-16' : 'h-12 w-12',
          )}>
            <Store size={big ? 26 : 20} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-semibold text-slate-900">{shop.name}</p>
            {active && <Badge tone="green">{t('Khuli hai')}</Badge>}
            {pending && <Badge tone="amber">{t('Approve baaki')}</Badge>}
          </div>

          <p className="mt-0.5 truncate text-xs text-slate-500">
            {shop.phone}
            {shop.city ? ` · ${shop.city}` : ''}
          </p>

          {/*
            Item aur category ki ginti — Instagram ke "followers / following"
            jaisi. Ye do number hi batate hain ki dukaan me sach me maal hai ya
            khali padi hai; bina inke aadmi jud kar khali catalog dekhta hai.
          */}
          {(shop.itemCount !== null && shop.itemCount !== undefined) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Package size={13} className="text-slate-400" />
                {t('{n} item', { n: shop.itemCount })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Layers size={13} className="text-slate-400" />
                {t('{n} category', { n: shop.categoryCount })}
              </span>
            </div>
          )}

          {shop.connected && shop.balance > 0 && (
            <p className="mt-1.5 text-xs text-red-600">
              {t('Aapka baaki: {a}', { a: formatMoney(shop.balance) })}
            </p>
          )}
        </div>

        {/* Save — follow jaisa. Juda hua ho tabhi dikhta hai. */}
        {shop.connected && (
          <button
            type="button"
            onClick={onToggleSave}
            disabled={busy}
            aria-label={shop.saved ? t('Save hatayein') : t('Save karein')}
            title={shop.saved ? t('Save hatayein') : t('Save karein')}
            className={cn(
              'shrink-0 rounded-lg p-2 transition-colors focus-ring',
              shop.saved ? 'text-brand-600 hover:bg-brand-50' : 'text-slate-400 hover:bg-slate-100',
            )}
          >
            {shop.saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
        {shop.isOwn ? (
          <p className="text-xs text-slate-500">{t('Ye aapki apni dukaan hai')}</p>
        ) : !shop.connected ? (
          <Button size="sm" icon={ArrowRight} loading={busy} onClick={onConnect}>
            {t('Jud jayein')}
          </Button>
        ) : pending ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-amber-700">
            <Clock size={13} />
            {t('Unke approve karte hi maal dikhne lagega')}
          </p>
        ) : (
          <Button size="sm" variant={active ? 'secondary' : 'primary'} icon={Store} onClick={onOpen}>
            {active ? t('Maal dekhein') : t('Is dukaan me jayein')}
          </Button>
        )}
      </div>
    </Card>
  );
}

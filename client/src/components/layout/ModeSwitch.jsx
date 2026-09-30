import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ShoppingBag, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { Card, CardHeader, ConfirmModal } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * Seller ⇄ Buyer switch, kept in Settings so it stays out of the everyday screens.
 * Only for wholesalers allowed to buy (`canBuy`); switching always asks first.
 */
export default function ModeSwitch({ className }) {
  const navigate = useNavigate();
  const { isRetailer, canBuy } = useAuth();
  const { mode, setMode, shop } = useShop();
  const [pending, setPending] = useState(null); // 'sell' | 'buy' | null

  if (isRetailer || !canBuy) return null;

  const selling = mode !== 'buy';

  function confirm() {
    const next = pending;
    setPending(null);
    setMode(next);
    navigate(next === 'buy' ? '/buy' : '/menu');
  }

  return (
    <Card className={className}>
      <CardHeader
        title={t('Seller / Buyer mode')}
        subtitle={selling
          ? t('Abhi aap Seller mode me hain — apni dukaan chala rahe hain')
          : t('Abhi aap Buyer mode me hain — {n} se maal le rahe hain', { n: shop?.name || t('doosri dukaan') })}
      />
      <button
        type="button"
        onClick={() => setPending(selling ? 'buy' : 'sell')}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3.5 py-3 text-left hover:bg-slate-50 focus-ring"
      >
        <span className="flex items-center gap-2.5">
          {selling ? <ShoppingBag size={17} className="text-slate-500" /> : <Store size={17} className="text-slate-500" />}
          <span>
            <span className="block text-sm font-medium text-slate-900">
              {selling ? t('Buyer mode mein jaayein') : t('Seller mode mein wapas jaayein')}
            </span>
            <span className="block text-xs text-slate-500">
              {selling ? t('Doosri dukaan se maal lein') : t('Apni dukaan pe wapas aayein')}
            </span>
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-400" />
      </button>

      <ConfirmModal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        title={pending === 'buy' ? t('Buyer mode mein jaayein?') : t('Seller mode mein wapas jaayein?')}
        message={pending === 'buy'
          ? t('Ab aapko apni dukaan ki jagah jis dukaan se khareed rahe hain uska catalog, khata aur order dikhenge.')
          : t('Ab aapko apni dukaan ka Menu, Items, Orders aur Khata wapas dikhenge.')}
        confirmLabel={t('Haan, badlein')}
      />
    </Card>
  );
}

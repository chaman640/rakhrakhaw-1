import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ShoppingBag, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { Card, CardHeader, ConfirmModal } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * SELLER  ⇄  BUYER (Part 52, 53)
 *
 * Ek hi account ke do darwaze.
 *
 * PEHLE ye Profile (settings) page pe tha — apni dukaan ka naam/GST/UPI
 * badalne wale kaam ke beech mein ek "poori duniya badal do" wala button
 * dekh kar log confuse ho jaate the: "ye kya hai, isse kya hoga".
 *
 * AB Menu pe hai (poora, bada toggle) — jahan aadmi "kya karna hai" soch kar
 * aata hai. Settings me bhi ek CHHOTA rasta wapas rakha gaya hai (`compact`
 * prop) — kyunki kuch log settings mein hi dhoondhte hain — par is baar
 * poora "Seller/Buyer" wala bada UI nahi, sirf ek chhota button jo seedha
 * Menu jaisa hi confirmation dikha kar badalta hai. Confusion ka asli
 * karan bada, do-button-wala UI settings ke beech mein tha — ek chhoti
 * line usi tarah confuse nahi karti.
 *
 * Par Menu ab bahut baar khulta hai (har "peeche" button Menu pe hi le jaata
 * hai — AppLayout.jsx dekhien) — isliye SIRF jagah badalna kaafi nahi tha.
 * Ek CONFIRMATION jodi gayi hai: tap karte hi seedha badal nahi jaata, pehle
 * poochha jaata hai. Isse angoothe se galti se lagne ka wahi purana khatra
 * nahi rehta, chahe page kitni hi baar kyun na khule — aur ye confirmation
 * dono jagah (poora aur `compact`) ek hi jaisi hai.
 *
 * Kis-kis ko dikhta hai: sirf us wholesaler ko jiske paas maal khareedne ka
 * haq hai (`canBuy` — server ka faisla, `purchases:create`). Godown incharge ko
 * bhi dikhta hai, kyunki wo haq uske role me pehle se hai. Salesman ko nahi.
 */
export default function ModeSwitch({ compact = false }) {
  const navigate = useNavigate();
  const { isRetailer, canBuy } = useAuth();
  const { mode, setMode, shop } = useShop();
  const [pending, setPending] = useState(null); // 'sell' | 'buy' | null

  // Retailer ka poora kaam hi khareedna hai — usko chunne ko kuch hai hi nahi
  if (isRetailer || !canBuy) return null;

  const selling = mode !== 'buy';

  function ask(next) {
    if (next === mode) return;
    setPending(next);
  }

  function confirm() {
    const next = pending;
    setPending(null);
    setMode(next);
    // Darwaza badla to seedha us duniya ke ghar pe — warna aadmi wahi purana
    // page dekhta rehta hai aur lagta hai ki button ne kuch kiya hi nahi
    navigate(next === 'buy' ? '/buy' : '/menu');
  }

  const modal = (
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
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => ask(selling ? 'buy' : 'sell')}
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
        {modal}
      </>
    );
  }

  return (
    <>
      <Card className="mb-5">
        <CardHeader
          title={t('Aap abhi kya kar rahe hain?')}
          subtitle={t('Bechna ho to Seller, doosri dukaan se maal lena ho to Buyer')}
        />

        <div className="grid grid-cols-2 gap-3">
          <ModeButton
            active={selling}
            icon={Store}
            label={t('Seller')}
            hint={t('Apni dukaan chalayein')}
            onClick={() => ask('sell')}
          />
          <ModeButton
            active={!selling}
            icon={ShoppingBag}
            label={t('Buyer')}
            hint={shop?.name || t('Doosri dukaan se maal lein')}
            onClick={() => ask('buy')}
          />
        </div>

        {!selling && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            {t('Buy mode chalu hai — Orders, Items aur Khata abhi aapki apni dukaan ke nahi, jis dukaan se aap khareed rahe hain uske dikh rahe hain.')}
          </p>
        )}
      </Card>

      {modal}
    </>
  );
}

function ModeButton({ active, icon: Icon, label, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // min-h-20 — ye do button poori duniya badalte hain, isliye bade hain.
        // Chhote rakhne pe ungli chook kar galat darwaza khol deti hai.
        'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center transition-colors focus-ring',
        active
          ? 'border-brand-600 bg-brand-50 text-brand-800'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      )}
    >
      <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
      <span className={cn('text-sm', active ? 'font-semibold' : 'font-medium')}>{label}</span>
      <span className="line-clamp-1 text-[11px] text-slate-500">{hint}</span>
    </button>
  );
}

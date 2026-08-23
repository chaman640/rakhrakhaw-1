import { useNavigate } from 'react-router-dom';
import { Store, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { Card, CardHeader } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * SELLER  ⇄  BUYER
 *
 * Ek hi account ke do darwaze. Ye toggle Profile page pe hai — jaan-boojh kar.
 *
 * Neeche wali patti me daalne ki koshish ki thi. Wo ulta pad gaya: wo patti roz
 * ke kaam ke liye hai aur waha ka har button ek hi tap se dab jata hai. Poori
 * duniya badal dene wala button aisi jagah nahi hona chahiye jahan angootha
 * galti se lag jaye — aadmi bill banane ja raha hota aur achanak doosri dukaan
 * ka catalog khul jata.
 *
 * Profile do tap door hai, aur din me do baar hi khulta hai — darwaza badalne
 * ka kaam bhi utni hi baar hota hai. Dono ka mel baith gaya.
 *
 * Kis-kis ko dikhta hai: sirf us wholesaler ko jiske paas maal khareedne ka
 * haq hai (`canBuy` — server ka faisla, `purchases:create`). Godown incharge ko
 * bhi dikhta hai, kyunki wo haq uske role me pehle se hai. Salesman ko nahi.
 */
export default function ModeSwitch() {
  const navigate = useNavigate();
  const { isRetailer, canBuy } = useAuth();
  const { mode, setMode, shop } = useShop();

  // Retailer ka poora kaam hi khareedna hai — usko chunne ko kuch hai hi nahi
  if (isRetailer || !canBuy) return null;

  const selling = mode !== 'buy';

  function choose(next) {
    if (next === mode) return;
    setMode(next);
    // Darwaza badla to seedha us duniya ke ghar pe — warna aadmi wahi purana
    // page dekhta rehta hai aur lagta hai ki button ne kuch kiya hi nahi
    navigate(next === 'buy' ? '/buy' : '/home');
  }

  return (
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
          onClick={() => choose('sell')}
        />
        <ModeButton
          active={!selling}
          icon={ShoppingBag}
          label={t('Buyer')}
          hint={shop?.name || t('Doosri dukaan se maal lein')}
          onClick={() => choose('buy')}
        />
      </div>

      {!selling && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          {t('Buy mode chalu hai — Orders, Items aur Khata abhi aapki apni dukaan ke nahi, jis dukaan se aap khareed rahe hain uske dikh rahe hain.')}
        </p>
      )}
    </Card>
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

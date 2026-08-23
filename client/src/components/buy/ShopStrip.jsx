import { useNavigate } from 'react-router-dom';
import { Store, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useShop } from '@/context/ShopContext';
import { t } from '@/lib/i18n';

/**
 * DUKAAN BADALNE KI PATTI.
 *
 * Order, bill aur khata — teenon KISI EK dukaan ke hote hain. Ek hi dukaan thi
 * tab ye sawal uthta hi nahi tha, isliye kahin likha bhi nahi tha.
 *
 * Ab do-teen dukaanein ho sakti hain, aur uske saath ek chup-chaap wali galti
 * aa jati hai: aadmi "My Orders" khol kar dekhta hai ki uska order hai hi nahi
 * — kyunki wo order DOOSRI dukaan me hai. Wo maan leta hai ki order gaya hi
 * nahi, aur dobara bhej deta hai.
 *
 * Isliye in teeno page ke upar ye patti hai: kis dukaan ka hisaab dikh raha
 * hai, aur baaki kaun kaun si hain. Ek tap me dukaan badal jati hai.
 *
 * Ek hi dukaan judi ho to ye patti dikhti hi nahi — tab chunne ko kuch hai
 * nahi, aur ek khana ghera bina wajah jagah kha jata.
 */
export default function ShopStrip({ className }) {
  const navigate = useNavigate();
  const { buying, shops, shopId, selectShop } = useShop();

  if (!buying || shops.length < 2) return null;

  return (
    <div className={cn('mb-4', className)}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {shops.map((s) => {
          const active = String(s._id) === String(shopId);
          return (
            <button
              key={s._id}
              type="button"
              onClick={() => selectShop(s._id)}
              aria-pressed={active}
              className={cn(
                // min-h-11 — ungli se galat dukaan na dab jaye
                'flex min-h-11 shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 transition-colors focus-ring',
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s.logoUrl ? (
                <img src={s.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Store size={14} />
                </span>
              )}
              <span className={cn('max-w-[9rem] truncate text-sm', active ? 'font-semibold' : 'font-medium')}>
                {s.name}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => navigate('/buy')}
          aria-label={t('Nayi dukaan jodein')}
          title={t('Nayi dukaan jodein')}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3.5 text-sm font-medium text-slate-500 hover:bg-slate-50 focus-ring"
        >
          <Plus size={15} />
          {t('Aur')}
        </button>
      </div>
    </div>
  );
}

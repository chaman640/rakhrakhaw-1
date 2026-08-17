import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useOrderBadge } from '@/hooks/useOrderBadge';
import { wholesalerNav, retailerNav, bottomNavFor } from './navConfig';
import { t } from '@/lib/i18n';

/**
 * NEECHE WALI PATTI — phone aur tablet pe.
 *
 * Kyun banayi: pehle har page teen line wale button ke andar chhupa tha. Dukaan
 * me ek haath maal me laga hota hai, aur upar-baayein kone tak angootha
 * pahunchta hi nahi — har baar phone ghumana padta tha. Ab char sabse zyada
 * chalne wale kaam angoothe ke ठीक neeche hain.
 *
 * Desktop pe ye chhup jati hai (`lg:hidden`) kyunki wahan poori sidebar dikhti
 * hai — do jagah ek hi menu dena sirf jagah kharab karta hai.
 *
 * `pb-[env(safe-area-inset-bottom)]` iPhone ke liye hai — warna sabse neeche
 * wali line home wale danda (home indicator) ke peeche chali jati hai.
 */
export default function BottomNav() {
  const { isRetailer, can } = useAuth();
  const { count: cartCount } = useCart();
  const newOrders = useOrderBadge();

  const nav = isRetailer ? retailerNav : wholesalerNav.filter((n) => !n.perm || can(n.perm));
  const items = bottomNavFor(nav, isRetailer);
  const badges = { cartCount, newOrders };

  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden',
        'pb-[env(safe-area-inset-bottom)]'
      )}
      aria-label={t('Neeche wala menu')}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {items.map(({ to, label, icon: Icon, badgeKey }) => {
          const badge = badgeKey ? badges[badgeKey] : 0;
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  // min-h-14 = 56px — angootha itni jagah aaram se dabata hai.
                  // Isse chhota rakhne pe bagal wala button dab jata hai.
                  'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors focus-ring',
                  isActive ? 'text-brand-700' : 'text-slate-500 active:bg-slate-50'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} />
                    {badge > 0 && (
                      <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-4 text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  <span className={cn('truncate text-[11px] leading-tight', isActive && 'font-semibold')}>
                    {t(label)}
                  </span>
                  {isActive && (
                    <span className="absolute inset-x-3 top-0 h-0.5 rounded-b bg-brand-600" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/*
          Paanchva khana — Menu.

          Pehle ye ek button tha jo side wali daraz kholta tha. Ab ye seedha
          `/menu` page pe le jata hai. Faayda sirf dikhne ka nahi: daraz ka koi
          pata (URL) nahi hota tha, peeche wala button use band kar deta tha,
          aur usme dhoondhne ka koi tarika hi nahi tha.
        */}
        <NavLink
          to="/menu"
          aria-label={t('Poora menu')}
          className={({ isActive }) =>
            cn(
              'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors focus-ring',
              isActive ? 'text-brand-700' : 'text-slate-500 active:bg-slate-50'
            )
          }
        >
          {({ isActive }) => (
            <>
              <Menu size={21} strokeWidth={isActive ? 2.4 : 1.9} />
              <span className={cn('text-[11px] leading-tight', isActive && 'font-semibold')}>{t('Menu')}</span>
              {isActive && <span className="absolute inset-x-3 top-0 h-0.5 rounded-b bg-brand-600" />}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
}

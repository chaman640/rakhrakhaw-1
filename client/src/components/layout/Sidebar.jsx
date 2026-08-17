import { NavLink } from 'react-router-dom';
import { Store } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useOrderBadge } from '@/hooks/useOrderBadge';
import { wholesalerNav, retailerNav } from './navConfig';
import { t } from '@/lib/i18n';

const STAFF_LABEL = { manager: 'Manager', salesman: 'Salesman', accountant: 'Munshi' };

/**
 * Poora menu — SIRF DESKTOP PE.
 *
 * Part 15 step 5 se pehle ye phone pe bhi thi: neeche wale "Menu" button se
 * side se aane wali daraz. Wo hata di gayi, kyunki phone pe uski jagah ab
 * `/menu` naam ka apna page hai (khoj + A se Z).
 *
 * Do jagah ek hi list rakhne ka matlab hota do jagah maintain karna — aur wo
 * dono dheere dheere alag ho jati hain. List ab ek hi jagah se aati hai
 * (`navConfig.js`), bas dikhne ke do roop hain: bade screen pe hamesha khuli
 * patti, phone pe apna page.
 */
export default function Sidebar() {
  const { isRetailer, business, user, can, staffRole } = useAuth();
  const { count: cartCount } = useCart();
  const newOrders = useOrderBadge();

  // Staff ko sirf uske kaam ka menu dikhega
  const nav = isRetailer ? retailerNav : wholesalerNav.filter((n) => !n.perm || can(n.perm));
  const badges = { cartCount, newOrders };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      {/* Dukaan ka naam */}
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {business?.logoUrl ? (
            <img src={business.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Store size={18} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {business?.name || 'Rakh Rakhav'}
            </p>
            <p className="truncate text-xs text-slate-500">
              {isRetailer ? t('Retailer') : t(staffRole && staffRole !== 'owner' ? STAFF_LABEL[staffRole] : 'Wholesaler')}
            </p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(({ to, label, icon: Icon, badgeKey }) => {
          const badge = badgeKey ? badges[badgeKey] : 0;
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1 truncate">{t(label)}</span>
              {badge > 0 && (
                <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <p className="truncate text-xs text-slate-400">{user?.name} · {user?.phone}</p>
      </div>
    </aside>
  );
}

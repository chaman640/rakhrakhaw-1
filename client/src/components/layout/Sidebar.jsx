import { NavLink } from 'react-router-dom';
import { X, Store } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useOrderBadge } from '@/hooks/useOrderBadge';
import { wholesalerNav, retailerNav } from './navConfig';

const STAFF_LABEL = { manager: 'Manager', salesman: 'Salesman', accountant: 'Munshi' };

export default function Sidebar({ open, onClose }) {
  const { isRetailer, business, user, can, staffRole } = useAuth();
  const { count: cartCount } = useCart();
  const newOrders = useOrderBadge();
  // Staff ko sirf uske kaam ka menu dikhega
  const nav = isRetailer ? retailerNav : wholesalerNav.filter((n) => !n.perm || can(n.perm));
  const badges = { cartCount, newOrders };

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {business?.logoUrl ? (
              <img src={business.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
                <Store size={18} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {business?.name || 'Rakh Rakhav'}
              </p>
              <p className="truncate text-xs text-slate-500">
                {isRetailer ? 'Retailer' : (staffRole && staffRole !== 'owner' ? STAFF_LABEL[staffRole] : 'Wholesaler')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map(({ to, label, icon: Icon, badgeKey }) => {
            const badge = badgeKey ? badges[badgeKey] : 0;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )
                }
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <p className="truncate text-xs text-slate-400">{user?.name} · {user?.phone}</p>
        </div>
      </aside>
    </>
  );
}

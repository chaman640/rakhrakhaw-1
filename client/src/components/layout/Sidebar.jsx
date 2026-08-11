import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X, Store } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useOrderBadge } from '@/hooks/useOrderBadge';
import { wholesalerNav, retailerNav } from './navConfig';

const STAFF_LABEL = { manager: 'Manager', salesman: 'Salesman', accountant: 'Munshi' };

/**
 * Poora menu.
 *
 * Desktop pe ye hamesha khuli rehti hai (baayein taraf).
 * Phone/tablet pe ye neeche wale "Menu" button se khulne wali daraz hai —
 * usme wo saare kaam hain jo neeche ki char khano me nahi aa paye.
 *
 * z-[60] isliye taaki ye neeche wali patti (z-40) ke upar aaye — warna daraz
 * ke aakhri do item patti ke peeche chhup jate.
 */
export default function Sidebar({ open, onClose }) {
  const { isRetailer, business, user, can, staffRole } = useAuth();
  const { count: cartCount } = useCart();
  const newOrders = useOrderBadge();

  // Staff ko sirf uske kaam ka menu dikhega
  const nav = isRetailer ? retailerNav : wholesalerNav.filter((n) => !n.perm || can(n.perm));
  const badges = { cartCount, newOrders };

  // Daraz khuli ho to peeche ka page scroll na ho — warna ungli daraz pe
  // chalti hai aur page peeche khisakta rehta hai
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Escape se band ho jaye
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[60] flex w-[17rem] max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200',
          'lg:z-30 lg:w-64 lg:max-w-none lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Dukaan ka naam */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-3 sm:h-16 sm:px-4">
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
                {isRetailer ? 'Retailer' : (staffRole && staffRole !== 'owner' ? STAFF_LABEL[staffRole] : 'Wholesaler')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Menu band karein"
            className="-mr-1 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden focus-ring"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {nav.map(({ to, label, icon: Icon, badgeKey }) => {
            const badge = badgeKey ? badges[badgeKey] : 0;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    // py-3 mobile pe — 44px se bada tap ghera, ungli se galat item nahi dabta
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors sm:py-2.5',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100'
                  )
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {badge > 0 && (
                  <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="truncate text-xs text-slate-400">{user?.name} · {user?.phone}</p>
        </div>
      </aside>
    </>
  );
}

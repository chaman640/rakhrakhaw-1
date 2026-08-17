import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { useAuth } from '@/context/AuthContext';
import { useIsFetching } from '@/hooks/useQuery';
import { RefreshBar } from '@/components/ui';
import { wholesalerNav, retailerNav, isRootPage } from './navConfig';
import { t } from '@/lib/i18n';

/**
 * Poore app ka dhancha — mobile pehle.
 *
 *   Phone / tablet:  upar patli patti (back + naam)   →  content  →  NEECHE patti
 *   Desktop (lg+):   baayein sidebar                  →  content
 *
 * Neeche wali patti sirf lg se chhoti screen pe hai, isliye content ke neeche
 * utni hi jagah chhodni padti hai (`pb-20 lg:pb-6`) — warna aakhri button
 * patti ke peeche chhup jata hai aur user use daba hi nahi pata.
 */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isRetailer, can } = useAuth();
  const { pathname } = useLocation();
  const fetching = useIsFetching();

  const fullNav = isRetailer ? retailerNav : wholesalerNav;
  const allowedNav = isRetailer ? retailerNav : fullNav.filter((n) => !n.perm || can(n.perm));

  // Sabse lamba milta hua rasta — `/invoices/123` pe bhi "Invoices" dikhe
  const current = [...fullNav]
    .sort((a, b) => b.to.length - a.to.length)
    .find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));

  const atRoot = isRootPage(pathname, allowedNav, isRetailer);

  /**
   * Back ka "plan B" — jab history khali ho (link se seedha khola ya refresh).
   *
   *   /invoices/123  ->  /invoices   (apni list pe)
   *   /invoices      ->  /dashboard  (ghar pe)
   *
   * Doosri line zaroori hai: pehle yahan hamesha section ka apna rasta jata
   * tha, yaani /settings pe back dabane se /settings hi khulta tha — kuch
   * hota hi nahi dikhta tha.
   */
  const homeRoot = '/home';
  const backTo = current && pathname !== current.to ? current.to : homeRoot;

  // Page badalte hi menu band — warna naye page pe drawer khula reh jata hai
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Net dheema ho to sabse upar 2px ki patti — page rukta nahi hai */}
      <RefreshBar show={fetching} />

      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="lg:pl-64">
        <Header
          title={current?.label ? t(current.label) : ''}
          showBack={!atRoot}
          backTo={backTo}
        />

        <main className="px-4 pb-20 pt-4 sm:px-5 lg:px-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <BottomNav onMenuClick={() => setMenuOpen((v) => !v)} menuOpen={menuOpen} />
    </div>
  );
}

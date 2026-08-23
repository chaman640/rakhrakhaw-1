import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { useIsFetching } from '@/hooks/useQuery';
import { RefreshBar } from '@/components/ui';
import { wholesalerNav, buyerNav, isRootPage } from './navConfig';
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
  const { can } = useAuth();
  // Menu ab role se nahi, DARWAZE se tay hota hai — wahi wholesaler Seller me
  // apni dukaan chalata hai aur Buyer me doosri dukaan se maal mangwata hai
  const { buying } = useShop();
  const { pathname } = useLocation();
  const fetching = useIsFetching();

  const fullNav = buying ? buyerNav : wholesalerNav;
  const allowedNav = buying ? buyerNav : fullNav.filter((n) => !n.perm || can(n.perm));

  // Sabse lamba milta hua rasta — `/invoices/123` pe bhi "Invoices" dikhe
  const current = [...fullNav]
    .sort((a, b) => b.to.length - a.to.length)
    .find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));

  const atRoot = isRootPage(pathname, allowedNav, buying);

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Net dheema ho to sabse upar 2px ki patti — page rukta nahi hai */}
      <RefreshBar show={fetching} />

      <Sidebar />

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

      <BottomNav />
    </div>
  );
}

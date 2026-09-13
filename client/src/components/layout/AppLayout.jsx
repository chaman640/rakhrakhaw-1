import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PlanNeeded from '@/pages/wholesaler/PlanNeeded';
import OnboardingTour from '@/components/tutorial/OnboardingTour';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { useIsFetching } from '@/hooks/useQuery';
import { RefreshBar } from '@/components/ui';
import { wholesalerNav, buyerNav, isRootPage } from './navConfig';
import { cn } from '@/lib/cn';
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
  const { can, business, isWholesaler } = useAuth();
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

  /*
    ─────────── PLAN KHATAM TO BECHNE KA HISSA BAND (Step 1) ───────────

    `lib/api.js` server ka `subscription_required` pakad kar ek nishaan lagata
    hai. Yahan wo nishaan dekh kar bechne wale hisse ki jagah plan wala parda
    dikha dete hain.

    KHARIDNE WALA HISSA CHHUA TAK NAHI JATA — `buying` me ye poora hissa aage
    nikal jata hai. Wo hamesha free hai, aur wahi is poore dhande ki jaan hai.

    Sirf ek nishaan (event) se kaam chal jata hai, har page pe alag jaanch
    nahi lagani padti — aur nishaan lagta bhi tabhi hai jab server sach me
    mana kare, isliye "shayad plan khatam hoga" wala andaza kabhi nahi lagta.
  */
  const [needsPlan, setNeedsPlan] = useState(() => {
    try { return sessionStorage.getItem('rr_needs_plan') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const on = () => setNeedsPlan(true);
    window.addEventListener('rr:needs-plan', on);
    return () => window.removeEventListener('rr:needs-plan', on);
  }, []);

  // Kharidne wale hisse me jate hi nishaan hata dete hain — warna wapas aane
  // par purana parda phir se chipak jata hai jabki plan le liya gaya ho
  useEffect(() => {
    if (!buying) return;
    try { sessionStorage.removeItem('rr_needs_plan'); } catch { /* koi baat nahi */ }
    setNeedsPlan(false);
  }, [buying]);

  /*
   * ─────────── ONBOARDING TOUR — pehli baar wala safar (Part 29) ───────────
   *
   * `checkedRef` isliye ki ye jaanch sirf EK BAAR ho, jab `business` pehli
   * baar load ho. Warna "Skip" dabate hi (jab `business` object abhi purana
   * hai) ye dobara turant khud khul jata — user ke saamne band hi na hota.
   */
  const [showTour, setShowTour] = useState(false);
  const [rewatch, setRewatch] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current || !business || !isWholesaler || buying) return;
    checkedRef.current = true;
    if (!business.onboardingCompletedAt && !business.onboardingSkippedAt) setShowTour(true);
  }, [business, isWholesaler, buying]);

  // MenuPage se "Tutorial dobara dekhein" — kahin se bhi khul sakta hai
  useEffect(() => {
    const on = () => { setRewatch(true); setShowTour(true); };
    window.addEventListener('rr:show-tour', on);
    return () => window.removeEventListener('rr:show-tour', on);
  }, []);

  /**
   * Back ka "plan B" — jab history khali ho (link se seedha khola ya refresh).
   *
   *   /invoices/123  ->  /invoices   (apni list pe)
   *   /invoices      ->  /menu       (ghar pe — ab Menu hi ghar hai, Part 35)
   *
   * Doosri line zaroori hai: pehle yahan hamesha section ka apna rasta jata
   * tha, yaani /settings pe back dabane se /settings hi khulta tha — kuch
   * hota hi nahi dikhta tha.
   */
  const homeRoot = '/menu';
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

        <main className={cn('px-4 pt-4 sm:px-5 lg:px-6 lg:pb-6', buying ? 'pb-20' : 'pb-6')}>
          {!buying && needsPlan ? <PlanNeeded /> : <Outlet />}
        </main>
      </div>

      {/*
        SELLER SIDE ME AB YE PATTI NAHI HAI (Part 35) — jaan-boojh kar.

        Pehle Home/Dashboard/Sale/Payment/Menu — paanch button hamesha
        neeche chipke rehte the. Ab seller ka safar Odoo jaisa hai: `/menu`
        hi ghar hai, wahin se har jagah jaate hain, aur wapas bhi wahin
        aate hain (upar `homeRoot` isi wajah se `/menu` hai). Do jagah se
        navigate karne ka rasta dena confuse karta — ek hi jagah pakki.

        RETAILER (khareedne wale) ke liye patti waisi hi hai — unka safar
        alag hai (Shop, Cart, Orders roz ke kaam hain, ek-doosre se bilkul
        alag), unhe angoothe ke neeche seedha button milna zaroori hai.
      */}
      {buying && <BottomNav />}

      {showTour && (
        <OnboardingTour
          isRewatch={rewatch}
          onDone={() => { setShowTour(false); setRewatch(false); }}
        />
      )}
    </div>
  );
}

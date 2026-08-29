import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import RequireAuth from './RequireAuth';
import RequirePermission from './RequirePermission';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';

import Login from '@/pages/auth/Login';
import Privacy from '@/pages/public/Privacy';
import Terms from '@/pages/public/Terms';
import Refund from '@/pages/public/Refund';
import Delivery from '@/pages/public/Delivery';
import Contact from '@/pages/public/Contact';
import Pricing from '@/pages/public/Pricing';
import Landing from '@/pages/public/Landing';
import Signup from '@/pages/auth/Signup';
import Join from '@/pages/auth/Join';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import JoinStaff from '@/pages/auth/JoinStaff';
import PendingApproval from '@/pages/retailer/PendingApproval';
import Settings from '@/pages/wholesaler/Settings';
import Items from '@/pages/wholesaler/Items';
import Retailers from '@/pages/wholesaler/Retailers';
import PartyDetail from '@/pages/wholesaler/parties/PartyDetail';
import Orders from '@/pages/wholesaler/Orders';
import WholesalerOrderDetail from '@/pages/wholesaler/orders/OrderDetail';
import PurchaseForm from '@/pages/wholesaler/purchases/PurchaseForm';
import PurchaseDetail from '@/pages/wholesaler/purchases/PurchaseDetail';
import StockIntakePage from '@/pages/wholesaler/StockIntake';
import IntakeReview from '@/pages/wholesaler/intake/IntakeReview';
import ShopSearch from '@/pages/buy/ShopSearch';
import ShopPage from '@/pages/buy/ShopPage';
import CartPage from '@/pages/retailer/Cart';
import MyOrders from '@/pages/retailer/MyOrders';
import OrderDetail from '@/pages/retailer/OrderDetail';
import Invoices from '@/pages/wholesaler/Invoices';
import InvoiceForm from '@/pages/wholesaler/invoices/InvoiceForm';
import InvoiceDetail from '@/pages/wholesaler/invoices/InvoiceDetail';
import { MyBills, MyBillDetail } from '@/pages/retailer/MyBills';
import Khata from '@/pages/wholesaler/Khata';
import Payments from '@/pages/wholesaler/Payments';
import MyKhata from '@/pages/retailer/MyKhata';
import Dashboard from '@/pages/wholesaler/Dashboard';
import Reports from '@/pages/wholesaler/Reports';
import RetailerHome from '@/pages/retailer/Home';
import Notifications from '@/pages/Notifications';
import MenuPage from '@/pages/wholesaler/MenuPage';
import Staff from '@/pages/wholesaler/Staff';
import Returns from '@/pages/wholesaler/Returns';
import Buying from '@/pages/wholesaler/Buying';
import ReturnForm from '@/pages/wholesaler/returns/ReturnForm';
import ReturnDetail from '@/pages/wholesaler/returns/ReturnDetail';
import RetailerProfile from '@/pages/retailer/Profile';
import RetailerSettings from '@/pages/retailer/Settings';
import WholesalerProfile from '@/pages/wholesaler/Profile';
import WholesalerHome from '@/pages/wholesaler/Home';

/**
 * EK RASTA, DO ROOP.
 *
 * `/home` aur `/profile` dono roles ke liye hain, par andar alag page khulta
 * hai. Do alag route banane ki koshish nahi karni chahiye: React Router pehla
 * milta hua rasta uthata hai, isliye retailer wholesaler wale group me phans
 * kar bahar phenk diya jata (yahi galti `/notifications` pe ek baar ho chuki
 * hai — neeche uska note hai). Isliye route ek hi hai aur role ka faisla
 * yahan andar hota hai.
 */
/*
  Ab faisla sirf role se nahi, DARWAZE se hota hai.

  Wholesaler jab Buy mode me hai to `/home` pe uski apni dukaan ka hisaab
  dikhana galat hoga — us waqt use wo hisaab chahiye jo us dukaan ka hai jisse
  wo maal le raha hai (kitna udhaar, kaunse order chal rahe hain). Wahi page
  pehle se bana hai (RetailerHome), isliye naya banane ki zarurat nahi padi.
*/
function HomeByRole() {
  const { isRetailer } = useAuth();
  const { buying } = useShop();
  return (isRetailer || buying) ? <RetailerHome /> : <WholesalerHome />;
}

function ProfileByRole() {
  const { isRetailer } = useAuth();
  return isRetailer ? <RetailerProfile /> : <WholesalerProfile />;
}

/*
  Settings ab dono role ke paas hai.

  Retailer ke liye ye page tha hi nahi — wo wholesaler wale group ke andar pada
  tha, isliye retailer wahan pahunchta to redirect ho jata. Bhasha aur akshar
  ka size uske liye utne hi zaroori hain jitne malik ke liye; baaki tab
  (business, staff, backup) uske matlab ke nahi hain, isliye uska apna chhota
  page hai.
*/
function SettingsByRole() {
  const { isRetailer } = useAuth();
  return isRetailer ? <RetailerSettings /> : <Settings />;
}

/**
 * KHAREEDNE WALE KA PEHRA.
 *
 * Pehle ye poora hissa `RequireAuth roles={['retailer']}` ke andar tha — yaani
 * catalog, cart aur my-orders sirf retailer ke liye. Ab ek wholesaler bhi
 * (Profile → Buyer) inhi pages pe aata hai, isliye role wali shart hat gayi
 * aur uski jagah "khareedne ka haq" wali shart aa gayi.
 *
 * Naya group banane ki koshish MAT karna. React Router pehla milta hua rasta
 * uthata hai — `/cart` do jagah likha to jo upar hoga wahi chalega, aur doosre
 * role wala aadmi chup-chaap bahar phenk diya jayega. (Yahi galti
 * `/notifications` pe ek baar ho chuki hai; neeche uska note hai.) Isliye ek hi
 * group, aur faisla yahan andar.
 */
function RequireBuyer({ children }) {
  const { isRetailer, canBuy } = useAuth();
  const { isBuyMode, shopId } = useShop();
  const { pathname } = useLocation();

  if (!isRetailer && !canBuy) return <Navigate to="/home" replace />;

  /*
    Buy mode hai, par dukaan chuni hi nahi.

    Cart, My Orders, Mere Bills, My Khata — in sab ka pehla sawal "kis dukaan
    ka?" hai. Bina jawab ke har ek page server se 400 le kar aata aur screen pe
    "Pehle dukaan chunein" ka error toast baith jata — chaar page, chaar bekaar
    ki request, aur aadmi ko koi rasta nahi dikhta.
    Ek jagah rok kar seedha wahin bhej dete hain jahan uska jawab hai.

    Retailer par ye kabhi nahi lagta: uski dukaan pehle se judi hai, aur
    `shopId` khali hone par server khud wahi purani dukaan chun leta hai.
  */
  if (isBuyMode && !shopId && pathname !== '/buy') return <Navigate to="/buy" replace />;

  return children;
}

function HomeRedirect() {
  const { user, loading, isApproved } = useAuth();
  if (loading) return null;
  /*
    Pehle yahan se seedha /login bhej diya jata tha. Uska matlab tha ki jo
    aadmi pehli baar aaya, use sirf ek khali login screen milti — na ye pata
    chalta ki cheez kya hai, na daam. Google ko bhi wahi dikhta tha.
  */
  if (!user) return <Landing />;
  if (user.role === 'retailer') return <Navigate to={isApproved ? '/home' : '/pending'} replace />;
  // Wholesaler bhi ab Home pe — roz ka kaam wahi hai
  return <Navigate to="/home" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* ---- Public ---- */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      {/* Password bhool gaye — bina login ke khulna hi chahiye */}
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/join/:inviteCode" element={<Join />} />
      {/* Staff invite link — login se pehle khulti hai, kyunki abhi account hai hi nahi */}
      <Route path="/join-staff/:token" element={<JoinStaff />} />

      {/*
        ─────────────── POLICY WALE KAGAZ — BINA LOGIN KE ───────────────

        Ye pehre ke BAHAR hain, aur wahi in routes ki sabse zaroori baat hai.

        Payment gateway (Razorpay) merchant account manzoor karne se pehle in
        page ko KHUD kholta hai. Login maangne wala page unke liye maujood hi
        nahi hai — aur wahi application ruk jane ki sabse aam wajah hoti hai,
        jiski wajah bhi aksar nahi batayi jati.

        `/pricing` bhi isi liye khula hai: naya aadmi account banane se pehle
        daam dekhna chahta hai, aur jise pehle account banana pade wo aksar
        banata hi nahi.
      */}
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/refund" element={<Refund />} />
      <Route path="/delivery" element={<Delivery />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/pricing" element={<Pricing />} />

      {/* ---- Retailer: approval screen (approve na hone par bhi khulti hai) ---- */}
      <Route
        path="/pending"
        element={
          <RequireAuth roles={['retailer']} allowUnapproved>
            <PendingApproval />
          </RequireAuth>
        }
      />

      {/* ---- Wholesaler ---- */}
      <Route
        element={
          <RequireAuth roles={['wholesaler']}>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orders" element={<RequirePermission permission="orders"><Orders /></RequirePermission>} />
        <Route path="/orders/:id" element={<RequirePermission permission="orders"><WholesalerOrderDetail /></RequirePermission>} />
        <Route path="/items" element={<RequirePermission permission="items"><Items /></RequirePermission>} />
        <Route path="/retailers" element={<RequirePermission permission="parties"><Retailers /></RequirePermission>} />
        <Route path="/retailers/:id" element={<RequirePermission permission="parties"><PartyDetail type="retailer" /></RequirePermission>} />
        {/*
          Teen pate, ek page.

          `/suppliers`, `/purchases` aur `/expenses` — teeno ab ek hi `Buying`
          page kholte hain, aur wo pata dekh kar sahi tab chun leta hai. Isliye
          har purana link, bookmark aur andar ka `navigate()` bina chhue chalta
          rehta hai; sirf dekhne me teen page ek ho gaye hain.
        */}
        <Route path="/suppliers" element={<RequirePermission permission="parties"><Buying /></RequirePermission>} />
        <Route path="/suppliers/:id" element={<RequirePermission permission="parties"><PartyDetail type="supplier" /></RequirePermission>} />
        <Route path="/purchases" element={<RequirePermission permission="purchases"><Buying /></RequirePermission>} />
        <Route path="/purchases/new" element={<RequirePermission permission="purchases:create"><PurchaseForm /></RequirePermission>} />
        <Route path="/purchases/:id" element={<RequirePermission permission="purchases"><PurchaseDetail /></RequirePermission>} />
        {/*
          Doosri dukaan se aaya maal apne stock me daalna (Part 17 step 3).

          Ijazat wahi hai jo kharid ki hai — isse godown incharge ko ye kaam
          apne aap mil jata hai, aur wahi theek bhi hai: maal andar karna uska
          hi roz ka kaam hai.
        */}
        <Route path="/stock-intake" element={<RequirePermission permission="purchases"><StockIntakePage /></RequirePermission>} />
        <Route path="/stock-intake/:id" element={<RequirePermission permission="purchases"><IntakeReview /></RequirePermission>} />
        <Route path="/invoices" element={<RequirePermission permission="invoices"><Invoices /></RequirePermission>} />
        {/*
          Wahi page, do naam. Menu me "Sale" likha hai kyunki dukaandaar bill
          ko sale hi kehta hai; par /invoices purane link, bookmark aur bill
          detail (/invoices/:id) ke saath juda hai — use todna bina wajah ka
          nuksan hai.
        */}
        <Route path="/sales" element={<RequirePermission permission="invoices"><Invoices /></RequirePermission>} />
        <Route path="/invoices/new" element={<RequirePermission permission="invoices:create"><InvoiceForm /></RequirePermission>} />
        {/*
          "Add Sale" aur "Naya bill" EK HI cheez hain — do alag form banane ka
          matlab hota do jagah hisaab, do jagah bug. Isliye rasta alag hai,
          page wahi. Home ka bada button yahin bhejta hai.
        */}
        <Route path="/sale/new" element={<RequirePermission permission="invoices:create"><InvoiceForm /></RequirePermission>} />
        <Route path="/invoices/:id" element={<RequirePermission permission="invoices"><InvoiceDetail /></RequirePermission>} />
        <Route path="/khata" element={<RequirePermission permission="khata:view"><Khata /></RequirePermission>} />
        <Route path="/payments" element={<RequirePermission permission="khata:create"><Payments /></RequirePermission>} />
        <Route path="/returns" element={<RequirePermission permission="returns"><Returns /></RequirePermission>} />
        <Route path="/returns/new" element={<RequirePermission permission="returns:create"><ReturnForm /></RequirePermission>} />
        <Route path="/returns/:id" element={<RequirePermission permission="returns"><ReturnDetail /></RequirePermission>} />
        <Route path="/expenses" element={<RequirePermission permission="expenses"><Buying /></RequirePermission>} />
        <Route path="/reports" element={<RequirePermission permission="reports"><Reports /></RequirePermission>} />
        {/*
          Staff aur "kisne kya kiya" ab ek hi page ke do tab hain.
          `/activity` purane link aur notification ke liye chalta rehta hai —
          wo seedha "Kaam ka record" wale tab pe khulta hai.
        */}
        <Route path="/staff" element={<RequirePermission permission="staff:view"><Staff /></RequirePermission>} />
        <Route path="/activity" element={<Navigate to="/staff?tab=record" replace />} />
      </Route>

      {/* ---- Khareedne wala (retailer, aur buy mode wala wholesaler) ---- */}
      <Route
        element={
          <RequireAuth>
            <RequireBuyer>
              <AppLayout />
            </RequireBuyer>
          </RequireAuth>
        }
      >
        {/*
          Do kadam, do page.

          `/buy`  — number se dukaan dhoondho, judo, save karo (search history)
          `/shop` — chuni hui dukaan ka apna page: logo, naam, kitna maal,
                    kitni category, Save ka button, aur uska poora catalog.
                    Purana `Catalog` page yahi ban gaya hai.
        */}
        <Route path="/buy" element={<ShopSearch />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/my-orders/:id" element={<OrderDetail />} />
        <Route path="/my-bills" element={<MyBills />} />
        <Route path="/my-bills/:id" element={<MyBillDetail />} />
        <Route path="/my-khata" element={<MyKhata />} />
      </Route>

      {/* ---- Dono roles ---- */}
      {/*
        Notifications dono ke liye ek hi page hai. Ise role wale group ke ANDAR
        rakhne se dikkat hoti hai: React Router pehla matching route uthata hai,
        to retailer wholesaler wale group me phans kar redirect ho jata tha.
        Isliye alag group, bina roles ke.
      */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/notifications" element={<Notifications />} />
        {/*
          Settings bhi yahin, Notifications ki tarah — aur bilkul usi wajah se.

          Pehle ise dono role-group ke andar daala tha. React Router pehla
          milta hua route uthata hai, aur wholesaler wala group upar hai —
          isliye retailer `/settings` kholte hi wholesaler wale pehre me phans
          kar wapas bhej diya jata tha. Page bana hua tha, nav me link bhi tha,
          par khulta hi nahi tha.
        */}
        <Route path="/settings" element={<SettingsByRole />} />
        <Route path="/home" element={<HomeByRole />} />
        {/*
          Menu bhi dono ke liye ek hi page hai — andar `isRetailer` dekh kar
          apni list chun leta hai. Isliye role wale group ke BAHAR, warna
          retailer wholesaler wale group me phans kar bahar phenk diya jayega
          (wahi purani `/notifications` wali galti).
        */}
        <Route path="/menu" element={<MenuPage />} />
      </Route>

      {/*
        Profile pending retailer ko bhi chahiye — isliye `allowUnapproved`.
        Home nahi: jo abhi approve hi nahi hua uske liye Home me kuch hai hi
        nahi, use /pending pe hi rehna chahiye.
      */}
      <Route
        element={
          <RequireAuth allowUnapproved>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/profile" element={<ProfileByRole />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

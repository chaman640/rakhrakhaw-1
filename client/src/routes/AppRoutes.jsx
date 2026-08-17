import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import RequireAuth from './RequireAuth';
import RequirePermission from './RequirePermission';
import { useAuth } from '@/context/AuthContext';

import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import Join from '@/pages/auth/Join';
import JoinStaff from '@/pages/auth/JoinStaff';
import PendingApproval from '@/pages/retailer/PendingApproval';
import Settings from '@/pages/wholesaler/Settings';
import Activity from '@/pages/wholesaler/Activity';
import Items from '@/pages/wholesaler/Items';
import Retailers from '@/pages/wholesaler/Retailers';
import Suppliers from '@/pages/wholesaler/Suppliers';
import PartyDetail from '@/pages/wholesaler/parties/PartyDetail';
import Purchases from '@/pages/wholesaler/Purchases';
import Orders from '@/pages/wholesaler/Orders';
import WholesalerOrderDetail from '@/pages/wholesaler/orders/OrderDetail';
import PurchaseForm from '@/pages/wholesaler/purchases/PurchaseForm';
import PurchaseDetail from '@/pages/wholesaler/purchases/PurchaseDetail';
import Catalog from '@/pages/retailer/Catalog';
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
import Returns from '@/pages/wholesaler/Returns';
import Expenses from '@/pages/wholesaler/Expenses';
import ReturnForm from '@/pages/wholesaler/returns/ReturnForm';
import ReturnDetail from '@/pages/wholesaler/returns/ReturnDetail';
import RetailerProfile from '@/pages/retailer/Profile';
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
function HomeByRole() {
  const { isRetailer } = useAuth();
  return isRetailer ? <RetailerHome /> : <WholesalerHome />;
}

function ProfileByRole() {
  const { isRetailer } = useAuth();
  return isRetailer ? <RetailerProfile /> : <WholesalerProfile />;
}

function HomeRedirect() {
  const { user, loading, isApproved } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
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
      <Route path="/join/:inviteCode" element={<Join />} />
      {/* Staff invite link — login se pehle khulti hai, kyunki abhi account hai hi nahi */}
      <Route path="/join-staff/:token" element={<JoinStaff />} />

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
        <Route path="/suppliers" element={<RequirePermission permission="parties"><Suppliers /></RequirePermission>} />
        <Route path="/suppliers/:id" element={<RequirePermission permission="parties"><PartyDetail type="supplier" /></RequirePermission>} />
        <Route path="/purchases" element={<RequirePermission permission="purchases"><Purchases /></RequirePermission>} />
        <Route path="/purchases/new" element={<RequirePermission permission="purchases:create"><PurchaseForm /></RequirePermission>} />
        <Route path="/purchases/:id" element={<RequirePermission permission="purchases"><PurchaseDetail /></RequirePermission>} />
        <Route path="/invoices" element={<RequirePermission permission="invoices"><Invoices /></RequirePermission>} />
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
        <Route path="/expenses" element={<RequirePermission permission="expenses"><Expenses /></RequirePermission>} />
        <Route path="/reports" element={<RequirePermission permission="reports"><Reports /></RequirePermission>} />
        <Route path="/activity" element={<RequirePermission permission="staff:view"><Activity /></RequirePermission>} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* ---- Retailer ---- */}
      <Route
        element={
          <RequireAuth roles={['retailer']}>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/shop" element={<Catalog />} />
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
        <Route path="/home" element={<HomeByRole />} />
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

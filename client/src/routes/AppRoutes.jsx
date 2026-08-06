import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import RequireAuth from './RequireAuth';
import { useAuth } from '@/context/AuthContext';

import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import Join from '@/pages/auth/Join';
import PendingApproval from '@/pages/retailer/PendingApproval';
import Settings from '@/pages/wholesaler/Settings';
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
import RetailerProfile from '@/pages/retailer/Profile';
import ComingSoon from '@/pages/ComingSoon';

// Jo pages abhi nahi bane
const soon = (title, part, description) => <ComingSoon title={title} part={part} description={description} />;

function HomeRedirect() {
  const { user, loading, isApproved } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'retailer') return <Navigate to={isApproved ? '/shop' : '/pending'} replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* ---- Public ---- */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/join/:inviteCode" element={<Join />} />

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
        <Route path="/dashboard" element={soon('Dashboard', 10, 'Aaj ki sale, due, low stock')} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<WholesalerOrderDetail />} />
        <Route path="/items" element={<Items />} />
        <Route path="/retailers" element={<Retailers />} />
        <Route path="/retailers/:id" element={<PartyDetail type="retailer" />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/:id" element={<PartyDetail type="supplier" />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/purchases/new" element={<PurchaseForm />} />
        <Route path="/purchases/:id" element={<PurchaseDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/new" element={<InvoiceForm />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/khata" element={<Khata />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/reports" element={soon('Reports', 10, 'Sale aur stock summary')} />
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
        <Route path="/notifications" element={soon('Notifications', 10)} />
      </Route>

      {/* Profile pending retailer ko bhi chahiye */}
      <Route
        element={
          <RequireAuth roles={['retailer']} allowUnapproved>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/profile" element={<RetailerProfile />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

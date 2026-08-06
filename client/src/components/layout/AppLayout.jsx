import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '@/context/AuthContext';
import { wholesalerNav, retailerNav } from './navConfig';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isRetailer } = useAuth();
  const { pathname } = useLocation();

  const nav = isRetailer ? retailerNav : wholesalerNav;
  const current = nav.find((n) => pathname.startsWith(n.to));

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} title={current?.label || ''} />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

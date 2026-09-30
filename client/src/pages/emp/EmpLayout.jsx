import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  House, ListTodo, Fingerprint, Wallet, Menu, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import NotificationBell from '@/components/layout/NotificationBell';
import HelpVideos from '@/components/help/HelpVideos';
import AnnouncementBar from '@/components/AnnouncementBar';
import FeatureGate from '@/components/billing/FeatureGate';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const TABS = [
  { to: '/emp', label: 'Home', icon: House, end: true },
  { to: '/emp/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/emp/attendance', label: 'Attendance', icon: Fingerprint },
  { to: '/emp/salary', label: 'Salary', icon: Wallet },
  { to: '/emp/more', label: 'More', icon: Menu },
];

/** Employee App ka dhancha — phone jaisa, desktop pe beech me */
export default function EmpLayout() {
  const { business, staffRole } = useAuth();
  const employeeOnly = staffRole === 'employee';
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          {!employeeOnly && (
            <Link to="/menu" aria-label={t('Back to business')} className="-ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={18} /></Link>
          )}
          <Logo size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{business?.name || t('My Work')}</p>
            <p className="text-[11px] text-slate-500">{t('Employee App')}</p>
          </div>
          <HelpVideos placement="employee_app" />
          <NotificationBell />
        </div>
      </header>
      <AnnouncementBar />
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        <FeatureGate feature="hr_basic"><Outlet /></FeatureGate>
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium focus-ring', isActive ? 'text-brand-700' : 'text-slate-500')}>
              <Icon size={20} />{t(label)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

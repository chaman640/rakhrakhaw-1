import { useState } from 'react';
import { ArrowLeft, LogOut, ChevronDown, Store, UserCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from './NotificationBell';
import { t } from '@/lib/i18n';

/**
 * Peeche jaane ko kuch hai bhi ya nahi.
 *
 * React Router har history entry me `idx` rakhta hai — 0 ka matlab hai "ye is
 * tab ki pehli entry hai", yaani peeche browser ka khali page hai.
 *
 * Pehle yahan `location.key === 'default'` dekha tha, par wo galat nikla: login
 * ke baad ya `<Navigate replace>` chalne ke baad key badal jati hai, jabki
 * history me peeche kuch hota hi nahi. Us halat me back dabane se user seedha
 * app se bahar (khali page pe) chala jata tha.
 */
function canGoBack() {
  const idx = window.history.state?.idx;
  return typeof idx === 'number' ? idx > 0 : window.history.length > 1;
}

/**
 * Upar wali patti.
 *
 * Pehle yahan baayein taraf teen line wala button tha. Wo ab NEECHE chala gaya
 * (BottomNav me), aur uski jagah **back** aa gaya — kyunki phone pe sabse zyada
 * yahi chahiye hota hai: "ek kadam peeche".
 *
 * Root page (jo neeche wali patti me hai) pe back nahi dikhta — wahan se peeche
 * jaane ki koi jagah hai hi nahi. Uski jagah dukaan ka naam dikhta hai.
 */
export default function Header({ title, showBack, backTo }) {
  const { user, business, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /**
   * Peeche jaana.
   *
   * History me kuch ho to seedha peeche. Na ho (link se seedha khola, ya
   * refresh kiya) to `backTo` pe — jo AppLayout tay karta hai: sub-page se
   * uski list pe, aur list se ghar (dashboard/home) pe.
   */
  const goBack = () => {
    if (canGoBack()) navigate(-1);
    else navigate(backTo || '/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:h-16 sm:gap-3 sm:px-4 lg:px-6">
      {showBack ? (
        <button
          onClick={goBack}
          aria-label={t('Peeche jayein')}
          // -ml-1 + p-2 = tap ka ghera bada, par dikhne me chipka hua nahi
          className="-ml-1 shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 active:bg-slate-200 focus-ring"
        >
          <ArrowLeft size={20} />
        </button>
      ) : (
        // Root page pe dukaan ki pehchan — mobile pe sidebar dikhti hi nahi,
        // to user ko pata to chale ki wo kis dukaan me hai
        <button
          onClick={() => navigate('/profile')}
          aria-label={t('Profile')}
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg focus-ring lg:hidden"
        >
          {business?.logoUrl ? (
            <img src={business.logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Store size={16} />
            </div>
          )}
        </button>
      )}

      {/*
        Upar kya likha ho — page ka naam ya dukaan ka naam?

        Jahan se peeche jaana hai (sub-page), wahan PAGE ka naam — aadmi ko
        pata rehna chahiye ki wo kis cheez ke andar hai.

        Jo page neeche wali patti me hai (Home, Dashboard...), wahan DUKAAN ka
        naam — kyunki wahan "main kahan hoon" wo patti khud bata rahi hai, aur
        us jagah dukaan ka naam kaam ka hai: wahi Profile ka darwaza hai.
        Address ya UPI badalne ke liye pehle Settings kholo phir tab dhoondho —
        wo teen kadam the. Ab jo naam saamne likha hai, wahi rasta hai.
      */}
      {showBack ? (
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 sm:text-base">
          {title}
        </h2>
      ) : (
        <button
          onClick={() => navigate('/profile')}
          // `self-stretch` — button poori patti jitna uncha. Sirf likhaayi
          // jitna rakhne pe wo 20px ka ho jata tha, aur 20px pe ungli aksar
          // chook jati hai (44px se kam kuch bhi tap ke liye chhota hai).
          className="flex min-w-0 flex-1 items-center self-stretch rounded-lg text-left text-sm font-semibold text-slate-800 hover:text-brand-700 focus-ring sm:text-base"
        >
          <span className="truncate">{business?.name || 'Rakh Rakhav'}</span>
        </button>
      )}

      <NotificationBell />

      <div className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t('Apna account')}
          className="flex items-center gap-1 rounded-lg py-1.5 pl-1.5 pr-1 hover:bg-slate-100 focus-ring sm:gap-2 sm:pr-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <ChevronDown size={15} className="text-slate-400" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="truncate text-xs text-slate-500">{user?.phone}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <UserCircle size={15} /> {t('Profile')}
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={15} /> {t('Logout')}
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

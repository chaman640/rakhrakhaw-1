import { Link } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { Store } from 'lucide-react';

// Login / signup / join — teeno ka same frame
export default function AuthShell({ title, subtitle, children, footer, logoUrl, brandName }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="mb-3 h-14 w-14 rounded-xl object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-white">
              <Store size={22} />
            </div>
          )}
          <h1 className="text-xl font-semibold text-slate-900">{brandName || title}</h1>
          {subtitle && <div className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</div>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>

        {footer && <div className="mt-4 text-center text-sm text-slate-500">{footer}</div>}

        {/*
          POLICY KE LINK HAR LOGIN/SIGNUP PAGE PE.

          Payment gateway ye dekhta hai ki ye kagaz site pe se PAHUNCHE JA
          SAKTE hain — sirf maujood hona kaafi nahi. Aur ye jagah sabse theek
          hai: har naya aadmi yahin se guzarta hai, aur account banane se
          pehle shartein dekh sakta hai.

          `AuthShell` me rakhne se ye kisi ek page pe chhoot nahi sakta — login,
          signup, join, forgot, sab ek hi dhaanche se bante hain.
        */}
        <nav className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-xs text-slate-400">
          <Link className="hover:text-slate-700 hover:underline" to="/pricing">{t('Daam')}</Link>
          <Link className="hover:text-slate-700 hover:underline" to="/privacy">{t('Privacy')}</Link>
          <Link className="hover:text-slate-700 hover:underline" to="/terms">{t('Shartein')}</Link>
          <Link className="hover:text-slate-700 hover:underline" to="/refund">{t('Refund')}</Link>
          <Link className="hover:text-slate-700 hover:underline" to="/contact">{t('Sampark')}</Link>
        </nav>
      </div>
    </div>
  );
}

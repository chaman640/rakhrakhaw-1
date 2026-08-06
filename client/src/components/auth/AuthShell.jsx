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
      </div>
    </div>
  );
}

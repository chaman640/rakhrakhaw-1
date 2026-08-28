import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { t } from '@/lib/i18n';

/**
 * POLICY WALE KAGAZ — sabka ek hi dhaancha.
 *
 * Paanch page hain (privacy, terms, refund, delivery, contact) aur unme se
 * chaar ko payment gateway KHUD kholta hai, merchant account manzoor karne se
 * pehle. Agar unme se ek bhi na khule, ya login maange, ya aadha dikhe — to
 * application waapas aa jati hai, aur aksar wajah bhi nahi batayi jati.
 *
 * Isliye teen niyam, aur teeno yahin ek jagah baandh diye hain:
 *
 *   1. LOGIN KE BINA KHULEIN. Ye page `AppRoutes` me pehre se BAHAR hain.
 *   2. HAR PAGE PE DUKAAN KA POORA PATA aur sampark ho — wo neeche apne aap
 *      aata hai, isliye kisi page pe chhoot nahi sakta.
 *   3. AAKHRI BAAR KAB BADLA — kanooni kagaz pe ye tareekh maayne rakhti hai.
 *
 * Bhasha jaan-boojh kar seedhi rakhi hai. Ye kagaz wakil ke liye nahi,
 * dukaandaar ke liye hain — aur jo kagaz padha hi na jaye wo bharosa nahi
 * banata, sirf kanooni khaana bharta hai.
 */

/** Ek hi jagah — badle to sab page pe badal jayega */
export const COMPANY = {
  name: 'Rakh Rakhav',
  site: 'rakhrakhav.in',
  email: 'support@rakhrakhav.in',
  updated: '28 August 2026',
};

export default function PolicyShell({ title, subtitle, children }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 focus-ring"
          >
            <ArrowLeft size={15} /> {t('Peeche')}
          </Link>
          <span className="ml-auto text-sm font-semibold text-slate-900">{COMPANY.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <p className="mt-1 text-xs text-slate-400">
          {t('Aakhri baar badla: {a}', { a: COMPANY.updated })}
        </p>

        <div className="policy mt-6 space-y-6 text-sm leading-relaxed text-slate-700">
          {children}
        </div>

        {/*
          Sampark har page pe — payment gateway isi ek cheez pe sabse zyada
          atakta hai. Ek jagah likha hai, isliye kisi page pe chhoot nahi sakta.
        */}
        <div className="mt-10 rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <p className="font-medium text-slate-900">{t('Kuch poochhna ho to')}</p>
          <p className="mt-1 text-slate-600">
            {COMPANY.name} · <a className="text-brand-700 hover:underline" href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </p>
          <p className="mt-0.5 text-slate-600">{`https://${COMPANY.site}`}</p>
        </div>

        <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
          <Link className="hover:text-slate-900 hover:underline" to="/privacy">{t('Privacy Policy')}</Link>
          <Link className="hover:text-slate-900 hover:underline" to="/terms">{t('Terms of Service')}</Link>
          <Link className="hover:text-slate-900 hover:underline" to="/refund">{t('Refund Policy')}</Link>
          <Link className="hover:text-slate-900 hover:underline" to="/delivery">{t('Delivery Policy')}</Link>
          <Link className="hover:text-slate-900 hover:underline" to="/pricing">{t('Daam')}</Link>
          <Link className="hover:text-slate-900 hover:underline" to="/contact">{t('Sampark')}</Link>
        </nav>
      </main>
    </div>
  );
}

/** Ek hissa — heading aur uske neeche ki baat */
export function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{heading}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

/** Point ki list — policy me sabse zyada yahi lagti hai */
export function Points({ items }) {
  return (
    <ul className="ml-4 list-disc space-y-1.5 marker:text-slate-400">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

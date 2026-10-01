import { Link } from 'react-router-dom';
import {
  ShoppingCart, FileText, Wallet, Package, RotateCcw, Truck, Landmark, Target, Briefcase,
  BarChart3, Users, Bell, ShieldCheck, Check, ArrowRight, Smartphone, IdCard,
  MessageCircle, Percent, Store, Sparkles,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import { COMPANY } from './PolicyShell';
import useSeo from '@/lib/useSeo';
import InstallPrompt from '@/components/InstallPrompt';
import InstallButton from '@/components/InstallButton';
import Logo from '@/components/Logo';

/*
  Home page, laid out like an app-suite site: one big promise, a grid of colourful
  "apps", then each part of the shop explained next to a small illustration.
  The illustrations are drawn in HTML on purpose — they never go stale like a screenshot.
*/

const APPS = [
  [FileText, 'Billing', 'from-sky-500 to-blue-600'],
  [Truck, 'Purchase', 'from-amber-500 to-orange-600'],
  [Package, 'Stock', 'from-emerald-500 to-teal-600'],
  [Wallet, 'Khata', 'from-lime-500 to-green-600'],
  [ShoppingCart, 'Order', 'from-cyan-500 to-sky-600'],
  [Landmark, 'Accounting', 'from-violet-500 to-purple-600'],
  [Target, 'CRM', 'from-rose-500 to-pink-600'],
  [Briefcase, 'HR', 'from-indigo-500 to-blue-700'],
  [IdCard, 'Employee App', 'from-fuchsia-500 to-purple-600'],
  [BarChart3, 'Report', 'from-orange-500 to-red-500'],
  [MessageCircle, 'Chat', 'from-teal-500 to-cyan-600'],
  [Users, 'Staff', 'from-slate-600 to-slate-800'],
];

/** The highlighted words in the headline — a marker stroke behind the text */
function Marker({ children }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span aria-hidden="true" className="absolute inset-x-[-0.15em] bottom-[0.08em] h-[0.42em] -skew-x-6 rounded-sm bg-amber-300/80 dark:bg-amber-400/40" />
      <span className="relative">{children}</span>
    </span>
  );
}

function Frame({ children, tone = 'bg-brand-50' }) {
  return (
    <div className={`rounded-3xl ${tone} p-5 sm:p-8 dark:bg-slate-800`}>
      <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}

function BillMock() {
  return (
    <Frame tone="bg-sky-50">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{'INV/26-27/0142'}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{t('Tax Invoice')}</span>
      </div>
      {[['Bearing 6203', '20 × ₹95', '₹1,900'], ['Brake shoe', '10 × ₹240', '₹2,400'], ['Chain set', '5 × ₹410', '₹2,050']].map(([n, q, a]) => (
        <div key={n} className="flex justify-between border-b border-slate-100 py-1.5 text-xs dark:border-slate-800">
          <span className="text-slate-700 dark:text-slate-300">{n} <span className="text-slate-400">· {q}</span></span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{a}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{'CGST + SGST 18%'}</span><span>₹1,143</span></div>
      <div className="mt-1 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100"><span>{t('Kul')}</span><span>₹7,493</span></div>
      <div className="mt-3 flex gap-2">
        <span className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-center text-xs font-semibold text-white">WhatsApp</span>
        <span className="flex-1 rounded-lg border border-slate-200 py-1.5 text-center text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">PDF</span>
      </div>
    </Frame>
  );
}

function KhataMock() {
  return (
    <Frame tone="bg-lime-50">
      <p className="text-xs text-slate-500">{t('Kul lena hai')}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">₹1,24,500</p>
      <div className="mt-3 space-y-2">
        {[['Sharma Auto', '₹42,000', 'w-11/12'], ['Gupta Traders', '₹31,500', 'w-8/12'], ['Verma Store', '₹18,200', 'w-5/12']].map(([n, a, w]) => (
          <div key={n}>
            <div className="flex justify-between text-xs"><span className="text-slate-700 dark:text-slate-300">{n}</span><span className="font-semibold text-red-600">{a}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-1.5 rounded-full bg-gradient-to-r from-lime-500 to-green-600 ${w}`} /></div>
          </div>
        ))}
      </div>
      <span className="mt-3 block rounded-lg bg-slate-900 py-1.5 text-center text-xs font-semibold text-white dark:bg-slate-700">{t('WhatsApp pe yaad dilayein')}</span>
    </Frame>
  );
}

function OrderMock() {
  return (
    <div className="rounded-3xl bg-cyan-50 p-5 sm:p-8 dark:bg-slate-800">
      <div className="mx-auto w-56 rounded-[2rem] border-4 border-slate-900 bg-white p-3 shadow-xl dark:bg-slate-900">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-slate-200" />
        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{'Ramesh Traders'}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {['from-sky-200 to-sky-300', 'from-amber-200 to-amber-300', 'from-emerald-200 to-emerald-300', 'from-rose-200 to-rose-300'].map((g) => (
            <div key={g} className="rounded-lg border border-slate-100 p-1.5 dark:border-slate-800">
              <div className={`h-12 rounded-md bg-gradient-to-br ${g}`} />
              <div className="mt-1 h-1.5 w-3/4 rounded-full bg-slate-200" />
              <div className="mt-1 h-1.5 w-1/2 rounded-full bg-brand-200" />
            </div>
          ))}
        </div>
        <span className="mt-3 block rounded-xl bg-brand-600 py-2 text-center text-xs font-semibold text-white">{t('Order bhejein')} · ₹4,860</span>
      </div>
    </div>
  );
}

function ReportMock() {
  return (
    <Frame tone="bg-violet-50">
      <div className="grid grid-cols-3 gap-2">
        {[[t('Bikri'), '₹3.2L'], [t('Kharch'), '₹42k'], [t('Munafa'), '₹58k']].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
            <p className="text-[10px] text-slate-500">{l}</p>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {[40, 55, 35, 70, 60, 85, 75, 95].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-violet-500 to-purple-400" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['GSTR-1', 'GSTR-3B', 'P&L', 'Balance sheet'].map((x) => (
          <span key={x} className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-slate-800 dark:text-violet-300">{x}</span>
        ))}
      </div>
    </Frame>
  );
}

function Showcase({ kicker, title, body, points, art, flip }) {
  return (
    <section className="grid items-center gap-8 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? 'lg:order-2' : ''}>
        <p className="mb-2 text-sm font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">{kicker}</p>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{title}</h2>
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
        <ul className="mt-5 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-slate-700 dark:text-slate-300">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Check size={13} strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={flip ? 'lg:order-1' : ''}>{art}</div>
    </section>
  );
}

function MiniFeature({ icon: Icon, title, body }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <Icon size={22} className="text-brand-600 dark:text-brand-300" />
      <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <span className="text-3xl font-black text-brand-200 dark:text-brand-800">{n}</span>
      <h3 className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
    </div>
  );
}

function Faq({ q, a }) {
  return (
    <details className="group border-b border-slate-200 py-4 dark:border-slate-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-slate-900 dark:text-slate-100">
        {q}
        <span className="text-xl leading-none text-slate-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{a}</p>
    </details>
  );
}

function PriceCard({ n, unit, price, tagline, features, popular }) {
  return (
    <div className={`relative rounded-2xl border p-6 ${
      popular ? 'border-brand-400 bg-white shadow-xl ring-1 ring-brand-400 dark:bg-slate-800' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
    }`}>
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
          {t('Sabse pasandida')}
        </span>
      )}
      <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{n} {unit}</div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{tagline}</p>
      <div className="mt-4">
        <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">{price}</span>
        <span className="text-sm text-slate-500"> / {t('mahina')}</span>
      </div>
      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" /> {f}
          </li>
        ))}
      </ul>
      <Link to="/signup" className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-semibold ${
        popular ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-slate-300 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
      }`}>
        {t('15 din free aazmayein')}
      </Link>
    </div>
  );
}

export default function Landing() {
  useSeo({
    title: t('Rakh Rakhav — thok dukaan ka poora hisaab'),
    description: t('Rakh Rakhav ek thok dukaan ka app hai — stock, bill, khata, udhaar, order aur report sab ek jagah. Retailer ke liye hamesha free.'),
    path: '/',
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <InstallPrompt />

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={30} />
            <span className="whitespace-nowrap text-base font-bold text-slate-900 sm:text-lg dark:text-slate-100">Rakh Rakhav</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <a href="#apps" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('Apps')}</a>
            <Link to="/pricing" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('Daam')}</Link>
            <Link to="/contact" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{t('Sampark')}</Link>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link to="/login" className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
              {t('Login')}
            </Link>
            <Link to="/signup" className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:px-4">
              {t('Shuru karein')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── hero ── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,var(--color-brand-50),transparent_70%)] dark:opacity-10" />
        <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-14 text-center sm:pb-14 sm:pt-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm dark:border-brand-800 dark:bg-slate-800 dark:text-brand-300">
            <Sparkles size={13} /> {t('Thok dukaandaron ke liye bana')}
          </span>
          <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight text-slate-900 sm:text-6xl dark:text-white">
            {t('Poori dukaan ka hisaab,')}
            <br />
            <Marker>{t('ek hi app me')}</Marker>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            {t('Stock, bill, khata, udhaar, order, kharch aur report — sab ek app me. Aapke retailer apne phone se order bhejte hain, aur unka khata apne aap banta rehta hai.')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
              {t('Free me shuru karein')} <ArrowRight size={18} />
            </Link>
            <Link to="/pricing" className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
              {t('Daam dekhein')}
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
            {[t('Retailer ke liye hamesha free'), t('15 din ka free trial'), t('Card ki zarurat nahi')].map((x) => (
              <span key={x} className="flex items-center gap-1.5"><Check size={15} className="text-emerald-600" /> {x}</span>
            ))}
          </div>
          <div className="mt-5 flex justify-center"><InstallButton variant="light" /></div>
        </div>
      </section>

      {/* ── apps grid ── */}
      <section id="apps" className="scroll-mt-20 px-4 pb-14">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-slate-50/70 p-6 sm:p-10 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
            {APPS.map(([Icon, label, tone]) => (
              <div key={label} className="group flex flex-col items-center gap-2 text-center">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md transition-transform group-hover:-translate-y-1 sm:h-20 sm:w-20`}>
                  <Icon size={30} strokeWidth={1.8} />
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t(label)}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-slate-600 dark:text-slate-400">
            {t('Har app doosre se juda hai — bill banate hi stock, khata aur report apne aap badal jate hain.')}
          </p>
        </div>
      </section>

      {/* ── two audiences ── */}
      <section className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
          <Store size={26} className="text-brand-200" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-brand-200">{t('Wholesaler ke liye')}</p>
          <h2 className="mt-1 text-xl font-bold">{t('Poori dukaan ek app me')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-50">
            {t('Stock se lekar GST bill tak, khata se lekar fayde ki report tak. Staff ko utni hi ijazat dijiye jitni chahiye. Plan ₹50 mahine se shuru.')}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <ShoppingCart size={26} className="text-emerald-600" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{t('Retailer ke liye')}</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{t('Maal mangwana — bilkul free')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t('Apne wholesaler ka number daal kar jud jaiye. Unka poora maal, apna khaas rate, apne bill aur apna khata — sab apne phone pe. Ek hi jagah se kai dukaanon ko order bhej sakte hain. Iska koi paisa nahi lagta.')}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4">
        <Showcase
          kicker={t('Billing')}
          title={t('GST bill ek minute me — aur seedha WhatsApp pe')}
          body={t('Number daalte hi purana graahak nikal aata hai, rate apne aap bhar jata hai. CGST+SGST ya IGST khud tay hota hai. Bill WhatsApp pe bhej dijiye.')}
          points={[t('Tax Invoice aur Bill of Supply dono'), t('Har retailer ka apna rate apne aap'), t('Order se ek dabav me bill')]}
          art={<BillMock />}
        />
        <Showcase
          flip
          kicker={t('Khata')}
          title={t('Kisse kitna lena hai — ek nazar me')}
          body={t('Kisse kitna lena hai, kisko kitna dena hai — ek screen pe. Paisa apne aap sabse purane bill pe lagta hai. Har party ka CA wala hisaab PDF me.')}
          points={[t('Jama aur udhaar apne aap barabar'), t('WhatsApp aur app se yaad dilayein'), t('Credit limit har party ki alag')]}
          art={<KhataMock />}
        />
        <Showcase
          kicker={t('Online order')}
          title={t('Retailer apne phone se order karein')}
          body={t('Aapke retailer apne phone se order bhejte hain. Pack se lekar delivery tak har kadam unhe apne aap dikhta rehta hai.')}
          points={[t('Aapka catalog, photo aur rate ke saath'), t('Wishlist se pata chalta hai kya maang hai'), t('Retailer ke liye bilkul free')]}
          art={<OrderMock />}
        />
        <Showcase
          flip
          kicker={t('Accounting')}
          title={t('Fayda, GST aur poore khaate — apne aap')}
          body={t('Bikri se lekar asli bachat tak poora hisaab — maal ki lagat aur dukaan ka kharch ghata kar. GST ka mota-moti andaza bhi.')}
          points={[t('Day book, ledger, trial balance, P&L'), t('GSTR-1 aur GSTR-3B ki taiyari'), t('CA ke liye CSV ek click me')]}
          art={<ReportMock />}
        />

        {/* ── more ── */}
        <section className="border-t border-slate-200 py-14 dark:border-slate-800">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{t('Aur bhi bahut kuch')}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MiniFeature icon={Package} title={t('Stock aur FIFO lagat')}
              body={t('Kaunsa maal kitne ka pada hai, ab kaunsa bikega — sab dikhta hai. Kam hone par pehle hi chetavni mil jati hai.')} />
            <MiniFeature icon={RotateCcw} title={t('Wapasi — Credit aur Debit Note')}
              body={t('Maal wapas aaya ya wapas bheja — dono ka pakka note banta hai. Stock aur khata dono apne aap ulta ho jate hain.')} />
            <MiniFeature icon={ShieldCheck} title={t('Staff aur unki hadd')}
              body={t('Har aadmi ko utni hi ijazat dijiye jitni chahiye. Discount aur bill ki hadd bandhiye. Kisne kya kiya, wo record kabhi mitta nahi.')} />
            <MiniFeature icon={Briefcase} title={t('HR aur salary')}
              body={t('Attendance, chhutti, salary aur advance — sab ek jagah. Employee apne phone se check-in karte hain.')} />
            <MiniFeature icon={Target} title={t('CRM aur follow-up')}
              body={t('Naye lead, follow-up aur shikayat — kis graahak ko kab phone karna hai, app khud batata hai.')} />
            <MiniFeature icon={Bell} title={t('Phone pe notification')}
              body={t('Naya order, payment, ya udhaar ki yaad — sab app se seedha phone pe. SMS ka koi kharcha nahi.')} />
          </div>
        </section>

        {/* ── how it works ── */}
        <section className="border-t border-slate-200 py-14 dark:border-slate-800">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{t('Kaise chalta hai')}</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Step n="01" title={t('Apni dukaan banayein')}
              body={t('Naam, number aur OTP — do minute ka kaam. Phir apna maal daal dijiye, ya CSV se ek saath import kar lijiye.')} />
            <Step n="02" title={t('Retailer ko link bhejein')}
              body={t('WhatsApp pe apni invite link bhejiye. Jo khole, wo aapki dukaan ke neeche jud jata hai.')} />
            <Step n="03" title={t('Order aane lagte hain')}
              body={t('Retailer apne phone se maal chunta hai aur order bhej deta hai — apne khaas rate pe.')} />
            <Step n="04" title={t('Pack karke bill banayein')}
              body={t('Ek dabav me order se bill ban jata hai. Stock ghat jata hai aur udhaar khate me chadh jata hai.')} />
            <Step n="05" title={t('Paisa aata hai')}
              body={t('Retailer UPI se bhej kar bata deta hai, aap confirm kar dete hain. Sabse purana bill pehle chukta hota hai.')} />
            <Step n="06" title={t('Mahine ke aakhir me report')}
              body={t('Kitna becha, kitna bacha, kis pe kitna udhaar — sab ek jagah. CSV me utar kar CA ko de dijiye.')} />
          </div>
        </section>

        {/* ── pricing ── */}
        <section className="border-t border-slate-200 py-14 dark:border-slate-800">
          <div className="text-center">
            <Percent size={26} className="mx-auto text-brand-600" />
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{t('Daam')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-600 dark:text-slate-400">
              {t('Kharidna hamesha free. Paisa sirf bechne ke liye lagta hai — ginti sirf login karne walon ki.')}
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <PriceCard n="3" unit={t('account')} price="₹50" tagline={t('Aap aur do log')}
              features={[t('Apna stock, apna bill, apna khata'), t('Retailer seedha order karein')]} />
            <PriceCard n="10" unit={t('account')} price="₹100" tagline={t('Das log tak')} popular
              features={[t('Chhoti dukaan wala sab kuch'), t('Salesman, munshi, godown')]} />
            <PriceCard n="20" unit={t('account')} price="₹500" tagline={t('Bees log tak')}
              features={[t('Badhti dukaan wala sab kuch'), t('Kai counter, kai godown')]} />
            <PriceCard n={t('Anginat')} unit="" price="₹2000" tagline={t('Jitne account chahein')}
              features={[t('Badi dukaan wala sab kuch'), t('Account ki koi ginti nahi')]} />
          </div>
          <p className="mt-6 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
              {t('Poora daam dekhein')} <ArrowRight size={15} />
            </Link>
          </p>
        </section>

        {/* ── phone + faq ── */}
        <section className="grid gap-10 border-t border-slate-200 py-14 lg:grid-cols-[1fr_1.4fr] dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">{t('Aksar pooche jane wale sawal')}</h2>
            <div className="mt-6 flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Smartphone size={22} /></div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">{t('Phone me app ki tarah chalta hai')}</h3>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                  {t('Alag se install karne ki zarurat nahi — browser me kholiye, "Home screen pe daalein" dabaiye, ban gaya.')}
                </p>
              </div>
            </div>
          </div>
          <div>
            <Faq q={t('Rakh Rakhav kya hai?')}
              a={t('Rakh Rakhav thok dukaan ke liye bana app hai. Isme stock, bill, khata, udhaar, order, kharch aur report — sab ek jagah rehta hai, aur aapke retailer apne phone se seedha order bhej sakte hain.')} />
            <Faq q={t('Kya retailer ko paisa dena padta hai?')}
              a={t('Nahi. Kharidna hamesha free hai — dukaan dhundhna, maal dekhna, order karna, aur apne bill aur khata dekhna. Paisa sirf bechne wali dukaan deti hai.')} />
            <Faq q={t('Kya GST ke bina bhi chalta hai?')}
              a={t('Haan. GST band rakhein to bill "Bill of Supply" banta hai. Baad me GST chalu karna ho to ek switch se ho jata hai.')} />
            <Faq q={t('Kya ek se zyada wholesaler se maal le sakte hain?')}
              a={t('Haan. Jitne chahein utne se judiye. Har ek ka maal, bill aur khata alag rehta hai, aur ek hi cart se kai dukaanon ko order ja sakta hai.')} />
            <Faq q={t('Mera data kahan rehta hai?')}
              a={t('Aapki apni database me. Jab chahein Backup se poora data JSON ya Excel me utaar sakte hain. Plan khatam ho jaye tab bhi data mitta nahi.')} />
            <Faq q={t('Kya staff ko alag login mil sakta hai?')}
              a={t('Haan. Har aadmi ka apna login aur apna password hota hai, aur aap tay karte hain ki wo kya-kya kar sakta hai.')} />
          </div>
        </section>
      </main>

      {/* ── closing call ── */}
      <section className="bg-slate-900 px-4 py-16 text-center dark:bg-black">
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          {t('Aaj hi shuru kar lijiye')}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-slate-300">
          {t('Account banane me do minute lagte hain. Retailer ke liye ye hamesha free hai.')}
        </p>
        <Link to="/signup" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-7 py-3.5 text-base font-semibold text-white hover:bg-brand-400">
          {t('Free me shuru karein')} <ArrowRight size={18} />
        </Link>
        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            [ShieldCheck, t('Data hamesha surakshit')],
            [Users, t('Retailer ke liye free')],
            [Percent, t('15 din free trial')],
            [MessageCircle, t('Hindi + English support')],
          ].map(([Icon, label]) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <Icon size={22} className="text-brand-400" />
              <span className="text-sm text-slate-300">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Rakh Rakhav</span>
            <span className="text-sm text-slate-500">© {new Date().getFullYear()} {COMPANY.name}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link to="/pricing" className="text-slate-600 hover:underline dark:text-slate-400">{t('Daam')}</Link>
            <Link to="/privacy" className="text-slate-600 hover:underline dark:text-slate-400">{t('Privacy')}</Link>
            <Link to="/terms" className="text-slate-600 hover:underline dark:text-slate-400">{t('Shartein')}</Link>
            <Link to="/refund" className="text-slate-600 hover:underline dark:text-slate-400">{t('Refund')}</Link>
            <Link to="/delivery" className="text-slate-600 hover:underline dark:text-slate-400">{t('Delivery')}</Link>
            <Link to="/contact" className="text-slate-600 hover:underline dark:text-slate-400">{t('Sampark')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

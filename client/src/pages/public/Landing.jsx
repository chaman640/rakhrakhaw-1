import { Link } from 'react-router-dom';
import {
  ShoppingCart, FileText, Wallet, Package, RotateCcw,
  BarChart3, Users, Bell, ShieldCheck, Check, ArrowRight, Smartphone,
  MessageCircle, Boxes, Percent,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import { COMPANY } from './PolicyShell';
import useSeo from '@/lib/useSeo';
import InstallPrompt from '@/components/InstallPrompt';
import Logo from '@/components/Logo';

/**
 * GHAR KA PAGE — BINA LOGIN KE (Part 30 me nikhara).
 *
 * Content wahi hai jo pehle se theek tha — bas dikhne ka tarika badla hai.
 * Rang seedha `brand-*` se aata hai, isliye jab bhi brand color badlega
 * (`index.css`), ye page bhi khud-ba-khud saath badal jayega.
 */

const FEATURE_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-700' },
  { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { bg: 'bg-amber-50', text: 'text-amber-700' },
  { bg: 'bg-violet-50', text: 'text-violet-700' },
  { bg: 'bg-brand-50', text: 'text-brand-700' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  { bg: 'bg-rose-50', text: 'text-rose-700' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  { bg: 'bg-orange-50', text: 'text-orange-700' },
];

function Feature({ icon: Icon, title, body, i }) {
  const c = FEATURE_COLORS[i % FEATURE_COLORS.length];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg ${c.bg} ${c.text} dark:bg-slate-700 dark:text-slate-200`}>
        <Icon size={18} />
      </div>
      <h3 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div className="flex gap-3.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {n}
      </div>
      <div className="pb-5">
        <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</div>
      </div>
    </div>
  );
}

function Faq({ q, a }) {
  return (
    <div className="border-b border-slate-200 py-3.5 dark:border-slate-700">
      <div className="font-medium text-slate-900 dark:text-slate-100">{q}</div>
      <div className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{a}</div>
    </div>
  );
}

function PriceCard({ n, unit, price, tagline, features, popular }) {
  return (
    <div className={`relative rounded-2xl border p-5 ${
      popular ? 'border-brand-300 bg-brand-50/40 shadow-md dark:border-brand-700 dark:bg-brand-900/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
    }`}>
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
          {t('Sabse pasandida')}
        </span>
      )}
      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{n} {unit}</div>
      <div className="mt-1 mb-3">
        <span className="text-2xl font-bold text-brand-700 dark:text-brand-300">{price}</span>
        <span className="text-sm font-normal text-slate-500"> / {t('mahina')}</span>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{tagline}</p>
      <ul className="space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" /> {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * DASHBOARD KI JHALAK — asli screenshot NAHI hai, jaan-boojh kar.
 *
 * Ek stylized jhalak jo batati hai "aisa kuchh dikhta hai" bina jhoothe
 * daawe ke ki "yahi asli app hai" — asli app ka screen samay ke saath badal
 * jata hai, ye chhota illustration kabhi purana nahi padega.
 */
function DashboardMockup() {
  return (
    <div className="relative mx-auto max-w-md pb-8 pr-8 lg:mx-0">
      {/* laptop jaisa frame */}
      <div className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5 shadow-2xl backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="h-2 w-2 rounded-full bg-red-400/60" />
          <span className="h-2 w-2 rounded-full bg-amber-400/60" />
          <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
        </div>
        <div className="grid grid-cols-3 gap-2 px-1">
          <div className="rounded-lg bg-white/10 p-2.5">
            <p className="text-[10px] text-brand-200">{t('Aaj ki sale')}</p>
            <p className="text-base font-bold text-white">₹25,600</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2.5">
            <p className="text-[10px] text-brand-200">{t('Udhaar')}</p>
            <p className="text-base font-bold text-white">₹8,300</p>
          </div>
          <div className="rounded-lg bg-white/10 p-2.5">
            <p className="text-[10px] text-brand-200">{t('Order')}</p>
            <p className="text-base font-bold text-white">12</p>
          </div>
        </div>
        <div className="m-1 mt-2 h-16 rounded-lg bg-white/5 p-2">
          <svg viewBox="0 0 200 50" className="h-full w-full" preserveAspectRatio="none">
            <polyline points="0,40 30,26 60,34 90,16 120,28 150,10 180,20 200,8"
              fill="none" stroke="var(--color-brand-300)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <div className="mx-auto h-2.5 w-4/5 rounded-b-xl bg-white/10" />

      {/* phone jaisa frame — laptop ke corner pe overlap */}
      <div className="absolute -bottom-1 -right-1 w-28 rounded-2xl border border-white/10 bg-slate-900/70 p-1.5 shadow-xl">
        <div className="space-y-1.5 rounded-xl bg-white/10 p-2">
          <div className="h-1.5 w-2/3 rounded-full bg-white/30" />
          <div className="h-8 rounded-lg bg-brand-300/30" />
          <div className="h-5 rounded-lg bg-white/10" />
          <div className="h-5 rounded-lg bg-white/10" />
        </div>
      </div>
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

      {/* ── upar ka patti — hamesha gehra, reference jaisa ── */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <div>
              <span className="block text-base font-bold leading-tight text-white">Rakh Rakhav</span>
              <span className="block text-[11px] leading-tight text-brand-200">{t('Thok dukaan ka hisaab')}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/pricing" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-brand-100 hover:bg-white/10 sm:block">
              {t('Daam')}
            </Link>
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-brand-100 hover:bg-white/10">
              {t('Login')}
            </Link>
            <Link to="/signup" className="rounded-lg bg-brand-400 px-3.5 py-2 text-sm font-semibold text-brand-900 hover:bg-brand-300">
              {t('Shuru karein')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── hero — gehra gradient + chhota "dashboard" ka jhalak (asli screenshot nahi, sirf jhalak) ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,var(--color-brand-700),transparent_50%)] opacity-60" />

        <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-400/40 bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200">
              <Boxes size={13} /> {t('Thok dukaandaron ke liye bana')}
            </span>

            <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              {t('Rakh Rakhav — thok dukaan ka poora hisaab, ek jagah')}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-brand-100 sm:text-lg">
              {t('Stock, bill, khata, udhaar, order, kharch aur report — sab ek app me. Aapke retailer apne phone se order bhejte hain, aur unka khata apne aap banta rehta hai.')}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-5 py-2.5 font-semibold text-brand-900 shadow-sm hover:bg-brand-300">
                {t('Free me shuru karein')} <ArrowRight size={17} />
              </Link>
              <Link to="/pricing" className="rounded-lg border border-white/20 bg-white/5 px-5 py-2.5 font-semibold text-white hover:bg-white/10">
                {t('Daam dekhein')}
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-100">
              <span className="flex items-center gap-1.5">
                <Check size={15} className="text-brand-300" /> {t('Retailer ke liye hamesha free')}
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={15} className="text-brand-300" /> {t('15 din ka free trial')}
              </span>
              <span className="flex items-center gap-1.5">
                <Check size={15} className="text-brand-300" /> {t('Card ki zarurat nahi')}
              </span>
            </div>
          </div>

          <DashboardMockup />
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4">
        {/* ── ek app, sab kaam — chhota icon-grid, "sab jagah alag app" ka ulta ── */}
        <section className="border-b border-slate-200 py-10 dark:border-slate-700">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {[
              [FileText, t('Billing')], [Package, t('Stock')], [Wallet, t('Khata')],
              [ShoppingCart, t('Order')], [BarChart3, t('Report')], [MessageCircle, t('Chat')],
            ].map(([Icon, label]) => (
              <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 p-3 text-center dark:border-slate-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">
                  <Icon size={19} />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── do hisse ── */}
        <section className="grid gap-4 py-10 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-900/20">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {t('Retailer ke liye')}
            </div>
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              {t('Maal mangwana — bilkul free')}
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {t('Apne wholesaler ka number daal kar jud jaiye. Unka poora maal, apna khaas rate, apne bill aur apna khata — sab apne phone pe. Ek hi jagah se kai dukaanon ko order bhej sakte hain. Iska koi paisa nahi lagta.')}
            </p>
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-5 dark:border-brand-800 dark:bg-brand-900/10">
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
              {t('Wholesaler ke liye')}
            </div>
            <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              {t('Poori dukaan ek app me')}
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {t('Stock se lekar GST bill tak, khata se lekar fayde ki report tak. Staff ko utni hi ijazat dijiye jitni chahiye. Plan ₹50 mahine se shuru.')}
            </p>
          </div>
        </section>

        {/* ── feature ── */}
        <section className="border-t border-slate-200 py-10 dark:border-slate-700">
          <h2 className="mb-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('Kya kya kar sakte hain')}
          </h2>
          <p className="mb-6 text-slate-600 dark:text-slate-400">
            {t('Dukaan ka har roz ka kaam — bina register, bina alag-alag app ke.')}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Feature i={0} icon={FileText} title={t('GST bill aur Bill of Supply')}
              body={t('Number daalte hi purana graahak nikal aata hai, rate apne aap bhar jata hai. CGST+SGST ya IGST khud tay hota hai. Bill WhatsApp pe bhej dijiye.')} />
            <Feature i={1} icon={Wallet} title={t('Khata aur udhaar')}
              body={t('Kisse kitna lena hai, kisko kitna dena hai — ek screen pe. Paisa apne aap sabse purane bill pe lagta hai. Har party ka CA wala hisaab PDF me.')} />
            <Feature i={2} icon={Package} title={t('Stock aur FIFO lagat')}
              body={t('Kaunsa maal kitne ka pada hai, ab kaunsa bikega — sab dikhta hai. Kam hone par pehle hi chetavni mil jati hai.')} />
            <Feature i={3} icon={ShoppingCart} title={t('Retailer ke online order')}
              body={t('Aapke retailer apne phone se order bhejte hain. Pack se lekar delivery tak har kadam unhe apne aap dikhta rehta hai.')} />
            <Feature i={4} icon={Users} title={t('Har retailer ka apna rate')}
              body={t('Ek-ek retailer ke liye alag daam tay kijiye, ya ek hi niyam poore maal pe laga dijiye. Credit limit bhi apni-apni.')} />
            <Feature i={5} icon={RotateCcw} title={t('Wapasi — Credit aur Debit Note')}
              body={t('Maal wapas aaya ya wapas bheja — dono ka pakka note banta hai. Stock aur khata dono apne aap ulta ho jate hain.')} />
            <Feature i={6} icon={BarChart3} title={t('Fayde ki asli report')}
              body={t('Bikri se lekar asli bachat tak poora hisaab — maal ki lagat aur dukaan ka kharch ghata kar. GST ka mota-moti andaza bhi.')} />
            <Feature i={7} icon={ShieldCheck} title={t('Staff aur unki hadd')}
              body={t('Har aadmi ko utni hi ijazat dijiye jitni chahiye. Discount aur bill ki hadd bandhiye. Kisne kya kiya, wo record kabhi mitta nahi.')} />
            <Feature i={8} icon={Bell} title={t('Phone pe notification')}
              body={t('Naya order, payment, ya udhaar ki yaad — sab app se seedha phone pe. SMS ka koi kharcha nahi.')} />
          </div>
        </section>

        {/* ── kaise chalta hai ── */}
        <section className="border-t border-slate-200 py-10 dark:border-slate-700">
          <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('Kaise chalta hai')}
          </h2>
          <div className="max-w-2xl">
            <Step n="1" title={t('Apni dukaan banayein')}
              body={t('Naam, number aur OTP — do minute ka kaam. Phir apna maal daal dijiye, ya CSV se ek saath import kar lijiye.')} />
            <Step n="2" title={t('Retailer ko link bhejein')}
              body={t('WhatsApp pe apni invite link bhejiye. Jo khole, wo aapki dukaan ke neeche jud jata hai.')} />
            <Step n="3" title={t('Order aane lagte hain')}
              body={t('Retailer apne phone se maal chunta hai aur order bhej deta hai — apne khaas rate pe.')} />
            <Step n="4" title={t('Pack karke bill banayein')}
              body={t('Ek dabav me order se bill ban jata hai. Stock ghat jata hai aur udhaar khate me chadh jata hai.')} />
            <Step n="5" title={t('Paisa aata hai')}
              body={t('Retailer UPI se bhej kar bata deta hai, aap confirm kar dete hain. Sabse purana bill pehle chukta hota hai.')} />
            <Step n="6" title={t('Mahine ke aakhir me report')}
              body={t('Kitna becha, kitna bacha, kis pe kitna udhaar — sab ek jagah. CSV me utar kar CA ko de dijiye.')} />
          </div>
        </section>

        {/* ── daam — asli plan card jaisa ── */}
        <section className="border-t border-slate-200 py-10 dark:border-slate-700">
          <div className="mb-5 flex items-center gap-2">
            <Percent size={20} className="text-brand-600" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('Daam')}</h2>
          </div>
          <p className="mb-5 text-slate-600 dark:text-slate-400">
            {t('Kharidna hamesha free. Paisa sirf bechne ke liye lagta hai — ginti sirf login karne walon ki.')}
          </p>
          <div className="grid gap-4 pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <PriceCard n="3" unit={t('account')} price="₹50" tagline={t('Aap aur do log')}
              features={[t('Apna stock, apna bill, apna khata'), t('Retailer seedha order karein')]} />
            <PriceCard n="10" unit={t('account')} price="₹100" tagline={t('Das log tak')} popular
              features={[t('Chhoti dukaan wala sab kuch'), t('Salesman, munshi, godown')]} />
            <PriceCard n="20" unit={t('account')} price="₹500" tagline={t('Bees log tak')}
              features={[t('Badhti dukaan wala sab kuch'), t('Kai counter, kai godown')]} />
            <PriceCard n={t('Anginat')} unit="" price="₹2000" tagline={t('Jitne account chahein')}
              features={[t('Badi dukaan wala sab kuch'), t('Account ki koi ginti nahi')]} />
          </div>
          <Link to="/pricing" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {t('Poora daam dekhein')} <ArrowRight size={15} />
          </Link>
        </section>

        {/* ── app — phone pe bhi ── */}
        <section className="border-t border-slate-200 py-10 dark:border-slate-700">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:text-left">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Smartphone size={26} />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">{t('Phone me app ki tarah chalta hai')}</h3>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {t('Alag se install karne ki zarurat nahi — browser me kholiye, "Home screen pe daalein" dabaiye, ban gaya.')}
              </p>
            </div>
          </div>
        </section>

        {/* ── sawal ── */}
        <section className="border-t border-slate-200 py-10 dark:border-slate-700">
          <h2 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('Aksar pooche jane wale sawal')}
          </h2>
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
        </section>

        {/* ── aakhri dhakka — rangeen background se alag dikhe ── */}
        <section className="my-10 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-12 text-center text-white">
          <h2 className="text-2xl font-bold">
            {t('Aaj hi shuru kar lijiye')}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-brand-50">
            {t('Account banane me do minute lagte hain. Retailer ke liye ye hamesha free hai.')}
          </p>
          <Link to="/signup" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 hover:bg-brand-50">
            {t('Free me shuru karein')} <ArrowRight size={17} />
          </Link>
        </section>
      </main>

      {/* ── bharosa — asli baatein, ghadi hui ginti nahi ── */}
      <section className="bg-brand-900 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 sm:grid-cols-4">
          {[
            [ShieldCheck, t('Data hamesha surakshit')],
            [Users, t('Retailer ke liye free')],
            [Percent, t('15 din free trial')],
            [MessageCircle, t('Hindi + English support')],
          ].map(([Icon, label]) => (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <Icon size={22} className="text-brand-300" />
              <span className="text-sm font-medium text-brand-50">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-7 dark:border-slate-700">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-3 flex items-center gap-2">
            <Logo size={22} />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Rakh Rakhav</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link to="/pricing" className="text-slate-600 hover:underline dark:text-slate-400">{t('Daam')}</Link>
            <Link to="/privacy" className="text-slate-600 hover:underline dark:text-slate-400">{t('Privacy')}</Link>
            <Link to="/terms" className="text-slate-600 hover:underline dark:text-slate-400">{t('Shartein')}</Link>
            <Link to="/refund" className="text-slate-600 hover:underline dark:text-slate-400">{t('Refund')}</Link>
            <Link to="/delivery" className="text-slate-600 hover:underline dark:text-slate-400">{t('Delivery')}</Link>
            <Link to="/contact" className="text-slate-600 hover:underline dark:text-slate-400">{t('Sampark')}</Link>
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} {COMPANY.name} · {COMPANY.site}
          </p>
        </div>
      </footer>
    </div>
  );
}

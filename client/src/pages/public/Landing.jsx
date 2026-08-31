import { Link } from 'react-router-dom';
import {
  Store, ShoppingCart, FileText, Wallet, Package, RotateCcw,
  BarChart3, Users, Bell, ShieldCheck, Check, ArrowRight,
} from 'lucide-react';
import { t } from '@/lib/i18n';
import { COMPANY } from './PolicyShell';
import useSeo from '@/lib/useSeo';
import InstallPrompt from '@/components/InstallPrompt';

/**
 * GHAR KA PAGE — BINA LOGIN KE.
 *
 * Pehle `/` seedha `/login` bhej deta tha. Uska matlab ye tha ki Google ko
 * hamari site pe SIRF ek login screen dikhti thi — na ye likha hota tha ki
 * "Rakh Rakhav" hai kya, na koi shabd jinse wo samajh pata ki kis cheez ke
 * liye hai. Naam se dhundhne wale ko bhi wahi khali screen milti thi.
 *
 * Isliye ye page do kaam ek saath karta hai, aur dono zaroori hain:
 *   1. Naye aadmi ko batata hai ki cheez kya hai, kaam kya karti hai, daam
 *      kya hai — account banane se PEHLE.
 *   2. Google ko asli shabd deta hai. Brand ka naam, kaam ka byora, aur
 *      neeche JSON-LD (index.html me) — teeno se hi wo samajhta hai ki
 *      "rakh rakhav" dhundhne wale ko yahi page chahiye.
 *
 * Jo aadmi pehle se login hai use ye page dikhta hi nahi — wo seedha apne
 * kaam pe chala jata hai (AppRoutes me).
 */

function Feature({ icon: Icon, title, body }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
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

export default function Landing() {
  useSeo({
    title: t('Rakh Rakhav — thok dukaan ka poora hisaab'),
    description: t('Rakh Rakhav ek thok dukaan ka app hai — stock, bill, khata, udhaar, order aur report sab ek jagah. Retailer ke liye hamesha free.'),
    path: '/',
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <InstallPrompt />
      {/* ── upar ka patti ── */}
      <header className="border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Store size={17} />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">Rakh Rakhav</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/pricing" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 sm:block">
              {t('Daam')}
            </Link>
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
              {t('Login')}
            </Link>
            <Link to="/signup" className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              {t('Shuru karein')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {/* ── hero ── */}
        <section className="py-12 sm:py-16">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            {t('Rakh Rakhav — thok dukaan ka poora hisaab, ek jagah')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
            {t('Stock, bill, khata, udhaar, order, kharch aur report — sab ek app me. Aapke retailer apne phone se order bhejte hain, aur unka khata apne aap banta rehta hai.')}
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">
              {t('Free me shuru karein')} <ArrowRight size={17} />
            </Link>
            <Link to="/pricing" className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
              {t('Daam dekhein')}
            </Link>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <Check size={15} /> {t('Retailer ke liye hamesha free — kharidne ka koi paisa nahi')}
          </p>
        </section>

        {/* ── do hisse ── */}
        <section className="grid gap-4 border-t border-slate-200 py-10 dark:border-slate-700 sm:grid-cols-2">
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

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800">
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
            <Feature icon={FileText} title={t('GST bill aur Bill of Supply')}
              body={t('Number daalte hi purana graahak nikal aata hai, rate apne aap bhar jata hai. CGST+SGST ya IGST khud tay hota hai. Bill WhatsApp pe bhej dijiye.')} />
            <Feature icon={Wallet} title={t('Khata aur udhaar')}
              body={t('Kisse kitna lena hai, kisko kitna dena hai — ek screen pe. Paisa apne aap sabse purane bill pe lagta hai. Har party ka CA wala hisaab PDF me.')} />
            <Feature icon={Package} title={t('Stock aur FIFO lagat')}
              body={t('Kaunsa maal kitne ka pada hai, ab kaunsa bikega — sab dikhta hai. Kam hone par pehle hi chetavni mil jati hai.')} />
            <Feature icon={ShoppingCart} title={t('Retailer ke online order')}
              body={t('Aapke retailer apne phone se order bhejte hain. Pack se lekar delivery tak har kadam unhe apne aap dikhta rehta hai.')} />
            <Feature icon={Users} title={t('Har retailer ka apna rate')}
              body={t('Ek-ek retailer ke liye alag daam tay kijiye, ya ek hi niyam poore maal pe laga dijiye. Credit limit bhi apni-apni.')} />
            <Feature icon={RotateCcw} title={t('Wapasi — Credit aur Debit Note')}
              body={t('Maal wapas aaya ya wapas bheja — dono ka pakka note banta hai. Stock aur khata dono apne aap ulta ho jate hain.')} />
            <Feature icon={BarChart3} title={t('Fayde ki asli report')}
              body={t('Bikri se lekar asli bachat tak poora hisaab — maal ki lagat aur dukaan ka kharch ghata kar. GST ka mota-moti andaza bhi.')} />
            <Feature icon={ShieldCheck} title={t('Staff aur unki hadd')}
              body={t('Har aadmi ko utni hi ijazat dijiye jitni chahiye. Discount aur bill ki hadd bandhiye. Kisne kya kiya, wo record kabhi mitta nahi.')} />
            <Feature icon={Bell} title={t('Phone pe notification')}
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

        {/* ── daam ── */}
        <section className="border-t border-slate-200 py-10 dark:border-slate-700">
          <h2 className="mb-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100">{t('Daam')}</h2>
          <p className="mb-5 text-slate-600 dark:text-slate-400">
            {t('Kharidna hamesha free. Paisa sirf bechne ke liye lagta hai.')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['3', t('khate'), '₹50'],
              ['10', t('khate'), '₹100'],
              ['20', t('khate'), '₹500'],
              [t('Anginat'), t('khate'), '₹2000'],
            ].map(([n, unit, price]) => (
              <div key={price} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{n}</div>
                <div className="mb-2 text-sm text-slate-500 dark:text-slate-400">{unit}</div>
                <div className="font-semibold text-brand-700 dark:text-brand-300">
                  {price}<span className="text-sm font-normal text-slate-500"> / {t('mahina')}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            {t('Ginti sirf un logon ki hai jo dukaan chalane ke liye login karte hain. Aapke retailer kitne bhi hon, wo is ginti me nahi aate.')}
          </p>
          <Link to="/pricing" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
            {t('Poora daam dekhein')} <ArrowRight size={15} />
          </Link>
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

        {/* ── aakhri dhakka ── */}
        <section className="border-t border-slate-200 py-12 text-center dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t('Aaj hi shuru kar lijiye')}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-slate-600 dark:text-slate-400">
            {t('Account banane me do minute lagte hain. Retailer ke liye ye hamesha free hai.')}
          </p>
          <Link to="/signup" className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
            {t('Free me shuru karein')} <ArrowRight size={17} />
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-7 dark:border-slate-700">
        <div className="mx-auto max-w-5xl px-4">
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

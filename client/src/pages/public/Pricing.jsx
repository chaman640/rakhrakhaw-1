import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import PolicyShell from './PolicyShell';
import { t } from '@/lib/i18n';

/**
 * DAAM KA PAGE — BINA LOGIN KE.
 *
 * Do wajah se ye login ke peeche NAHI hai:
 *
 *   1. Naya aadmi account banane se pehle daam dekhna chahta hai. Jise pehle
 *      account banana pade, wo aksar banata hi nahi.
 *   2. Payment gateway khud ye page kholta hai, merchant account manzoor
 *      karne se pehle. Login maangne wala page unke liye maujood hi nahi hai —
 *      aur wahi application ruk jane ki sabse aam wajah hai.
 *
 * Daam SERVER se aate hain, yahan likhe hue nahi. Do jagah likhne se ek din
 * page kuch aur kehta aur bill kuch aur — aur wo bug paise se juda hota hai,
 * yaani sabse mehnga.
 */
export default function Pricing() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/billing/plans').then((r) => setData(r.data)).catch(() => {});
  }, []);

  const plans = (data?.plans || []).filter((p) => p.priceRupees > 0);
  const free = (data?.plans || []).find((p) => p.code === 'FREE');

  return (
    <PolicyShell
      title={t('Daam')}
      subtitle={t('Kharidna hamesha free. Bechne ke liye plan.')}
    >
      {/*
        Free wala dabba SABSE UPAR — aur ye jaan-boojh kar hai.

        Zyadatar log yahan ye jaanne aate hain ki "kya isme paisa lagega?".
        Uska jawab pehle de dena, chhupa kar neeche rakhne se bahut behtar hai.
      */}
      {free && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">
            {t('Kharidne ke liye kuch nahi lagta')}
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            {t('Dukaan dhundhna, maal dekhna, order bhejna, apna khata aur bill dekhna — ye sab hamesha free hai. Iske liye kabhi paisa nahi lagega.')}
          </p>
        </div>
      )}

      <p className="text-sm text-slate-600">
        {t('Neeche wale plan sirf tab lagte hain jab aap KHUD bechna chahte hain — apna stock, apna bill, apne graahak. Ginti LOGIN karne wale logon ki hai (aap khud bhi usme gine jate hain). Aapke retailer kitne bhi hon, wo is ginti me nahi aate.')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => (
          <div
            key={p.code}
            className={`rounded-xl border p-5 ${
              p.popular ? 'border-brand-400 bg-brand-50/40 ring-1 ring-brand-200' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">{p.tagline}</p>
              </div>
              {p.popular && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white">
                  <Sparkles size={10} /> {t('Sabse zyada liya jata hai')}
                </span>
              )}
            </div>

            <p className="mt-3">
              <span className="text-2xl font-semibold text-slate-900">₹{p.priceRupees}</span>
              <span className="text-sm text-slate-500"> / {t('mahina')}</span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {p.unlimited ? t('Jitne account chahein') : t('{n} account tak', { n: p.seats })}
            </p>

            <ul className="mt-3 space-y-1.5">
              {(p.features || []).map((f, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-600">
                  <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        {t('Daam me GST alag se lag sakta hai. Paisa mahine ka hai aur kabhi bhi band kiya ja sakta hai — band karne par jitni mohlat baaki hai utne din sab chalta rahega.')}
      </p>

      {/*
        Jab tak paisa liya hi nahi ja raha, ye saaf likh dete hain.

        Bina is line ke daam ka page dikhta hai aur "abhi to kuch bhi nahi
        katta" wali baat sirf hamare paas rehti — aadmi paisa dene ki koshish
        karta hai, kuch hota nahi, aur use lagta hai app kharab hai.
      */}
      {data && !data.chargingNow && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t('Abhi ye plan chalu nahi kiye gaye hain — filhaal poori app free chal rahi hai.')}
        </p>
      )}

      <p className="text-sm">
        <Link className="text-brand-700 hover:underline" to="/signup">
          {t('Account banayein')}
        </Link>
        {' · '}
        <Link className="text-brand-700 hover:underline" to="/refund">
          {t('Refund Policy')}
        </Link>
      </p>
    </PolicyShell>
  );
}

import { useEffect, useState } from 'react';
import { Check, Sparkles, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { loadRazorpay, openCheckout } from '@/lib/razorpay';
import { Button, Card, Spinner, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { bust } from '@/hooks/useQuery';
import { t } from '@/lib/i18n';

/**
 * Plan chunna aur paisa dena — dono jagah yahi lagta hai (plan-khatam wala
 * parda, aur Settings ka billing tab).
 */
export default function PlanPicker({ onDone, compact = false }) {
  const toast = useToast();
  const { user, business } = useAuth();

  const [data, setData] = useState(null);
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    api.get('/billing/plans').then((r) => setData(r.data)).catch(() => {});
  }, []);

  async function buy(code) {
    setBusy(code);
    try {
      const okScript = await loadRazorpay();
      if (!okScript) {
        toast.error(t('Payment ka page khul nahi paya — internet check karke dobara koshish karein'));
        setBusy('');
        return;
      }

      const order = (await api.post('/billing/checkout', { planCode: code, months })).data;

      openCheckout({
        order,
        business,
        user,
        onDismiss: () => setBusy(''),
        onFail: (why) => { setBusy(''); toast.error(why || t('Payment poora nahi hua')); },
        onSuccess: async (proof) => {
          try {
            const res = await api.post('/billing/verify', proof);
            toast.success(res.message);
            bust('billing', 'dashboard', 'items', 'invoices', 'khata', 'payments', 'parties');
            try { sessionStorage.removeItem('rr_needs_plan'); } catch { /* koi baat nahi */ }
            onDone?.(res.data);
          } catch (err) {
            /*
              Paisa kat gaya par verify fail — isme aadmi ko DARANA nahi hai.
              Webhook wahi kaam khud kar dega; use bas intezaar karne ko kehte
              hain, "payment fail" jaisa kuch nahi.
            */
            toast.error(t('Paisa mil gaya hai. Plan chalu hone me thoda waqt lag raha hai — ek minute me page dobara kholein.'));
            console.warn('[billing] verify:', err.message);
          } finally {
            setBusy('');
          }
        },
      });
    } catch (err) {
      toast.error(err.message);
      setBusy('');
    }
  }

  if (!data) {
    return <div className="flex justify-center py-16 text-slate-400"><Spinner size={26} /></div>;
  }

  const plans = (data.plans || []).filter((p) => p.priceRupees > 0);

  return (
    <div className="space-y-4">
      {!data.chargingNow && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('Abhi poori app free chal rahi hai — plan lene ki zarurat nahi.')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">{t('Kitne mahine ka')}</span>
        {[1, 3, 6, 12].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonths(m)}
            className={`rounded-lg border px-3 py-1.5 text-sm focus-ring ${
              months === m
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {plans.map((p) => (
          <Card key={p.code} className={p.popular ? 'border-brand-400 ring-1 ring-brand-200' : ''}>
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
              <span className="text-2xl font-semibold text-slate-900">₹{p.priceRupees * months}</span>
              <span className="text-sm text-slate-500">
                {months === 1 ? ` / ${t('mahina')}` : ` / ${months} ${t('mahine')}`}
              </span>
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

            <Button
              className="mt-4 w-full"
              variant={p.popular ? 'primary' : 'secondary'}
              loading={busy === p.code}
              disabled={Boolean(busy) || !data.chargingNow}
              onClick={() => buy(p.code)}
            >
              {t('Ye plan lein')}
            </Button>
          </Card>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck size={13} className="shrink-0" />
        {t('Paisa Razorpay ke surakshit page pe jata hai. Aapka card ya UPI ki detail hamare paas kabhi nahi aati.')}
      </p>
    </div>
  );
}

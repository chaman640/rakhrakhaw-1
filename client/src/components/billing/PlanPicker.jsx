import { useCallback, useEffect, useState } from 'react';
import {
  Check, Sparkles, ShieldCheck, RefreshCw, AlertTriangle, Clock,
} from 'lucide-react';
import api from '@/lib/api';
import { loadRazorpay, openAutopay } from '@/lib/razorpay';
import { Button, Card, Spinner, useToast } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { bust } from '@/hooks/useQuery';
import { t } from '@/lib/i18n';

/**
 * PLAN CHUNNA — AUTOPAY KE SAATH.
 *
 * Pehle har mahine grahak ko khud paisa dena padta tha. Wo bhool jata tha,
 * aur ek din bill banate waqt achanak "plan khatam" ka parda saamne aa jata —
 * jab uske counter pe graahak khada hota. Ab wo pal aata hi nahi: mandate ek
 * baar milta hai aur paisa har mahine apne aap katta hai.
 *
 * PLAN BADALNE KE DO ALAG NIYAM, aur dono grahak ke haq me hain:
 *
 *   BADA plan   -> ABHI. Use abhi zarurat hai — staff jodna hai ya kaam ruka
 *                  hai. Mahine bhar rukwana bekaar hai.
 *   CHHOTA plan -> MAHINE KE AAKHIR ME. Poore mahine ka paisa de chuke hain,
 *                  to poore mahine ka fayda bhi mile.
 *
 * Dono me mandate wahi rehta hai — dobara manzoori nahi maangi jati. Har baar
 * manzoori maangne pe aadha aadmi wahin chhod deta hai.
 */
export default function PlanPicker({ onDone, compact = false }) {
  const toast = useToast();
  const { user, business } = useAuth();

  const [data, setData] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [plans, mine] = await Promise.all([
      api.get('/billing/plans').catch(() => null),
      api.get('/billing/me').catch(() => null),
    ]);
    if (plans) setData(plans.data);
    if (mine) setMe(mine.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async (res) => {
    bust('billing', 'dashboard', 'items', 'invoices', 'khata', 'payments', 'parties');
    try { sessionStorage.removeItem('rr_needs_plan'); } catch { /* koi baat nahi */ }
    await load();
    onDone?.(res);
  };

  /** Pehli baar — mandate lena padta hai */
  async function shuruKarein(code) {
    setBusy(code);
    try {
      const okScript = await loadRazorpay();
      if (!okScript) {
        toast.error(t('Payment ka page khul nahi paya — internet check karke dobara koshish karein'));
        setBusy('');
        return;
      }

      const sub = (await api.post('/billing/subscribe', { planCode: code })).data;

      /*
        Mandate pehle se tha — server ne plan hi badal diya, checkout nahi
        kholna.

        Pehle yahan `!sub.autopay` dekha jata tha, par summary me `autopay` ek
        OBJECT hai — jo hamesha truthy hota hai. Yaani ye branch kabhi chalta
        hi nahi tha, aur neeche `openAutopay` ko bina subscriptionId ke bulaya
        jata: Razorpay ka parda khali khul jata.
      */
      if (!sub.needsCheckout) {
        toast.success(t('Plan badal diya gaya'));
        await refresh(sub);
        setBusy('');
        return;
      }

      openAutopay({
        sub,
        business,
        user,
        onDismiss: () => setBusy(''),
        onFail: (why) => { setBusy(''); toast.error(why || t('Manzoori poori nahi hui')); },
        onSuccess: async (proof) => {
          try {
            const res = await api.post('/billing/sub-verify', proof);
            toast.success(res.message);
            await refresh(res.data);
          } catch (err) {
            /*
              Manzoori mil gayi par verify fail — isme aadmi ko DARANA nahi
              hai. Webhook wahi kaam khud kar dega.
            */
            toast.error(t('Manzoori mil gayi hai. Plan chalu hone me thoda waqt lag raha hai — ek minute me page dobara kholein.'));
            console.warn('[billing] sub-verify:', err.message);
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

  /** Mandate pehle se hai — sirf plan badalna hai, dobara manzoori nahi */
  async function badlein(code) {
    setBusy(code);
    try {
      const res = await api.post('/billing/change-plan', { planCode: code });
      toast.success(res.message);
      await refresh(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  async function wapasLein() {
    setBusy('undo');
    try {
      const res = await api.post('/billing/undo-change');
      toast.success(res.message);
      await refresh(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  }

  if (!data) {
    return <div className="flex justify-center py-16 text-slate-400"><Spinner size={26} /></div>;
  }

  const plans = (data.plans || []).filter((p) => p.priceRupees > 0);
  const autopayOn = Boolean(me?.autopay?.on);
  const abhiKaCode = me?.plan?.code || '';
  /*
    Grahak ka apna daam — server bhi yahi dekhta hai. Config ka daam badalne
    par purane grahak ke liye upgrade/downgrade ka faisla ulta pad jata tha.
  */
  const abhiKaDaam = me?.plan?.priceRupees || 0;
  const aage = me?.aageWalaPlan || null;
  /*
    Manzoori maangi gayi thi par abhi tak mili nahi — us plan ka button band
    rehta hai. Bina iske aadmi usi plan pe dobara dabata aur dobara charge ho
    jata.
  */
  const manzooriBaaki = me?.autopay?.mangaGayaPlan || '';

  const tareekh = (d) => (d ? new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) : '');

  return (
    <div className="space-y-4">
      {!data.chargingNow && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('Abhi poori app free chal rahi hai — plan lene ki zarurat nahi.')}
        </p>
      )}

      {/* Paisa atak gaya — ye abhi batana chahiye, agle mahine nahi */}
      {me?.autopay?.atka && (
        <div className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t('Autopay atak gaya hai')}</p>
            <p className="text-xs">
              {t('Aapke bank se paisa nahi kat paya. Neeche apna plan dobara chunkar manzoori de dein, warna mohlat khatam hone par kaam ruk jayega.')}
            </p>
          </div>
        </div>
      )}

      {/* Chhota plan liya hua hai — kab lagega, aur wapas lene ka rasta */}
      {aage && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
          <span className="flex items-center gap-2">
            <Clock size={15} className="shrink-0" />
            {t('{date} se {plan} chalu ho jayega (₹{amt}/mahina)', {
              date: tareekh(aage.from), plan: aage.name, amt: aage.priceRupees,
            })}
          </span>
          <button
            type="button"
            onClick={wapasLein}
            disabled={Boolean(busy)}
            className="rounded-md px-2 py-1 text-xs font-semibold text-sky-800 underline hover:bg-sky-100 focus-ring"
          >
            {t('Rehne dein')}
          </button>
        </div>
      )}

      {autopayOn && (
        <p className="flex items-center gap-1.5 text-sm text-emerald-700">
          <RefreshCw size={14} className="shrink-0" />
          {t('Autopay chalu hai — har mahine paisa apne aap kat jayega.')}
        </p>
      )}

      <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {plans.map((p) => {
          const yahi = p.code === abhiKaCode;
          const badaHai = p.priceRupees > abhiKaDaam;
          const rukaHua = aage?.code === p.code;
          const intezaar = manzooriBaaki === p.code;

          return (
            <Card
              key={p.code}
              className={yahi ? 'border-emerald-400 ring-1 ring-emerald-200'
                : p.popular ? 'border-brand-400 ring-1 ring-brand-200' : ''}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.tagline}</p>
                </div>
                {yahi ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white">
                    <Check size={10} /> {t('Abhi yahi')}
                  </span>
                ) : p.popular ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-medium text-white">
                    <Sparkles size={10} /> {t('Sabse zyada liya jata hai')}
                  </span>
                ) : null}
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

              <Button
                className="mt-4 w-full"
                variant={yahi ? 'secondary' : p.popular ? 'primary' : 'secondary'}
                loading={busy === p.code}
                disabled={Boolean(busy) || !data.chargingNow || yahi || rukaHua || intezaar}
                onClick={() => (autopayOn ? badlein(p.code) : shuruKarein(p.code))}
              >
                {yahi ? t('Abhi yahi chalu hai')
                  : intezaar ? t('Manzoori baaki hai')
                    : rukaHua ? t('Mahine ke aakhir me lagega')
                      : !autopayOn ? t('Autopay chalu karein')
                        : badaHai ? t('Abhi is plan pe jayein')
                          : t('Mahine ke aakhir se is plan pe')}
              </Button>

              {/* Button pe dabane se kya hoga — pehle hi saaf, baad me nahi */}
              {intezaar && (
                <p className="mt-1.5 text-center text-[11px] text-amber-700">
                  {t('Manzoori adhoori rah gayi thi — Autopay dobara chalu karne ke liye koi doosra plan chunein ya page refresh karein')}
                </p>
              )}

              {autopayOn && !yahi && !rukaHua && !intezaar && (
                <p className="mt-1.5 text-center text-[11px] text-slate-500">
                  {badaHai
                    ? t('Abhi ₹{amt} katega aur mahina aaj se shuru', { amt: p.priceRupees })
                    : t('Abhi kuch nahi katega — bade plan ka fayda mahine ke aakhir tak')}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck size={13} className="shrink-0" />
        {t('Paisa Razorpay ke surakshit page pe jata hai. Aapka card ya UPI ki detail hamare paas kabhi nahi aati.')}
      </p>
      <p className="text-xs text-slate-500">
        {t('Autopay jab chahein band kar sakte hain — Settings me Plan wale hisse se. Band karne par mahine ke aakhir tak sab chalta rahega.')}
      </p>
    </div>
  );
}

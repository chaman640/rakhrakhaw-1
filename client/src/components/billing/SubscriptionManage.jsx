import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ShieldCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Button, Card, CardHeader, Badge, Spinner, ConfirmModal, useToast } from '@/components/ui';
import PlanPicker from './PlanPicker';
import { t } from '@/lib/i18n';

const TONE = { active: 'green', grace: 'amber', expired: 'red', cancelled: 'slate' };
const LABEL = { active: 'Chalu hai', grace: 'Mohlat me', expired: 'Khatam', cancelled: 'Band kiya hua' };

/**
 * SUBSCRIPTION — Profile se hi sambhalna.
 *
 * Teen sawal jo malik poochta hai, teeno ek jagah:
 *   1. Kaunsa plan chal raha hai, kab tak, mahina ya saal?
 *   2. Autopay chalu hai? Band karna hai?
 *   3. Plan bada/chhota karna hai, ya mahine se saal pe jana hai?
 *
 * Plan badalne ka poora kaam `PlanPicker` karta hai (wahi Autopay page pe
 * bhi hai) — do jagah do alag niyam na ban jayein.
 */
export default function SubscriptionManage() {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMe((await api.get('/billing/me')).data);
    } catch (err) { toast.error(err.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doCancel() {
    setBusy(true);
    try {
      const res = await api.post('/billing/cancel');
      toast.success(res.message || t('Autopay band kar diya'));
      setAskCancel(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  if (!me) return <div className="flex justify-center py-16 text-slate-400"><Spinner size={26} /></div>;

  if (!me.chargingNow) {
    return (
      <Card>
        <p className="text-sm text-slate-600">{t('Abhi ye dukaan free mode me hai — koi payment nahi lagta. Free me {plan} (₹{amt}) wale plan ke feature milte hain.', { plan: t(me.freePlan?.name || 'Chhoti dukaan'), amt: me.freePlan?.priceRupees ?? 50 })}</p>
      </Card>
    );
  }

  const saal = me.plan.period === 'yearly';
  const cancelling = me.autopay.status === 'cancelling' || !me.autoRenew;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">{t(me.plan.name)}</p>
              <Badge tone={TONE[me.status] || 'slate'}>{t(LABEL[me.status] || me.status)}</Badge>
              {me.plan.priceRupees > 0 && (
                <Badge tone="slate">{saal ? t('Har saal') : t('Har mahine')}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {me.plan.priceRupees > 0
                ? `₹${me.plan.periodPriceRupees || me.plan.priceRupees} / ${saal ? t('saal') : t('mahina')}`
                : t('Free')}
            </p>
          </div>

          {me.autopay.on && !cancelling && (
            <Button variant="secondary" size="sm" onClick={() => setAskCancel(true)}>
              {t('Autopay band karein')}
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {me.paidTill && (
            <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
              <CalendarClock size={16} className="shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">{formatDate(me.paidTill)}</p>
                <p className="text-xs text-slate-500">
                  {cancelling
                    ? t('Is din ke baad renew nahi hoga')
                    : me.autopay.on ? t('Is din agla paisa katega') : t('Is din tak paisa diya hua hai')}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
            {me.autopay.on && !cancelling
              ? <ShieldCheck size={16} className="shrink-0 text-emerald-600" />
              : <ShieldAlert size={16} className="shrink-0 text-amber-500" />}
            <div>
              <p className="text-sm font-medium text-slate-900">
                {me.autopay.on && !cancelling ? t('Autopay chalu hai')
                  : cancelling ? t('Autopay band kiya hua')
                    : me.autopay.atka ? t('Autopay atak gaya hai') : t('Autopay laga nahi hai')}
              </p>
              <p className="text-xs text-slate-500">
                {me.autopay.on && !cancelling
                  ? t('Paisa apne aap katega — jab chahein band kar sakte hain')
                  : t('Neeche plan chun kar autopay dobara chalu kar sakte hain')}
              </p>
            </div>
          </div>
        </div>

        <Link to="/autopay" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          {t('Har payment ka hisaab dekhein')} <ArrowRight size={14} />
        </Link>
      </Card>

      <Card padding={false}>
        <CardHeader
          className="p-5 pb-3"
          title={t('Plan badlein')}
          subtitle={t('Bada plan turant lagta hai, chhota plan mahine ke aakhir se. Mahina ya saal — upar chun lijiye.')}
        />
        <div className="px-5 pb-5">
          <PlanPicker onDone={load} />
        </div>
      </Card>

      <ConfirmModal
        open={askCancel}
        onClose={() => setAskCancel(false)}
        onConfirm={doCancel}
        loading={busy}
        title={t('Autopay band karein?')}
        message={t('Aage se paisa nahi katega. Jitni mohlat baaki hai utne din sab chalta rahega — beech me kuch band nahi hoga.')}
        confirmLabel={t('Haan, band karein')}
      />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock, Users, Receipt, TriangleAlert, ShieldCheck, ShieldAlert,
  CheckCircle2, XCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import {
  PageHeader, Button, Card, CardHeader, Badge, Spinner, ConfirmModal, useToast,
} from '@/components/ui';
import PlanPicker from '@/components/billing/PlanPicker';
import { t } from '@/lib/i18n';

const TONE = { active: 'green', grace: 'amber', expired: 'red', cancelled: 'slate' };
const LABEL = {
  active: 'Chalu hai', grace: 'Mohlat me', expired: 'Khatam', cancelled: 'Band kiya hua',
};

const AUTOPAY_LABEL = {
  active: 'Chalu hai', created: 'Manzoori baaki', halted: 'Ruk gaya hai',
  pending: 'Ek baar fail hua', cancelled: 'Band hai', '': 'Laga hi nahi',
};

/**
 * AUTOPAY — ek hi jagah sab kuch (Part 28).
 *
 * Settings > Plan tab me bhi yahi jaankari hai, par wahan chhoti si jagah me
 * dabi hui. Ye page khaas isi ke liye hai — malik ko "kya chal raha hai, kya
 * atka hai, kaise band karna hai" turant, saaf-saaf dikhna chahiye. Payment
 * jaisi cheez me confusion sabse mehenga padta hai.
 */
export default function Autopay() {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get('/billing/me'), api.get('/billing/cycles')]);
      setMe(a.data);
      setCycles(b.data || []);
    } catch (err) { toast.error(err.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doCancel() {
    setBusy(true);
    try {
      const res = await api.post('/billing/cancel');
      toast.success(res.message);
      setAskCancel(false);
      load();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }

  if (!me) {
    return <div className="flex justify-center py-16 text-slate-400"><Spinner size={26} /></div>;
  }

  if (!me.chargingNow) {
    return (
      <>
        <PageHeader title={t('Autopay')} />
        <Card>
          <p className="text-sm text-slate-600">
            {t('Abhi ye dukaan free mode me hai — koi payment nahi lagta.')}
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('Autopay')} subtitle={t('Har mahine kitna kate, kab kate — sab yahin se')} />

      {/* ── abhi ka plan ── */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">{me.plan.name}</p>
              <Badge tone={TONE[me.status] || 'slate'}>{t(LABEL[me.status] || me.status)}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {me.plan.priceRupees > 0 ? `₹${me.plan.priceRupees} / ${t('mahina')}` : t('Free')}
            </p>
          </div>

          {me.autopay.on && (
            <Button variant="secondary" size="sm" onClick={() => setAskCancel(true)}>
              {t('Autopay band karein')}
            </Button>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
            <Users size={16} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                {me.seatsUsed}{me.plan.unlimited ? '' : ` / ${me.plan.seats}`} {t('account')}
              </p>
              <p className="text-xs text-slate-500">
                {me.plan.unlimited ? t('Jitne account chahein') : t('{n} aur jud sakte hain', { n: me.seatsLeft })}
              </p>
            </div>
          </div>

          {me.paidTill && (
            <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
              <CalendarClock size={16} className="shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">{formatDate(me.paidTill)}</p>
                <p className="text-xs text-slate-500">
                  {me.daysLeft >= 0 ? t('{n} din baaki', { n: me.daysLeft }) : t('Mohlat khatam ho chuki hai')}
                </p>
              </div>
            </div>
          )}
        </div>

        {me.status === 'grace' && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {t('Mohlat khatam ho gayi hai. Aapke liye ({n} din) abhi sab chal raha hai — par jo STAFF hain unke liye turant ruk gaya hai. Payment kar dein taaki sabka kaam chalu ho jaye.', { n: me.graceDays })}
          </p>
        )}
        {me.status === 'expired' && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {t('Mohlat bhi khatam ho gayi hai. Bechne ka kaam ruk gaya hai, aur STAFF login bhi nahi kar payenge — sirf aap login kar sakte hain, payment karne ke liye.')}
          </p>
        )}
      </Card>

      {/* ── autopay (mandate) ki halat — saaf-saaf ── */}
      <Card className="mb-4">
        <CardHeader title={t('Autopay ki halat')} subtitle={t('Har mahine paisa apne aap katega ya nahi')} />
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3">
          {me.autopay.on ? (
            <ShieldCheck size={20} className="shrink-0 text-emerald-600" />
          ) : (
            <ShieldAlert size={20} className="shrink-0 text-amber-500" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              {t(AUTOPAY_LABEL[me.autopay.status] || me.autopay.status)}
            </p>
            {me.autopay.atka && (
              <p className="mt-0.5 text-xs text-amber-700">
                {t('Paisa kaatne ki koshish fail ho rahi hai — card/UPI check kar lein, ya naya autopay laga lein.')}
              </p>
            )}
            {!me.autopay.on && !me.autopay.atka && (
              <p className="mt-0.5 text-xs text-slate-500">
                {t('Har mahine khud yaad rakh kar renew karna padega, ya neeche se autopay laga lein.')}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── setup / badlein ── */}
      <Card className="mb-4" padding={false}>
        <CardHeader className="p-5 pb-3" title={t('Plan lagayein ya badlein')}
          subtitle={t('Ek baar manzoori dijiye, phir har mahine apne aap kategá')} />
        <div className="px-5 pb-5">
          <PlanPicker onDone={load} />
        </div>
      </Card>

      {/* ── mahine-dar-mahine itihaas — asli sawal ka jawab ── */}
      <Card padding={false}>
        <CardHeader className="p-5 pb-0" title={t('Har mahine ka hisaab')}
          subtitle={t('Kaunsa mahina chukta hua, kaunsa nahi')} />
        {cycles.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">{t('Abhi tak koi mahina record nahi hua.')}</p>
        ) : (
          <ul className="mt-2">
            {cycles.map((c) => (
              <li key={c._id} className="flex items-center gap-3 border-t border-slate-100 p-4">
                {c.status === 'paid' ? (
                  <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                ) : (
                  <XCircle size={18} className="shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{c.planName}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(c.chargedAt)}
                    {c.failureReason && ` · ${c.failureReason}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-slate-900">{formatMoney(c.amountRupees)}</p>
                  <Badge tone={c.status === 'paid' ? 'green' : 'red'}>
                    {t(c.status === 'paid' ? 'Aaya' : 'Nahi aaya')}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
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
    </>
  );
}

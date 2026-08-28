import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Users, Receipt, TriangleAlert } from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { Button, Card, CardHeader, Badge, Spinner, ConfirmModal, useToast } from '@/components/ui';
import PlanPicker from '@/components/billing/PlanPicker';
import { t } from '@/lib/i18n';

const TONE = { active: 'green', grace: 'amber', expired: 'red', cancelled: 'slate' };
const LABEL = {
  active: 'Chalu hai', grace: 'Mohlat me', expired: 'Khatam', cancelled: 'Band kiya hua',
};

export default function PlanTab() {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [askCancel, setAskCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get('/billing/me'), api.get('/billing/history')]);
      setMe(a.data);
      setRows(b.data || []);
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

  if (!me) return <div className="flex justify-center py-16 text-slate-400"><Spinner size={26} /></div>;

  return (
    <>
      <Card className="mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900">{me.plan.name}</p>
              {me.chargingNow && (
                <Badge tone={TONE[me.status] || 'slate'}>{t(LABEL[me.status] || me.status)}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {me.plan.priceRupees > 0
                ? `₹${me.plan.priceRupees} / ${t('mahina')}`
                : t('Free')}
            </p>
          </div>

          {me.chargingNow && me.status !== 'expired' && me.autoRenew && me.plan.priceRupees > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setAskCancel(true)}>
              {t('Renew band karein')}
            </Button>
          )}
        </div>

        {/*
          Mohlat ke din — grace me ye sabse zaroori number hai. Bina iske aadmi
          ko sirf "kuch gadbad hai" dikhta hai aur wo kuch karta hi nahi.
        */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
            <Users size={16} className="shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                {me.seatsUsed}
                {me.plan.unlimited ? '' : ` / ${me.plan.seats}`} {t('account')}
              </p>
              <p className="text-xs text-slate-500">
                {me.plan.unlimited
                  ? t('Jitne account chahein')
                  : t('{n} aur jud sakte hain', { n: me.seatsLeft })}
              </p>
            </div>
          </div>

          {me.paidTill && (
            <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
              <CalendarClock size={16} className="shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">{formatDate(me.paidTill)}</p>
                <p className="text-xs text-slate-500">
                  {me.daysLeft >= 0
                    ? t('{n} din baaki', { n: me.daysLeft })
                    : t('Mohlat khatam ho chuki hai')}
                </p>
              </div>
            </div>
          )}
        </div>

        {me.status === 'grace' && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            {t('Mohlat khatam ho gayi hai. Abhi sab chal raha hai, par {n} din me bechne ka kaam ruk jayega — kharidna phir bhi chalta rahega.', { n: me.graceDays })}
          </p>
        )}
      </Card>

      <Card className="mb-5" padding={false}>
        <CardHeader className="p-5 pb-3" title={t('Plan badlein ya aage badhayein')} />
        <div className="px-5 pb-5">
          <PlanPicker onDone={load} />
        </div>
      </Card>

      {rows.length > 0 && (
        <Card padding={false}>
          <CardHeader className="p-5 pb-0" title={t('Payment ka record')} />
          <ul className="mt-2">
            {rows.map((r) => (
              <li key={r._id} className="flex items-center gap-3 border-t border-slate-100 p-4">
                <Receipt size={16} className="shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {r.planName} · {r.months} {t('mahine')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(r.paidAt || r.createdAt)}
                    {r.receiptNo && ` · ${r.receiptNo}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-semibold text-slate-900">
                    {formatMoney(r.amountRupees)}
                  </p>
                  <Badge tone={r.status === 'paid' ? 'green' : r.status === 'failed' ? 'red' : 'slate'}>
                    {t(r.status === 'paid' ? 'Mil gaya' : r.status === 'failed' ? 'Nahi hua' : 'Chalu')}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmModal
        open={askCancel}
        onClose={() => setAskCancel(false)}
        onConfirm={doCancel}
        loading={busy}
        title={t('Renew band karein?')}
        message={t('Aage se paisa nahi katega. Jitni mohlat baaki hai utne din sab chalta rahega — beech me kuch band nahi hoga.')}
        confirmLabel={t('Haan, band karein')}
      />
    </>
  );
}

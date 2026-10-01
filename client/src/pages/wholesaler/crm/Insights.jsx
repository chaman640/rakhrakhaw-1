import { useNavigate } from 'react-router-dom';
import {
  Sparkles, RefreshCcw, TrendingDown, AlertTriangle, IndianRupee, Phone, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { useFeature } from '@/hooks/useBilling';
import { formatMoney, formatDate } from '@/lib/format';
import { Card, CardHeader, Spinner, useToast } from '@/components/ui';
import { UpgradeCard } from '@/components/billing/FeatureGate';
import { t } from '@/lib/i18n';
import { SEGMENT, ScorePill } from './crmShared';

const REASON = { reorder: 'Re-order due', at_risk: 'Going quiet', declining: 'Buying less' };

function Row({ r, right, onOpen }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={() => onOpen(r._id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5"><span className="truncate text-sm font-medium text-slate-900">{r.name}</span><ScorePill score={r.score} /></span>
          <span className="block truncate text-xs text-slate-500">{right}</span>
        </span>
      </button>
      {r.phone && <a href={`tel:${r.phone}`} aria-label={t('Call')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600"><Phone size={16} /></a>}
      <ChevronRight size={15} className="shrink-0 text-slate-300" />
    </li>
  );
}

function Section({ icon: Icon, title, subtitle, rows, render, empty, onOpen }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Icon size={16} className="text-brand-700" />{title}<span className="text-slate-400">({rows.length})</span></span>} subtitle={subtitle} />
      {!rows.length ? <p className="py-3 text-center text-sm text-slate-400">{empty}</p>
        : <ul className="divide-y divide-slate-100">{rows.slice(0, 10).map((r) => <Row key={r._id} r={r} right={render(r)} onOpen={onOpen} />)}</ul>}
    </Card>
  );
}

export default function Insights() {
  const navigate = useNavigate();
  const toast = useToast();
  const { allowed, lockedInfo } = useFeature('crm_leads');
  const { data, loading } = useQuery(['crm', 'insights'], () => api.get('/crm/insights').then((r) => r.data), { enabled: allowed, onError: (e) => toast.error(e.message) });
  if (!allowed) return <UpgradeCard info={lockedInfo} />;
  if (loading && !data) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!data) return null;
  const open = (id) => navigate(`/crm/customers/${id}`);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Object.entries(SEGMENT).map(([k, [label]]) => (
          <Card key={k} className="!p-3"><p className="text-xs text-slate-500">{t(label)}</p><p className="text-lg font-semibold text-slate-900">{data.segments?.[k] || 0}</p></Card>
        ))}
      </div>

      {data.smart && (
        <>
          {data.recommended.length > 0 && (
            <Card className="border-brand-200 bg-brand-50/40">
              <CardHeader title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-brand-700" />{t('Contact these customers today ({n})', { n: data.recommended.length })}</span>}
                subtitle={t('Based on their buying pattern, re-order time and recent drop in purchases')} />
              <ul className="divide-y divide-slate-100">
                {data.recommended.slice(0, 12).map((r) => <Row key={r._id} r={r} onOpen={open} right={r.reasons.map((x) => t(REASON[x])).join(' · ')} />)}
              </ul>
            </Card>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Section icon={RefreshCcw} title={t('Re-order due')} subtitle={t('They usually buy these items again around now')} rows={data.reorderDue} onOpen={open}
              empty={t('Nothing due right now')} render={(r) => r.items.map((i) => `${i.name} ~${i.avgQty} (${formatDate(i.expectedAt)})`).join(', ')} />
            <Section icon={AlertTriangle} title={t('Going quiet')} subtitle={t('Late compared to how often they normally order')} rows={data.atRisk} onOpen={open}
              empty={t('Everyone is ordering on time')} render={(r) => t('Orders every ~{g} days, none for {d} days', { g: r.avgGapDays, d: r.daysSince })} />
            <Section icon={TrendingDown} title={t('Big buyers buying less')} subtitle={t('Last 6 months vs the 6 months before')} rows={data.decliningHigh} onOpen={open}
              empty={t('No drop in big customers')} render={(r) => `${formatMoney(r.prev180)} → ${formatMoney(r.last180)}`} />
            <Section icon={IndianRupee} title={t('Payment overdue')} subtitle={t('Bills past due date or older than 30 days')} rows={data.overdue} onOpen={open}
              empty={t('No overdue payments')} render={(r) => `${formatMoney(r.overdue)} ${t('overdue')}`} />
          </div>
          <Card>
            <CardHeader title={t('Customer score spread')} />
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['hot', '75–100', 'text-emerald-700'], ['good', '50–74', 'text-sky-700'], ['average', '25–49', 'text-amber-700'], ['low', '0–24', 'text-slate-600']].map(([k, band, cls]) => (
                <div key={k}><p className={`text-xl font-semibold ${cls}`}>{data.scoreBands[k]}</p><p className="text-xs text-slate-500">{band}</p></div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import {
  Wallet, Landmark, ArrowDownLeft, ArrowUpRight, Receipt, Package,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { useSessionState } from '@/hooks/useSessionState';
import {
  Card, CardHeader, PageHeader, Tabs, Spinner,
} from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import { DayBook, Ledger, TrialBalance } from './accounts/Books';
import {
  ProfitLoss, BalanceSheet, CashFlow, Ageing,
} from './accounts/Statements';
import GstTab, { Checks } from './accounts/GstTab';
import JournalTab from './accounts/JournalTab';
import { Line, dateLabel } from './accounts/accShared';

function Tile({ icon: Icon, label, value, hint, onClick, tone = 'slate' }) {
  const tones = { slate: 'bg-slate-100 text-slate-600', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', brand: 'bg-brand-50 text-brand-700', red: 'bg-red-50 text-red-700' };
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-slate-300 focus-ring">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon size={18} /></span>
      <span className="min-w-0">
        <span className="block text-xs text-slate-500">{label}</span>
        <span className={`tabular block truncate text-lg font-semibold ${value < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatMoney(value)}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}

function Overview({ go, openLedger }) {
  const { data: d, loading } = useQuery(['acc', 'overview'], () => api.get('/accounts/overview').then((x) => x.data));
  const { data: checks } = useQuery(['acc', 'checks'], () => api.get('/accounts/checks').then((x) => x.data), { poll: false });
  if (loading && !d) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;
  if (!d) return null;
  const gst = d.gstPayable;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile icon={Wallet} label={t('Cash in hand')} value={d.cash} tone="green" onClick={() => openLedger('cash')} />
        <Tile icon={Landmark} label={t('Bank (UPI / cheque / transfer)')} value={d.bank} tone="brand" onClick={() => openLedger('bank')} />
        <Tile icon={ArrowDownLeft} label={t('To receive')} value={d.receivable} tone="amber" onClick={() => go('ageing')} />
        <Tile icon={ArrowUpRight} label={t('To pay')} value={d.payable} tone="red" onClick={() => go('ageing')} />
        <Tile icon={Receipt} label={gst >= 0 ? t('GST payable') : t('GST credit (ITC)')} value={Math.abs(gst)} onClick={() => go('gst')} />
        <Tile icon={Package} label={t('Stock value')} value={d.stock} onClick={() => go('bs')} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('This financial year')} subtitle={`${dateLabel(d.fy.from)} – ${dateLabel(d.fy.to)}`} />
          <Line label={t('Net sales')} value={d.fy.netSales} />
          <Line label={t('Gross profit')} value={d.fy.grossProfit} />
          <Line label={t('Expenses')} value={-d.fy.expenses} />
          <Line label={d.fy.netProfit >= 0 ? t('Net profit') : t('Net loss')} value={d.fy.netProfit} strong big onClick={() => go('pl')} />
        </Card>
        <Card>
          <CardHeader title={t('Book health')} subtitle={t('Automatic checks your CA would do')} />
          <Checks items={checks} />
        </Card>
      </div>
    </div>
  );
}

const TABS = [
  ['overview', 'Overview'], ['daybook', 'Day book'], ['ledger', 'Ledger'], ['tb', 'Trial balance'], ['pl', 'Profit & loss'],
  ['bs', 'Balance sheet'], ['cf', 'Cash flow'], ['ageing', 'Receivable / payable'], ['gst', 'GST'], ['journal', 'Journal'],
];

export default function Accounts() {
  const [tab, setTab] = useSessionState('acc:tab', 'overview');
  const [account, setAccount] = useState('cash');
  const openLedger = (key) => { setAccount(key); setTab('ledger'); window.scrollTo({ top: 0 }); };
  return (
    <>
      <PageHeader title={t('Accounts')} subtitle={t('Books, statements and GST — prepared automatically from your bills, purchases, payments and expenses')} />
      <Tabs tabs={TABS.map(([value, label]) => ({ value, label }))} value={tab} onChange={setTab} />
      {tab === 'overview' && <Overview go={setTab} openLedger={openLedger} />}
      {tab === 'daybook' && <DayBook />}
      {tab === 'ledger' && <Ledger account={account} setAccount={setAccount} />}
      {tab === 'tb' && <TrialBalance openLedger={openLedger} />}
      {tab === 'pl' && <ProfitLoss openLedger={openLedger} />}
      {tab === 'bs' && <BalanceSheet openLedger={openLedger} />}
      {tab === 'cf' && <CashFlow />}
      {tab === 'ageing' && <Ageing />}
      {tab === 'gst' && <GstTab />}
      {tab === 'journal' && <JournalTab />}
    </>
  );
}

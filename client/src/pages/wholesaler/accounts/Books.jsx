import { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import {
  Card, Select, Spinner, EmptyState, Badge,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import {
  Amt, DateRange, PresetChips, ExportButton, Toolbar, today, fyStart, dateLabel,
} from './accShared';

const Loading = () => <div className="flex justify-center py-12"><Spinner size={24} /></div>;
const GROUP_LABEL = { asset: 'Assets', liability: 'Liabilities', equity: 'Capital', income: 'Income', expense: 'Expenses' };

export function DayBook() {
  const [r, setR] = useState({ from: today(), to: today() });
  const [type, setType] = useState('');
  const [open, setOpen] = useState(null);
  const { data, loading } = useQuery(['acc', 'daybook', r.from, r.to, type], () => api.get('/accounts/day-book', { params: { ...r, type } }).then((x) => x.data));
  const rows = data?.rows || [];
  return (
    <Card>
      <Toolbar right={<ExportButton name="day-book" rows={rows} cols={[['Date', (v) => dateLabel(v.date)], ['Type', (v) => v.type], ['No.', (v) => v.no], ['Party', (v) => v.party], ['Narration', (v) => v.narration], ['Amount', (v) => v.amount]]} />}>
        <DateRange from={r.from} to={r.to} onChange={setR} />
        <div className="w-44"><Select label={t('Voucher type')} value={type} onChange={(e) => setType(e.target.value)} options={[{ value: '', label: t('All') }, ...(data?.types || []).map((x) => ({ value: x, label: x }))]} /></div>
      </Toolbar>
      {loading && !data ? <Loading /> : !rows.length ? <EmptyState icon={BookOpen} title={t('No entries in this period')} /> : (
        <>
          <p className="mb-2 text-xs text-slate-500">{t('{n} vouchers', { n: data.count })} · <Amt v={data.total} /></p>
          <ul className="divide-y divide-slate-100">
            {rows.map((v) => {
              const k = `${v.type}${v.id}`;
              const isOpen = open === k;
              return (
                <li key={k}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : k)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50">
                    {isOpen ? <ChevronDown size={15} className="shrink-0 text-slate-400" /> : <ChevronRight size={15} className="shrink-0 text-slate-400" />}
                    <span className="w-20 shrink-0 text-xs text-slate-500">{dateLabel(v.date).slice(0, 6)}</span>
                    <Badge tone="slate" className="shrink-0">{t(v.type)}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{[v.no, v.party, v.narration].filter(Boolean).join(' · ')}</span>
                    <Amt v={v.amount} strong />
                  </button>
                  {isOpen && (
                    <table className="mb-2 ml-8 w-[calc(100%-2rem)] text-xs">
                      <tbody>
                        {v.lines.map((l) => (
                          <tr key={l.acct} className="text-slate-600">
                            <td className="py-1">{l.cr ? <span className="pl-6">{t('To')} {l.name}</span> : l.name}</td>
                            <td className="w-28 py-1 text-right">{l.dr ? <Amt v={l.dr} /> : ''}</td>
                            <td className="w-28 py-1 text-right">{l.cr ? <Amt v={l.cr} /> : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

export function Ledger({ account, setAccount }) {
  const [r, setR] = useState({ from: fyStart(), to: today() });
  const { data: tb } = useQuery(['acc', 'tb', today()], () => api.get('/accounts/trial-balance').then((x) => x.data), { poll: false });
  const options = (tb?.rows || []).flatMap((row) => (row.children ? row.children.map((c) => ({ value: c.key, label: `${c.name} (${t(row.name)})` })) : [{ value: row.key, label: t(row.name) }]));
  const current = account || 'cash';
  if (!options.some((o) => o.value === current)) options.unshift({ value: current, label: current === 'cash' ? t('Cash in hand') : current });
  const { data, loading } = useQuery(['acc', 'ledger', current, r.from, r.to], () => api.get('/accounts/ledger', { params: { account: current, ...r } }).then((x) => x.data));
  const rows = data?.rows || [];
  return (
    <Card>
      <Toolbar right={<ExportButton name={`ledger-${data?.account?.name || current}`} rows={rows} cols={[['Date', (x) => dateLabel(x.date)], ['Type', (x) => x.type], ['No.', (x) => x.no], ['Particulars', (x) => x.against], ['Narration', (x) => x.narration], ['Debit', (x) => x.dr], ['Credit', (x) => x.cr], ['Balance', (x) => x.balance]]} />}>
        <div className="w-64"><Select label={t('Account')} value={current} onChange={(e) => setAccount(e.target.value)} options={options} /></div>
        <DateRange from={r.from} to={r.to} onChange={setR} />
        <PresetChips onPick={setR} />
      </Toolbar>
      {loading && !data ? <Loading /> : data && (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-5 py-2 font-medium">{t('Date')}</th><th className="px-2 py-2 font-medium">{t('Particulars')}</th>
              <th className="px-2 py-2 text-right font-medium">{t('Debit')}</th><th className="px-2 py-2 text-right font-medium">{t('Credit')}</th><th className="px-5 py-2 text-right font-medium">{t('Balance')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50 text-slate-600"><td className="px-5 py-2" colSpan={4}>{t('Opening balance')}</td><td className="px-5 py-2 text-right"><Bal v={data.opening} /></td></tr>
              {rows.map((x, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-5 py-2 text-slate-500">{dateLabel(x.date)}</td>
                  <td className="px-2 py-2"><span className="block text-slate-900">{x.against || x.type}</span><span className="block text-xs text-slate-500">{[t(x.type), x.no, x.party, x.narration].filter(Boolean).join(' · ')}</span></td>
                  <td className="px-2 py-2 text-right">{x.dr ? <Amt v={x.dr} /> : ''}</td>
                  <td className="px-2 py-2 text-right">{x.cr ? <Amt v={x.cr} /> : ''}</td>
                  <td className="px-5 py-2 text-right"><Bal v={x.balance} /></td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 font-semibold"><td className="px-5 py-2" colSpan={2}>{t('Closing balance')}</td><td className="px-2 py-2 text-right"><Amt v={data.totals.dr} /></td><td className="px-2 py-2 text-right"><Amt v={data.totals.cr} /></td><td className="px-5 py-2 text-right"><Bal v={data.closing} /></td></tr>
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const Bal = ({ v }) => (v ? <span className="tabular whitespace-nowrap">{Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} {v > 0 ? t('Dr') : t('Cr')}</span> : <span className="text-slate-400">0.00</span>);

export function TrialBalance({ openLedger }) {
  const [to, setTo] = useState(today());
  const [expand, setExpand] = useState({});
  const { data, loading } = useQuery(['acc', 'tb', to], () => api.get('/accounts/trial-balance', { params: { to } }).then((x) => x.data));
  const flat = (data?.rows || []).flatMap((r) => (r.children ? r.children.map((c) => ({ ...c, group: r.name })) : [{ ...r, group: GROUP_LABEL[r.group] }]));
  let lastGroup = '';
  return (
    <Card>
      <Toolbar right={<ExportButton name="trial-balance" rows={flat} cols={[['Group', (r) => r.group], ['Account', (r) => r.name], ['Debit', (r) => r.dr], ['Credit', (r) => r.cr]]} />}>
        <DateRange single to={to} onChange={(x) => setTo(x.to)} />
      </Toolbar>
      {loading && !data ? <Loading /> : data && (
        <>
          {data.totals.difference !== 0 && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t('Trial balance does not tally. Difference')}: <Amt v={data.totals.difference} /></p>}
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="px-5 py-2 font-medium">{t('Account')}</th><th className="px-2 py-2 text-right font-medium">{t('Debit')}</th><th className="px-5 py-2 text-right font-medium">{t('Credit')}</th></tr></thead>
              <tbody>
                {data.rows.map((r) => {
                  const head = r.group !== lastGroup ? (lastGroup = r.group) : null;
                  return [
                    head && <tr key={`g${r.group}`}><td colSpan={3} className="bg-slate-50 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t(GROUP_LABEL[r.group])}</td></tr>,
                    <tr key={r.key} className="border-b border-slate-100">
                      <td className="px-5 py-2">
                        {r.children ? (
                          <button type="button" onClick={() => setExpand({ ...expand, [r.key]: !expand[r.key] })} className="inline-flex items-center gap-1 font-medium text-slate-900">
                            {expand[r.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{t(r.name)} <span className="text-xs font-normal text-slate-500">({r.children.length})</span>
                          </button>
                        ) : <button type="button" onClick={() => openLedger(r.key)} className="text-left text-slate-900 hover:text-brand-700">{t(r.name)}</button>}
                      </td>
                      <td className="px-2 py-2 text-right">{r.dr ? <Amt v={r.dr} /> : ''}</td>
                      <td className="px-5 py-2 text-right">{r.cr ? <Amt v={r.cr} /> : ''}</td>
                    </tr>,
                    ...(r.children && expand[r.key] ? r.children.map((c) => (
                      <tr key={c.key} className="border-b border-slate-50 text-slate-600">
                        <td className="py-1.5 pl-11 pr-5"><button type="button" onClick={() => openLedger(c.key)} className="text-left hover:text-brand-700">{c.name}</button></td>
                        <td className="px-2 py-1.5 text-right">{c.dr ? <Amt v={c.dr} /> : ''}</td>
                        <td className="px-5 py-1.5 text-right">{c.cr ? <Amt v={c.cr} /> : ''}</td>
                      </tr>
                    )) : []),
                  ];
                })}
                <tr className={cn('border-t-2 border-slate-300 font-semibold', data.totals.difference ? 'text-red-700' : 'text-slate-900')}>
                  <td className="px-5 py-2.5">{t('Total')}</td><td className="px-2 py-2.5 text-right"><Amt v={data.totals.dr} strong /></td><td className="px-5 py-2.5 text-right"><Amt v={data.totals.cr} strong /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">{t('Closing stock (not part of the trial balance)')}: <Amt v={data.closingStock} /></p>
        </>
      )}
    </Card>
  );
}


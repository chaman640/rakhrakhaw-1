import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { formatPhone } from '@/lib/format';
import {
  Card, Chips, Spinner, EmptyState,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import {
  Amt, DateRange, PresetChips, ExportButton, Toolbar, Line, today, fyStart, dateLabel,
} from './accShared';

const Loading = () => <div className="flex justify-center py-12"><Spinner size={24} /></div>;

export function ProfitLoss({ openLedger }) {
  const [r, setR] = useState({ from: fyStart(), to: today() });
  const { data: d, loading } = useQuery(['acc', 'pl', r.from, r.to], () => api.get('/accounts/profit-loss', { params: r }).then((x) => x.data));
  const tr = d?.trading;
  return (
    <div className="space-y-4">
      <Card>
        <Toolbar right={d && <ExportButton name="profit-loss" rows={[
          ['Sales', tr.sales], ['Sales returns', -tr.salesReturn], ['Opening stock', -tr.openingStock], ['Goods brought in', -tr.broughtIn], ['Purchases', -tr.purchases],
          ['Purchase returns', tr.purchaseReturn], ['Stock written off', tr.writtenOff], ['Closing stock', tr.closingStock], ['Gross profit', tr.grossProfit],
          ...d.incomes.map((x) => [x.name, x.amount]), ...d.expenses.map((x) => [x.name, -x.amount]), ['Net profit', d.netProfit],
        ]} cols={[['Particulars', (x) => x[0]], ['Amount', (x) => x[1]]]} />}>
          <DateRange from={r.from} to={r.to} onChange={setR} />
          <PresetChips onPick={setR} />
        </Toolbar>
        {loading && !d ? <Loading /> : d && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Trading account')}</p>
              <Line label={t('Sales')} value={tr.sales} onClick={() => openLedger('sales')} />
              {tr.salesReturn > 0 && <Line label={t('Less: sales returns')} value={-tr.salesReturn} indent muted />}
              <Line label={t('Net sales')} value={tr.netSales} strong />
              <Line label={t('Opening stock')} value={tr.openingStock} />
              {tr.broughtIn > 0 && <Line label={t('Add: goods brought in (opening stock)')} value={tr.broughtIn} indent muted />}
              <Line label={t('Add: purchases')} value={tr.purchases} indent onClick={() => openLedger('purchases')} />
              {tr.purchaseReturn > 0 && <Line label={t('Less: purchase returns')} value={-tr.purchaseReturn} indent muted />}
              {tr.writtenOff > 0 && <Line label={t('Less: stock written off')} value={-tr.writtenOff} indent muted />}
              <Line label={t('Less: closing stock')} value={-tr.closingStock} indent />
              <Line label={t('Cost of goods sold')} value={tr.cogs} strong />
              <Line label={t('Gross profit')} value={tr.grossProfit} strong big />
              <p className="text-xs text-slate-500">{t('Gross margin')}: {d.grossMarginPct}%</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Profit & loss account')}</p>
              <Line label={t('Gross profit')} value={tr.grossProfit} />
              {d.incomes.map((x) => <Line key={x.key} label={t(x.name)} value={x.amount} indent onClick={() => openLedger(x.key)} />)}
              {d.expenses.map((x) => <Line key={x.key} label={t(x.name)} value={-x.amount} indent onClick={() => openLedger(x.key)} />)}
              <Line label={t('Total expenses')} value={-d.totalExpenses} strong />
              <Line label={d.netProfit >= 0 ? t('Net profit') : t('Net loss')} value={d.netProfit} strong big />
            </div>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-500">{t('Books use the periodic stock method (opening stock + purchases − closing stock). The Reports → Profit & Loss page uses item-wise FIFO cost, so small differences can appear when stock is adjusted by hand.')}</p>
    </div>
  );
}

export function BalanceSheet({ openLedger }) {
  const [to, setTo] = useState(today());
  const { data: d, loading } = useQuery(['acc', 'bs', to], () => api.get('/accounts/balance-sheet', { params: { to } }).then((x) => x.data));
  const clickable = (k) => !['stock', 'gst', 'profit', 'debtors', 'creditors'].includes(k);
  const Side = ({ title, groups }) => (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {groups.filter(([, rows]) => rows.length).map(([label, rows, total]) => (
        <div key={label} className="mb-3">
          <p className="text-sm font-medium text-slate-900">{t(label)}</p>
          {rows.map((x) => <Line key={x.key} label={t(x.name)} value={x.amount} indent onClick={clickable(x.key) ? () => openLedger(x.key) : undefined} />)}
          {rows.length > 1 && <Line label={t('Subtotal')} value={total} muted />}
        </div>
      ))}
    </div>
  );
  return (
    <Card>
      <Toolbar right={d && <ExportButton name="balance-sheet" rows={[...d.equity.map((x) => ['Capital', x.name, x.amount]), ...d.liabilities.map((x) => ['Liabilities', x.name, x.amount]), ...d.assets.map((x) => ['Assets', x.name, x.amount])]} cols={[['Side', (x) => x[0]], ['Account', (x) => x[1]], ['Amount', (x) => x[2]]]} />}>
        <DateRange single to={to} onChange={(x) => setTo(x.to)} />
      </Toolbar>
      {loading && !d ? <Loading /> : d && (
        <>
          {d.totals.difference !== 0 && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t('Balance sheet does not tally. Difference')}: <Amt v={d.totals.difference} /></p>}
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <Side title={t('Capital & liabilities')} groups={[['Capital', d.equity, d.totals.equity], ['Liabilities', d.liabilities, d.totals.liabilities]]} />
              <Line label={t('Total')} value={d.totals.liabilitiesAndEquity} strong big />
            </div>
            <div>
              <Side title={t('Assets')} groups={[['Assets', d.assets, d.totals.assets]]} />
              <Line label={t('Total')} value={d.totals.assets} strong big />
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">{t('As on {d}', { d: dateLabel(d.asOn) })}</p>
        </>
      )}
    </Card>
  );
}

export function CashFlow() {
  const [r, setR] = useState({ from: fyStart(), to: today() });
  const { data: d, loading } = useQuery(['acc', 'cf', r.from, r.to], () => api.get('/accounts/cash-flow', { params: r }).then((x) => x.data));
  return (
    <Card>
      <Toolbar right={d && <ExportButton name="cash-flow" rows={d.sections.flatMap((s) => s.rows.map((x) => [s.label, x.label, x.amount]))} cols={[['Section', (x) => x[0]], ['Particulars', (x) => x[1]], ['Amount', (x) => x[2]]]} />}>
        <DateRange from={r.from} to={r.to} onChange={setR} />
        <PresetChips onPick={setR} />
      </Toolbar>
      {loading && !d ? <Loading /> : d && (
        <div className="max-w-xl">
          <Line label={t('Opening cash & bank')} value={d.opening} strong />
          {d.sections.map((s) => (
            <div key={s.key} className="mt-3">
              <p className="text-sm font-medium text-slate-900">{t(s.label)}</p>
              {s.rows.length ? s.rows.map((x) => <Line key={x.label} label={t(x.label)} value={x.amount} indent />) : <p className="py-1 pl-4 text-sm text-slate-400">—</p>}
              <Line label={t('Net from {x}', { x: t(s.label).toLowerCase() })} value={s.total} muted />
            </div>
          ))}
          <Line label={t('Net change in cash & bank')} value={d.net} strong />
          <Line label={t('Closing cash & bank')} value={d.closing} strong big />
        </div>
      )}
    </Card>
  );
}

export function Ageing() {
  const navigate = useNavigate();
  const [side, setSide] = useState('receivable');
  const { data: d, loading } = useQuery(['acc', 'ageing', side], () => api.get('/accounts/ageing', { params: { side } }).then((x) => x.data));
  const rows = d?.rows || [];
  return (
    <Card>
      <Toolbar right={<ExportButton name={side} rows={rows} cols={[['Party', (x) => x.name], ['Phone', (x) => x.phone], ...(d?.labels || []).map((l, i) => [l, (x) => x.buckets[i]]), ['Other / opening', (x) => x.other], ['Advance', (x) => x.advance], ['Balance', (x) => x.balance]]} />}>
        <Chips value={side} onChange={setSide} options={[{ value: 'receivable', label: 'To receive' }, { value: 'payable', label: 'To pay' }]} />
      </Toolbar>
      {loading && !d ? <Loading /> : !rows.length ? <EmptyState title={side === 'receivable' ? t('Nothing to receive') : t('Nothing to pay')} /> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-5 py-2 font-medium">{t('Party')}</th>
              {d.labels.map((l) => <th key={l} className="px-2 py-2 text-right font-medium">{t(l)}</th>)}
              <th className="px-2 py-2 text-right font-medium">{t('Other / opening')}</th><th className="px-5 py-2 text-right font-medium">{t('Balance')}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((x) => (
                <tr key={x.partyId} onClick={() => navigate(`/${side === 'receivable' ? 'retailers' : 'suppliers'}/${x.partyId}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-5 py-2"><span className="block font-medium text-slate-900">{x.name}</span><span className="text-xs text-slate-500">{formatPhone(x.phone)}</span></td>
                  {x.buckets.map((b, i) => <td key={i} className={`px-2 py-2 text-right ${i === 3 && b ? 'text-red-600' : ''}`}>{b ? <Amt v={b} /> : ''}</td>)}
                  <td className="px-2 py-2 text-right">{x.other ? <Amt v={x.other} /> : ''}</td>
                  <td className="px-5 py-2 text-right">{x.advance ? <span className="text-xs text-emerald-700">{t('Advance')} <Amt v={x.advance} /></span> : <Amt v={x.balance} strong />}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="px-5 py-2">{t('Total')}</td>
                {d.totals.buckets.map((b, i) => <td key={i} className="px-2 py-2 text-right"><Amt v={b} /></td>)}
                <td className="px-2 py-2 text-right"><Amt v={d.totals.other} /></td>
                <td className="px-5 py-2 text-right"><Amt v={d.totals.balance} strong /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {d?.totals?.advance > 0 && <p className="mt-3 text-xs text-slate-500">{side === 'receivable' ? t('Advance received from customers') : t('Advance paid to suppliers')}: <Amt v={d.totals.advance} /></p>}
    </Card>
  );
}

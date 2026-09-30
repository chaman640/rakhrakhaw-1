import { useState } from 'react';
import Recon2b from './Recon2b';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import {
  Card, CardHeader, Chips, Spinner, Badge,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { MonthPicker } from '@/pages/wholesaler/hr/hrShared';
import {
  Amt, ExportButton, Toolbar, thisMonth, dateLabel,
} from './accShared';

const Loading = () => <div className="flex justify-center py-12"><Spinner size={24} /></div>;
const TAX_COLS = [['Taxable value', 'taxable'], ['IGST', 'igst'], ['CGST', 'cgst'], ['SGST', 'sgst']];

function TaxTable({ rows }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
          <th className="px-5 py-2 font-medium">{t('Details')}</th>
          {TAX_COLS.map(([h]) => <th key={h} className="px-2 py-2 text-right font-medium last:pr-5">{t(h)}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([label, v, strong]) => (
            <tr key={label} className={strong ? 'font-semibold' : ''}>
              <td className="px-5 py-2">{t(label)}</td>
              {TAX_COLS.map(([, k]) => <td key={k} className="px-2 py-2 text-right last:pr-5">{v?.[k] !== undefined ? <Amt v={v[k]} /> : ''}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Gstr3b({ period }) {
  const { data: d, loading } = useQuery(['acc', 'gstr3b', period], () => api.get('/accounts/gst/gstr3b', { params: { period } }).then((x) => x.data));
  if (loading && !d) return <Loading />;
  if (!d) return null;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('3.1 Outward supplies')} subtitle={t('Sales less credit notes, from your GST bills')} />
        <TaxTable rows={[['(a) Taxable supplies', d.table31.a, true], ['(c) Nil rated / exempt', { taxable: d.table31.c.taxable }]]} />
      </Card>
      <Card>
        <CardHeader title={t('4 Input tax credit')} subtitle={t('From purchases with a registered supplier (GSTIN)')} />
        <TaxTable rows={[['(A) ITC available', d.table4.available], ['(B) Reversed (purchase returns)', d.table4.reversed], ['(C) Net ITC', d.table4.net, true]]} />
        {d.table4.notEligible.count > 0 && (
          <p className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
            {t('{n} purchase(s) with ₹{a} GST are from suppliers without a GSTIN — this tax cannot be claimed.', { n: d.table4.notEligible.count, a: d.table4.notEligible.tax })}
          </p>
        )}
      </Card>
      <Card>
        <CardHeader title={t('Tax payable after set-off')} subtitle={t('IGST credit is used first, then CGST and SGST, as per GST rules')} />
        <TaxTable rows={[['Cash to pay', d.payable, true], ['Credit carried forward', d.carryForward]]} />
        <p className="mt-3 text-lg font-semibold text-slate-900">{t('Total payable')}: <Amt v={d.totalPayable} strong zero /></p>
      </Card>
    </div>
  );
}

function Gstr1({ period }) {
  const [sec, setSec] = useState('b2b');
  const { data: d, loading } = useQuery(['acc', 'gstr1', period], () => api.get('/accounts/gst/gstr1', { params: { period } }).then((x) => x.data));
  if (loading && !d) return <Loading />;
  if (!d) return null;
  const s = d.summary;
  const flatDocs = (list, noKey) => list.flatMap((x) => x.rates.map((r) => ({ ...x, ...r, no: x[noKey] })));
  const views = {
    b2b: { rows: flatDocs(d.b2b, 'invoiceNo'), cols: [['GSTIN', (x) => x.gstin], ['Party', (x) => x.name], ['Invoice no.', (x) => x.no], ['Date', (x) => dateLabel(x.date)], ['Invoice value', (x) => x.value], ['Place of supply', (x) => x.placeOfSupply], ['Rate', (x) => x.rate], ['Taxable value', (x) => x.taxable], ['IGST', (x) => x.igst], ['CGST', (x) => x.cgst], ['SGST', (x) => x.sgst]] },
    b2cl: { rows: flatDocs(d.b2cl, 'invoiceNo'), cols: [['Invoice no.', (x) => x.no], ['Date', (x) => dateLabel(x.date)], ['Invoice value', (x) => x.value], ['Place of supply', (x) => x.placeOfSupply], ['Rate', (x) => x.rate], ['Taxable value', (x) => x.taxable], ['IGST', (x) => x.igst]] },
    b2cs: { rows: d.b2cs, cols: [['Type', (x) => x.type], ['Place of supply', (x) => x.placeOfSupply], ['Rate', (x) => x.rate], ['Taxable value', (x) => x.taxable], ['IGST', (x) => x.igst], ['CGST', (x) => x.cgst], ['SGST', (x) => x.sgst]] },
    cdnr: { rows: flatDocs(d.cdnr, 'noteNo'), cols: [['GSTIN', (x) => x.gstin], ['Party', (x) => x.name], ['Note no.', (x) => x.no], ['Date', (x) => dateLabel(x.date)], ['Against bill', (x) => x.againstNo], ['Note value', (x) => x.value], ['Rate', (x) => x.rate], ['Taxable value', (x) => x.taxable], ['IGST', (x) => x.igst], ['CGST', (x) => x.cgst], ['SGST', (x) => x.sgst]] },
    hsn: { rows: d.hsn, cols: [['HSN', (x) => x.hsn], ['Description', (x) => x.description], ['UQC', (x) => x.uqc], ['Quantity', (x) => x.qty], ['Rate', (x) => x.rate], ['Total value', (x) => x.value], ['Taxable value', (x) => x.taxable], ['IGST', (x) => x.igst], ['CGST', (x) => x.cgst], ['SGST', (x) => x.sgst]] },
  };
  const v = views[sec];
  return (
    <Card>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['b2b', 'B2B invoices'], ['b2cl', 'B2C large'], ['b2cs', 'B2C small'], ['cdnr', 'Credit notes (registered)']].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setSec(k)} className={`rounded-xl border p-3 text-left focus-ring ${sec === k ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white'}`}>
            <p className="text-xs text-slate-500">{t(l)}</p>
            <p className="text-lg font-semibold text-slate-900">{s[k].count}</p>
            <p className="text-xs text-slate-600"><Amt v={s[k].taxable} /></p>
          </button>
        ))}
      </div>
      <Toolbar right={<ExportButton name={`gstr1-${sec}-${period}`} rows={v.rows} cols={v.cols} />}>
        <Chips value={sec} onChange={setSec} options={[{ value: 'b2b', label: 'B2B' }, { value: 'b2cl', label: 'B2CL' }, { value: 'b2cs', label: 'B2CS' }, { value: 'cdnr', label: 'CDNR' }, { value: 'hsn', label: 'HSN summary' }]} />
      </Toolbar>
      {!v.rows.length ? <p className="py-8 text-center text-sm text-slate-400">{t('No entries in this section')}</p> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">{v.cols.map(([h]) => <th key={h} className="px-3 py-2 font-medium first:pl-5 last:pr-5">{t(h)}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {v.rows.map((row, i) => (
                <tr key={i}>{v.cols.map(([h, f]) => {
                  const val = f(row);
                  return <td key={h} className="whitespace-nowrap px-3 py-2 first:pl-5 last:pr-5">{typeof val === 'number' && !['Rate', 'Quantity'].includes(h) ? <Amt v={val} /> : (h === 'Rate' ? `${val}%` : val)}</td>;
                })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        {t('Documents issued')}: {d.docs.from ? `${d.docs.from} – ${d.docs.to}` : '—'} · {t('Total')} {d.docs.total} · {t('Cancelled')} {d.docs.cancelled}
      </p>
    </Card>
  );
}

function PurchaseGst({ period }) {
  const { data: d, loading } = useQuery(['acc', 'gst-pur', period], () => api.get('/accounts/gst/purchases', { params: { period } }).then((x) => x.data));
  if (loading && !d) return <Loading />;
  if (!d) return null;
  const cols = [['Purchase no.', (x) => x.no], ['Supplier bill', (x) => x.billNo], ['Date', (x) => dateLabel(x.date)], ['Supplier', (x) => x.supplier], ['GSTIN', (x) => x.gstin], ['Taxable value', (x) => x.taxable], ['IGST', (x) => x.igst], ['CGST', (x) => x.cgst], ['SGST', (x) => x.sgst]];
  return (
    <Card>
      <Toolbar right={<ExportButton name={`purchase-gst-${period}`} rows={d.rows} cols={cols} />}>
        <div className="text-sm text-slate-600">{t('Eligible ITC')}: <Amt v={d.eligible.igst + d.eligible.cgst + d.eligible.sgst} strong /></div>
      </Toolbar>
      {!d.rows.length ? <p className="py-8 text-center text-sm text-slate-400">{t('No purchases with GST this month')}</p> : (
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="px-5 py-2 font-medium">{t('Purchase')}</th><th className="px-2 py-2 font-medium">{t('Supplier')}</th><th className="px-2 py-2 text-right font-medium">{t('Taxable value')}</th><th className="px-2 py-2 text-right font-medium">{t('GST')}</th><th className="px-5 py-2 font-medium">{t('ITC')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {d.rows.map((x) => (
                <tr key={x.no}>
                  <td className="px-5 py-2"><span className="block">{x.no}</span><span className="text-xs text-slate-500">{dateLabel(x.date)}{x.billNo ? ` · ${x.billNo}` : ''}</span></td>
                  <td className="px-2 py-2"><span className="block">{x.supplier}</span><span className="text-xs text-slate-500">{x.gstin || t('No GSTIN')}</span></td>
                  <td className="px-2 py-2 text-right"><Amt v={x.taxable} /></td>
                  <td className="px-2 py-2 text-right"><Amt v={x.igst + x.cgst + x.sgst} /></td>
                  <td className="px-5 py-2"><Badge tone={x.eligible ? 'green' : 'amber'}>{x.eligible ? t('Eligible') : t('Not eligible')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function Checks({ items }) {
  return (
    <ul className="divide-y divide-slate-100">
      {(items || []).map((c) => (
        <li key={c.key} className="flex gap-3 py-2.5">
          {c.key === 'info' ? <Info size={17} className="mt-0.5 shrink-0 text-slate-400" /> : c.ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{t(c.title)}{c.count ? ` (${c.count})` : ''}</p>
            {c.detail && <p className="break-words text-xs text-slate-500">{c.detail}</p>}
            {!c.ok && c.hint && <p className="text-xs text-amber-700">{t(c.hint)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function GstChecks({ period }) {
  const { data, loading } = useQuery(['acc', 'gst-checks', period], () => api.get('/accounts/gst/checks', { params: { period } }).then((x) => x.data));
  return <Card>{loading && !data ? <Loading /> : <Checks items={data} />}</Card>;
}

export default function GstTab() {
  const [period, setPeriod] = useState(thisMonth());
  const [view, setView] = useState('3b');
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthPicker value={period} onChange={setPeriod} />
        <Chips value={view} onChange={setView} options={[{ value: '3b', label: 'GSTR-3B' }, { value: '1', label: 'GSTR-1' }, { value: 'itc', label: 'Purchase GST (ITC)' }, { value: '2b', label: '2B reconciliation' }, { value: 'checks', label: 'Checks' }]} />
      </div>
      {view === '3b' && <Gstr3b period={period} />}
      {view === '1' && <Gstr1 period={period} />}
      {view === 'itc' && <PurchaseGst period={period} />}
      {view === '2b' && <Recon2b period={period} />}
      {view === 'checks' && <GstChecks period={period} />}
      <p className="mt-3 text-xs text-slate-500">{t('Figures are prepared from your bills, purchases and returns. File them on the GST portal or share the CSV with your CA.')}</p>
    </>
  );
}

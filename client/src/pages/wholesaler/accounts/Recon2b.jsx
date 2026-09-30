import { useRef, useState } from 'react';
import { Upload, FileJson } from 'lucide-react';
import api from '@/lib/api';
import {
  Card, CardHeader, Button, Chips, EmptyState, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { Amt, dateLabel, ExportButton } from './accShared';

/** GSTR-2B (portal JSON) vs purchase book — what ITC is safe to claim */
export default function Recon2b({ period }) {
  const toast = useToast();
  const ref = useRef(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('mismatch');

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    try {
      const json = JSON.parse(await file.text());
      const r = await api.post('/accounts/gst/2b', { period, json });
      setRes(r.data);
      setView(r.data.summary.mismatch ? 'mismatch' : r.data.summary.notIn2b ? 'notIn2b' : 'matched');
    } catch (e) { toast.error(e?.name === 'SyntaxError' ? t('This file is not valid JSON. Download GSTR-2B as JSON from the GST portal.') : e.message); } finally { setBusy(false); }
  }

  const s = res?.summary;
  const lists = {
    matched: { rows: res?.matched || [], cols: [['Supplier', (x) => x.supplier], ['GSTIN', (x) => x.gstin], ['Bill no.', (x) => x.no], ['Our entry', (x) => x.purchaseNo], ['Tax', (x) => x.tax]] },
    mismatch: { rows: res?.mismatch || [], cols: [['Supplier', (x) => x.supplier], ['Bill no.', (x) => x.no], ['Our entry', (x) => x.purchaseNo], ['Tax in 2B', (x) => x.tax], ['Tax in books', (x) => x.booksTax], ['Difference', (x) => x.diff]] },
    notInBooks: { rows: res?.notInBooks || [], cols: [['Supplier', (x) => x.supplier], ['GSTIN', (x) => x.gstin], ['Bill no.', (x) => x.no], ['Date', (x) => x.date], ['Taxable', (x) => x.taxable], ['Tax', (x) => x.tax]] },
    notIn2b: { rows: res?.notIn2b || [], cols: [['Our entry', (x) => x.purchaseNo], ['Supplier', (x) => x.supplier], ['Bill no.', (x) => x.supplierBillNo], ['Date', (x) => dateLabel(x.date)], ['Tax', (x) => x.tax], ['Why', (x) => t(x.reason)]] },
  };
  const cur = lists[view];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('ITC reconciliation (GSTR-2B)')} subtitle={t('Download GSTR-2B for this month as JSON from the GST portal and upload it here. Nothing is stored.')}
          action={<Button icon={Upload} loading={busy} onClick={() => ref.current?.click()}>{t('Upload 2B JSON')}</Button>} />
        <input ref={ref} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />
        {!s ? <EmptyState icon={FileJson} title={t('No 2B file uploaded yet')} message={t('Your purchase bills are matched with what suppliers filed, by supplier GSTIN and bill number.')} /> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['ITC in 2B', s.itcIn2b], ['ITC in your books', s.itcInBooks], ['Safe to claim', s.safeItc], ['At risk (not in 2B)', s.atRisk]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{t(l)}</p><p className="text-lg font-semibold"><Amt v={v} /></p></div>
            ))}
          </div>
        )}
      </Card>
      {s && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Chips value={view} onChange={setView} options={[
              { value: 'mismatch', label: 'Amount differs', count: s.mismatch }, { value: 'notIn2b', label: 'Not in 2B', count: s.notIn2b },
              { value: 'notInBooks', label: 'Missing in books', count: s.notInBooks }, { value: 'matched', label: 'Matched', count: s.matched },
            ]} />
            <ExportButton name={`2b-${view}-${period}`} rows={cur.rows} cols={cur.cols} />
          </div>
          {!cur.rows.length ? <p className="py-6 text-center text-sm text-slate-500">{t('Nothing here')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>{cur.cols.map(([h]) => <th key={h} className="px-2 py-2">{t(h)}</th>)}</tr></thead>
                <tbody>{cur.rows.map((x, i) => (
                  <tr key={i} className="border-t border-slate-100">{cur.cols.map(([h, fn]) => { const v = fn(x); return <td key={h} className="px-2 py-1.5">{typeof v === 'number' ? <Amt v={v} /> : v}</td>; })}</tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {view === 'notInBooks' && cur.rows.length > 0 && <p className="mt-2 text-xs text-slate-500">{t('Suppliers filed these bills but they are not in your purchases — enter them (with the supplier bill number) to claim the credit.')}</p>}
        </Card>
      )}
    </div>
  );
}

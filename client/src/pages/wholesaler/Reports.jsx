import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3, Download, Printer, TrendingUp, Truck, Package, BookOpen,
  Receipt, Wallet, RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import { downloadText } from '@/lib/download';
import { formatMoney } from '@/lib/format';
import {
  PageHeader, Card, Button, Chips, Input, Select, Spinner, EmptyState, Badge, useToast,
} from '@/components/ui';
import { t } from '@/lib/i18n';

const TABS = [
  { value: 'sale', label: 'Sale', icon: TrendingUp },
  { value: 'purchase', label: 'Purchase', icon: Truck },
  { value: 'stock', label: 'Stock', icon: Package },
  { value: 'outstanding', label: 'Udhaar', icon: BookOpen },
  { value: 'gst', label: 'GST', icon: Receipt },
  { value: 'payment', label: 'Payment', icon: Wallet },
];

const GROUP_OPTIONS = {
  sale: [
    { value: 'day', label: 'Din ke hisaab se' },
    { value: 'item', label: 'Item ke hisaab se' },
    { value: 'party', label: 'Retailer ke hisaab se' },
  ],
  purchase: [
    { value: 'day', label: 'Din ke hisaab se' },
    { value: 'supplier', label: 'Supplier ke hisaab se' },
    { value: 'item', label: 'Item ke hisaab se' },
  ],
};

const STOCK_FILTERS = [
  { value: 'all', label: 'Sab' },
  { value: 'low', label: 'Kam bacha' },
  { value: 'out', label: 'Khatam' },
  { value: 'dead', label: 'Pada hua' },
];

const STATUS_TONE = {
  'Theek hai': 'green', 'Kam bacha': 'amber', Khatam: 'red', 'Pada hua': 'slate',
};

const firstOfMonth = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

/** Number wale column right, naam/status wale left — nazar me saaf lagta hai */
const isNum = (col, i) => i !== 0 && !col.text && col.key !== 'status';

export default function Reports() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('tab') || 'sale');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [groupBy, setGroupBy] = useState('day');
  const [stockFilter, setStockFilter] = useState(searchParams.get('filter') || 'all');
  const [partyType, setPartyType] = useState('retailer');

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const needsDates = !['stock', 'outstanding'].includes(tab);

  const params = useMemo(() => {
    const p = {};
    if (needsDates) { p.from = from; p.to = to; }
    if (GROUP_OPTIONS[tab]) p.groupBy = groupBy;
    if (tab === 'stock') p.filter = stockFilter;
    if (tab === 'outstanding') p.type = partyType;
    return p;
  }, [tab, from, to, groupBy, stockFilter, partyType, needsDates]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/${tab}`, { params });
      setReport(res.data);
    } catch (err) {
      toast.error(err.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, params]);

  useEffect(() => { load(); }, [load]);

  // Tab badalne par groupBy wapas 'day' pe.
  // `setReport(null)` zaroori hai — warna nayi report aane tak PURANI report
  // naye tab ke saath render hoti rehti hai (GST card purane report ka meta
  // padh kar crash kar deta tha).
  useEffect(() => {
    setReport(null);
    setLoading(true);
    setGroupBy(GROUP_OPTIONS[tab] ? GROUP_OPTIONS[tab][0].value : 'day');
    setSearchParams(tab === 'sale' ? {} : { tab }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function download() {
    setDownloading(true);
    try {
      // CSV server se hi banti hai — table me jo dikh raha hai wahi file me jata hai
      const text = await api.get(`/reports/${tab}/csv`, { params, responseType: 'text' });
      // Server BOM laga chuka hai, downloadText dobara lagata hai — ek hata do
      const clean = String(text ?? '').replace(/^﻿/, '');
      downloadText(`${tab}-report-${todayStr()}.csv`, clean);
      toast.success('CSV download ho gayi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const cell = (row, col) => {
    const v = row[col.key];
    if (col.money) return formatMoney(v || 0);
    if (col.key === 'status') return <Badge tone={STATUS_TONE[v] || 'slate'}>{v}</Badge>;
    if (v === undefined || v === null || v === '') return '—';
    return typeof v === 'number' ? v.toLocaleString('en-IN') : v;
  };

  return (
    <>
      <PageHeader
        title={t('Reports')}
        subtitle={t('Mahine ka hisaab, CA ko dene layak')}
        action={
          <>
            <Button variant="secondary" icon={Printer} onClick={() => window.print()}>{t('Print')}</Button>
            <Button icon={Download} loading={downloading} onClick={download}
              disabled={!report?.rows?.length}>
              CSV
            </Button>
          </>
        }
      />

      {/* ---- Tabs ---- */}
      <div className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((tb) => (
          <button key={tb.value} onClick={() => setTab(tb.value)}
            className={`relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors focus-ring ${
              tab === tb.value ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800'}`}>
            <tb.icon size={15} /> {t(tb.label)}
            {tab === tb.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </button>
        ))}
      </div>

      {/* ---- Filters ---- */}
      <Card className="no-print mb-5" padding={false}>
        <div className="flex flex-wrap items-end gap-3 p-4">
          {needsDates && (
            <>
              <div className="w-36">
                <Input label={t('Kab se')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="w-36">
                <Input label={t('Kab tak')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="flex gap-1.5 pb-0.5">
                <QuickRange label={t('Aaj')} onPick={() => { setFrom(todayStr()); setTo(todayStr()); }} />
                <QuickRange label={t('Is mahine')} onPick={() => { setFrom(firstOfMonth()); setTo(todayStr()); }} />
                <QuickRange label={t('30 din')} onPick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 29);
                  setFrom(d.toISOString().slice(0, 10)); setTo(todayStr());
                }} />
              </div>
            </>
          )}

          {GROUP_OPTIONS[tab] && (
            <div className="w-52">
              <Select label={t('Kaise dekhein')} value={groupBy} placeholder=""
                onChange={(e) => setGroupBy(e.target.value)} options={GROUP_OPTIONS[tab]} />
            </div>
          )}

          {tab === 'stock' && (
            <Chips value={stockFilter} onChange={setStockFilter}
              options={STOCK_FILTERS.map((f) => ({
                ...f,
                label: report?.meta?.counts && f.value !== 'all'
                  ? `${f.label} (${report.meta.counts[f.value] ?? 0})` : f.label,
              }))} />
          )}

          {tab === 'outstanding' && (
            <Chips value={partyType} onChange={setPartyType}
              options={[
                { value: 'retailer', label: t('Retailers se lena') },
                { value: 'supplier', label: t('Suppliers ko dena') },
              ]} />
          )}
        </div>
      </Card>

      {/* ---- GST ka alag summary ---- */}
      {tab === 'gst' && report?.meta?.split && <GstSummary meta={report.meta} />}

      {/* ---- Table ---- */}
      <Card padding={false} className="report-sheet">
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400"><Spinner size={24} /></div>
        ) : !report?.rows?.length ? (
          <EmptyState
            icon={BarChart3}
            title={t('Is duration me kuch nahi mila')}
            message={tab === 'gst'
              ? 'GST wale bill is duration me nahi bane. Settings me GST on hai?'
              : 'Date range badal kar dekhein.'}
          />
        ) : (
          <>
          {/* Badi screen — poori table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {report.columns.map((c, i) => (
                    <th key={c.key}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                        isNum(c, i) ? 'text-right' : 'text-left'}`}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, ri) => (
                  <tr key={r._id || r.label || ri} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    {report.columns.map((c, i) => (
                      <td key={c.key}
                        className={`px-4 py-3 ${i === 0
                          ? 'font-medium text-slate-900'
                          : isNum(c, i) ? 'tabular text-right text-slate-700' : 'text-slate-700'}`}>
                        {i === 0 && r.overLimit
                          ? <span className="flex items-center gap-2">{cell(r, c)}<Badge tone="red">{t('Limit paar')}</Badge></span>
                          : cell(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                  {report.columns.map((c, i) => (
                    <td key={c.key}
                      className={`px-4 py-3 text-slate-900 ${
                        i === 0 ? 'text-left' : isNum(c, i) ? 'tabular text-right' : 'text-left'}`}>
                      {i === 0 ? (report.totals.label || 'KUL') : (
                        report.totals[c.key] === undefined ? ''
                          : c.money ? formatMoney(report.totals[c.key])
                            : report.totals[c.key].toLocaleString('en-IN')
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {/*
            PHONE WALI REPORT.

            Report ke column har report me alag hote hain (server bhejta hai),
            isliye yahan bhi wahi columns istemaal karke har row ka ek card
            bana dete hain: pehla column upar naam ki tarah, baaki "naam:
            ginti" jodi banke neeche. Sabse aakhir me KUL wali patti.

            Pehle ye 640px ki table thi — phone pe aakhri do column, jinme
            asli ginti hoti hai, dikhte hi nahi the.
          */}
          <div className="divide-y divide-slate-100 md:hidden">
            {report.rows.map((r, ri) => (
              <div key={r._id || r.label || ri} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{cell(r, report.columns[0])}</span>
                  {r.overLimit && <Badge tone="red">{t('Limit paar')}</Badge>}
                </div>
                <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {report.columns.slice(1).map((c, i) => (
                    <div key={c.key} className="flex gap-1.5">
                      <dt className="text-slate-400">{c.header}</dt>
                      <dd className={isNum(c, i + 1) ? 'tabular font-medium text-slate-700' : 'text-slate-700'}>
                        {cell(r, c)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}

            <div className="bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {report.totals.label || 'KUL'}
              </p>
              <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {report.columns.slice(1).map((c) => (
                  report.totals[c.key] === undefined ? null : (
                    <div key={c.key} className="flex gap-1.5">
                      <dt className="text-slate-400">{c.header}</dt>
                      <dd className="tabular font-semibold text-slate-900">
                        {c.money ? formatMoney(report.totals[c.key])
                          : report.totals[c.key].toLocaleString('en-IN')}
                      </dd>
                    </div>
                  )
                ))}
              </dl>
            </div>
          </div>
          </>
        )}
      </Card>

      {report?.meta?.deadAfterDays && (
        <p className="mt-3 text-xs text-slate-400">
          "Pada hua" = {report.meta.deadAfterDays} din se ek bhi nahi bika, par stock pada hai.
        </p>
      )}
    </>
  );
}

function QuickRange({ label, onPick }) {
  return (
    <button type="button" onClick={onPick}
      className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 focus-ring">
      {label}
    </button>
  );
}

function GstSummary({ meta }) {
  const box = (label, value, sub, tone = 'slate') => (
    <div className={`rounded-lg border p-3 ${
      tone === 'red' ? 'border-red-200 bg-red-50/50'
        : tone === 'green' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="tabular mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );

  return (
    <Card className="mb-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {box('B2B (GSTIN wale)', formatMoney(meta.split.b2b.total), `${meta.split.b2b.bills} bill`)}
        {box('B2C (bina GSTIN)', formatMoney(meta.split.b2c.total), `${meta.split.b2c.bills} bill`)}
        {box('Sale pe GST liya', formatMoney(meta.outputTax), 'Output tax')}
        {box('Kharid pe GST diya', formatMoney(meta.inputTax), `${meta.purchaseBills} purchase`, 'green')}
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">
          Sarkar ko dena banta hai (mota-moti)
          <span className={`tabular ml-2 text-lg font-semibold ${
            meta.netPayable > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {formatMoney(Math.abs(meta.netPayable))}
          </span>
          {meta.netPayable < 0 && <span className="ml-1 text-xs text-emerald-700">{t('(credit bacha hai)')}</span>}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {t('Ye sirf andaza hai — asli return CA hi bharega. Yahan se CSV nikaal kar de dijiye.')}
        </p>
      </div>
    </Card>
  );
}

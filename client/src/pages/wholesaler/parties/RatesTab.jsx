import { useCallback, useEffect, useState } from 'react';
import { Percent, RotateCcw, Tag, Info } from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMoney } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Select, Badge, Table, SearchInput,
  Pagination, Modal, EmptyState, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const sourceLabel = {
  custom: { label: 'Khaas rate', tone: 'brand' },
  wholesale: { label: 'Wholesale', tone: 'slate' },
  sale: { label: 'Sale price', tone: 'amber' },
};

export default function RatesTab({ partyId, partyName, onRatesChanged }) {
  const toast = useToast();

  const [data, setData] = useState({ rows: [], customCount: 0 });
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [categoryId, setCategoryId] = useState('');
  const [onlyCustom, setOnlyCustom] = useState('false');
  const [page, setPage] = useState(1);

  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/parties/${partyId}/rates`, {
        params: { q: debouncedQ, categoryId, onlyCustom, page, limit: 25 },
      });
      setData(res.data);
      setMeta(res.meta);
      setDrafts({});
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, debouncedQ, categoryId, onlyCustom, page]);

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.categories)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedQ, categoryId, onlyCustom]);

  async function saveRate(row, value) {
    const raw = String(value).trim();
    const rate = raw === '' ? null : Number(raw);
    if (rate !== null && (Number.isNaN(rate) || rate < 0)) {
      toast.error('Rate sahi number hona chahiye');
      return;
    }
    if (rate === row.customRate) return;

    setSavingId(row._id);
    try {
      const res = await api.put(`/parties/${partyId}/rates/${row._id}`, { rate });
      toast.success(res.message);
      await load();
      onRatesChanged?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  }

  const columns = [
    {
      key: 'name',
      header: t('Item'),
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-500">{[r.sku, r.category].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ),
    },
    { key: 'purchasePrice', header: t('Purchase'), align: 'right', render: (r) => formatMoney(r.purchasePrice) },
    {
      key: 'wholesalePrice',
      header: t('Wholesale'),
      align: 'right',
      render: (r) => (r.wholesalePrice
        ? formatMoney(r.wholesalePrice)
        : <span className="text-slate-400">—</span>),
    },
    {
      key: 'customRate',
      header: `${partyName} ka rate`,
      align: 'right',
      width: 170,
      // Phone pe ye bharne wala dabba apni poori line leta hai — chhoti jodi
      // ke beech me ghusa hua input dabana mushkil hota hai
      mobile: 'block',
      render: (r) => (
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          disabled={savingId === r._id}
          placeholder={r.wholesalePrice ? String(r.wholesalePrice) : '—'}
          value={drafts[r._id] ?? (r.customRate ?? '')}
          onChange={(e) => setDrafts((d) => ({ ...d, [r._id]: e.target.value }))}
          onBlur={(e) => saveRate(r, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          aria-label={`${r.name} ka rate`}
          className={cn(
            // Phone pe poori chaudai aur 44px uncha (ungli ke liye),
            // badi screen pe pehle jaisa chhota dabba
            'tabular h-11 w-full rounded-lg border px-2 text-right text-sm focus-ring md:h-9 md:w-32',
            r.customRate !== null ? 'border-brand-400 bg-brand-50 font-medium' : 'border-slate-300'
          )}
        />
      ),
    },
    {
      key: 'source',
      header: t('Lagega'),
      align: 'right',
      // Jo rate asal me lagega — phone pe wahi sabse pehle dikhna chahiye
      mobile: 'badge',
      render: (r) => (
        <div className="flex flex-col items-end gap-1">
          <span className="tabular font-medium text-slate-900">{formatMoney(r.rate)}</span>
          <Badge tone={sourceLabel[r.source].tone}>{sourceLabel[r.source].label}</Badge>
        </div>
      ),
    },
    {
      key: 'margin',
      header: t('Fayda'),
      align: 'right',
      render: (r) => (r.margin === null
        ? <span className="text-slate-400">—</span>
        : <span className={cn('tabular', r.margin >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            {formatMoney(r.margin)}
          </span>),
    },
  ];

  return (
    <>
      <Card className="mb-5">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-brand-600" />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-900">{t('Rate lagne ka order')}</p>
            <p className="mt-1">
              1. Yahan set kiya hua <strong>{t('khaas rate')}</strong> · 2. Item ka <strong>{t('wholesale price')}</strong> ·
              3. <strong>{t('Sale price')}</strong>
            </p>
            <p className="mt-1 text-slate-500">
              Box khali chhod dein to wholesale price hi lagega. {data.customCount > 0 && (
                <span className="text-brand-700">Abhi {data.customCount} item pe khaas rate laga hai.</span>
              )}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mb-5" padding={false}>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <SearchInput value={q} onChange={setQ} placeholder={t('Item dhundhein...')}
            className="w-full sm:w-56" />
          <div className="w-40">
            <Select placeholder={t('Sab categories')} value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: 'none', label: t('Bina category') },
                ...categories.map((c) => ({ value: c._id, label: c.name })),
              ]} />
          </div>
          <div className="w-48">
            <Select placeholder="" value={onlyCustom} onChange={(e) => setOnlyCustom(e.target.value)}
              options={[
                { value: 'false', label: t('Saare items') },
                { value: 'true', label: t('Sirf khaas rate wale') },
              ]} />
          </div>
          <div className="flex-1" />
          <Button variant="secondary" icon={Percent} onClick={() => setBulkOpen(true)}>
            {t('Sab pe ek saath')}
          </Button>
        </div>
      </Card>

      <Card padding={false}>
        {!loading && !data.rows.length ? (
          <EmptyState
            icon={Tag}
            title={onlyCustom === 'true' ? 'Koi khaas rate set nahi hai' : 'Koi item nahi mila'}
            message={onlyCustom === 'true'
              ? 'Kisi item ke saamne rate daal dein, wo yahan dikhega.'
              : 'Pehle Items page se maal add karein.'}
          />
        ) : (
          <>
            <Table columns={columns} rows={data.rows} loading={loading} className="min-w-full" />
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total}
              limit={meta.limit} onChange={setPage} />
          </>
        )}
      </Card>

      <BulkRateModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        partyId={partyId}
        partyName={partyName}
        categories={categories}
        onDone={() => { load(); onRatesChanged?.(); }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ bulk */

function BulkRateModal({ open, onClose, partyId, partyName, categories, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState('percentOffWholesale');
  const [value, setValue] = useState('5');
  const [categoryId, setCategoryId] = useState('');
  const [roundTo, setRoundTo] = useState('none');
  const [busy, setBusy] = useState(false);

  const isClear = mode === 'clear';

  async function apply() {
    setBusy(true);
    try {
      const res = await api.post(`/parties/${partyId}/rates/bulk`, {
        mode, value: Number(value || 0), categoryId: categoryId || null, roundTo,
      });
      toast.success(res.message);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('Sab items pe ek saath rate')}
      description={partyName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={apply} loading={busy} variant={isClear ? 'danger' : 'primary'}>
            {isClear ? 'Khaas rate hatayein' : 'Rate lagayein'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label={t('Kya karna hai')}
          placeholder=""
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          options={[
            { value: 'percentOffWholesale', label: t('Wholesale price se % kam') },
            { value: 'percentOffSale', label: t('Sale price se % kam') },
            { value: 'percentOnPurchase', label: t('Purchase price pe % jyada') },
            { value: 'clear', label: t('Khaas rate hata do') },
          ]}
        />

        {!isClear && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={mode === 'percentOnPurchase' ? 'Kitne % jyada' : 'Kitne % kam'}
              type="number" step="0.5" suffix="%"
              value={value} onChange={(e) => setValue(e.target.value)}
            />
            <Select label={t('Rate round karein')} placeholder="" value={roundTo}
              onChange={(e) => setRoundTo(e.target.value)}
              options={[
                { value: 'none', label: t('Nahi (paise ke saath)') },
                { value: '0.5', label: t('Aadhe rupee me') },
                { value: '1', label: t('Poore rupee me') },
                { value: '5', label: t('5 ke multiple me') },
                { value: '10', label: t('10 ke multiple me') },
              ]} />
          </div>
        )}

        <Select
          label={t('Kaunse items pe')}
          placeholder={t('Saare items')}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[
            { value: 'none', label: t('Bina category wale') },
            ...categories.map((c) => ({ value: c._id, label: c.name })),
          ]}
        />

        <div className={cn(
          'rounded-lg px-3 py-2.5 text-sm',
          isClear ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-600'
        )}>
          {isClear ? (
            <>{t('Chune hue items ka khaas rate hat jayega — un par wapas wholesale price lagega.')}</>
          ) : mode === 'percentOnPurchase' ? (
            <>Misal: purchase ₹100 aur {value || 0}% jyada → rate <strong>₹{(100 * (1 + Number(value || 0) / 100)).toFixed(2)}</strong></>
          ) : (
            <>Misal: {mode === 'percentOffSale' ? 'sale' : 'wholesale'} ₹100 aur {value || 0}% kam → rate <strong>₹{(100 * (1 - Number(value || 0) / 100)).toFixed(2)}</strong></>
          )}
        </div>

        <p className="flex items-start gap-2 text-xs text-slate-500">
          <RotateCcw size={13} className="mt-0.5 shrink-0" />
          Baad me kisi bhi item ka rate haath se badal sakte hain, ya "Khaas rate hata do" se sab reset kar sakte hain.
        </p>
      </div>
    </Modal>
  );
}

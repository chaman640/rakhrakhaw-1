import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Info, Undo2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty } from '@/lib/format';
import {
  Card, CardHeader, Button, Input, Select, Textarea, Spinner,
  Combobox, Badge, useToast,
} from '@/components/ui';

const emptyRow = () => ({
  key: Math.random().toString(36).slice(2),
  itemId: '', name: '', unit: 'PCS', qty: '1', rate: '', discount: '',
  gstRate: 0, hsn: '', reason: '', maxQty: null,
});

const TYPES = [
  { value: 'SALE_RETURN', label: 'Retailer ne wapas kiya', note: 'Credit Note', party: 'retailer' },
  { value: 'PURCHASE_RETURN', label: 'Supplier ko wapas bheja', note: 'Debit Note', party: 'supplier' },
];

const REASONS = [
  'Maal kharab nikla',
  'Galat item chala gaya',
  'Quantity zyada thi',
  'Retailer ko chahiye nahi tha',
  'Size / model match nahi hua',
];

export default function ReturnForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { gstEnabled, business } = useAuth();
  const [params] = useSearchParams();

  // ?type=SALE_RETURN&doc=<invoiceId>  — bill/purchase se seedha aane par
  const presetType = params.get('type');
  const docId = params.get('doc');

  // URL me galat ?type= aa jaye (purana bookmark, typo) to bhi page khulna chahiye —
  // warna cfg undefined ho jata hai aur poora page blank ho jata hai
  const [type, setType] = useState(
    TYPES.some((t) => t.value === presetType) ? presetType : 'SALE_RETURN'
  );
  const [party, setParty] = useState(null);
  const [partyState, setPartyState] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([emptyRow()]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [against, setAgainst] = useState(null);   // { id, no, date }
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(docId));

  const cfg = TYPES.find((t) => t.value === type) || TYPES[0];
  const isSale = type === 'SALE_RETURN';

  // ---- Bill/purchase se prefill ----
  useEffect(() => {
    if (!docId) return;
    api.get(`/returns/prefill/${presetType || 'SALE_RETURN'}/${docId}`)
      .then((r) => {
        const d = r.data;
        setType(d.type);
        setParty({ value: String(d.partyId), label: d.party?.shopName || d.party?.name });
        setPartyState(d.party?.address?.stateCode || '');
        setAgainst({
          id: d.invoiceId || d.purchaseId, no: d.againstNo, date: d.againstDate,
          field: d.invoiceId ? 'invoiceId' : 'purchaseId',
        });
        const usable = d.items.filter((i) => i.qty > 0);
        setRows((usable.length ? usable : d.items).map((i) => ({
          key: Math.random().toString(36).slice(2),
          itemId: i.itemId, name: i.name, unit: i.unit,
          qty: String(i.qty), rate: String(i.rate), discount: '',
          gstRate: i.gstRate, hsn: i.hsn, reason: '',
          maxQty: i.qty, soldQty: i.soldQty, returnedQty: i.returnedQty,
        })));
        if (d.fullyReturned) {
          toast.error('Is bill ka poora maal pehle hi wapas ho chuka hai');
        }
      })
      .catch((err) => { toast.error(err.message); navigate('/returns', { replace: true }); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const fetchParties = useCallback(async (q) => {
    const res = await api.get('/parties', {
      params: { type: cfg.party, ...(isSale ? { status: 'active' } : {}), q, limit: 20 },
    });
    return res.data.map((p) => ({
      value: p._id, label: p.shopName || p.name, sublabel: p.phone,
      right: p.balance > 0 ? formatMoney(p.balance) : '',
      raw: p,
    }));
  }, [cfg.party, isSale]);

  const fetchItems = useCallback(async (q) => {
    const res = await api.get('/items', { params: { q, limit: 20 } });
    return res.data.map((i) => ({
      value: i._id, label: i.name,
      sublabel: [i.brand, i.sku].filter(Boolean).join(' · '),
      right: formatQty(i.stockQty, i.unit),
      raw: i,
    }));
  }, []);

  function setRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function pickItem(key, opt) {
    const i = opt.raw;
    setRow(key, {
      itemId: i._id, name: i.name, unit: i.unit,
      rate: String(i.wholesalePrice || i.salePrice || 0),
      gstRate: i.gstRate || 0, hsn: i.hsn || '',
      stockQty: i.stockQty,
      qty: rows.find((r) => r.key === key)?.qty || '1',
    });
  }

  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (key) => setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((r) => r.key !== key)));

  // Type badla to party aur bill ka link hata do — warna galat party pe return ban jayega
  function changeType(next) {
    setType(next);
    setParty(null); setPartyState(''); setAgainst(null);
    setRows([emptyRow()]);
  }

  const isIgst = gstEnabled && partyState && business?.address?.stateCode
    && partyState !== business.address.stateCode;

  // ---- Live totals (server pe bilkul yahi hisaab hota hai) ----
  const totals = useMemo(() => {
    let taxable = 0, tax = 0;
    for (const r of rows) {
      if (!r.itemId) continue;
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const disc = Number(r.discount || 0);
      const value = Math.max(0, qty * rate - disc);
      taxable += value;
      if (gstEnabled) tax += (value * Number(r.gstRate || 0)) / 100;
    }
    const before = taxable + tax;
    const grand = Math.round(before);
    return {
      taxable: Math.round(taxable * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      roundOff: Math.round((grand - before) * 100) / 100,
      grandTotal: grand,
    };
  }, [rows, gstEnabled]);

  const filled = rows.filter((r) => r.itemId && Number(r.qty) > 0);

  async function save() {
    if (!party?.value) return toast.error('Pehle party chunein');
    if (!filled.length) return toast.error('Kam se kam ek item daalein');

    const tooMuch = filled.find((r) => r.maxQty != null && Number(r.qty) > r.maxQty);
    if (tooMuch) {
      return toast.error(`${tooMuch.name}: sirf ${tooMuch.maxQty} ${tooMuch.unit} wapas ho sakta hai`);
    }

    setSaving(true);
    try {
      const res = await api.post('/returns', {
        type,
        partyId: party.value,
        ...(against ? { [against.field]: against.id } : {}),
        returnDate: date,
        reason: reason.trim(),
        notes: notes.trim(),
        items: filled.map((r) => ({
          itemId: r.itemId,
          qty: Number(r.qty),
          rate: Number(r.rate || 0),
          discount: Number(r.discount || 0),
          gstRate: Number(r.gstRate || 0),
          reason: r.reason.trim(),
        })),
      });
      toast.success(res.message);
      navigate(`/returns/${res.data._id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }

  return (
    <>
      <button onClick={() => navigate('/returns')}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Saare returns
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Naya return</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSale
              ? 'Maal wapas aayega — stock badhega aur retailer ka udhaar kam hoga'
              : 'Maal wapas jayega — stock ghatega aur supplier ko dena kam hoga'}
          </p>
        </div>
        <Badge tone={isSale ? 'amber' : 'blue'}>{cfg.note}</Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ---- Kaunsa return ---- */}
          <Card>
            <CardHeader title="Kya hua" />
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => changeType(t.value)}
                  aria-pressed={type === t.value}
                  disabled={Boolean(docId)}
                  className={`rounded-lg border p-3 text-left transition-colors focus-ring disabled:opacity-60 ${
                    type === t.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:bg-slate-50'}`}>
                  <p className="text-sm font-medium text-slate-900">{t.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t.note} banega</p>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Combobox
                label={isSale ? 'Kis retailer se' : 'Kis supplier ko'}
                required
                value={party?.value}
                display={party?.label}
                onChange={(opt) => { setParty(opt); setPartyState(opt.raw?.address?.stateCode || ''); }}
                fetchOptions={fetchParties}
                placeholder="Naam ya phone se dhoondhein"
                disabled={Boolean(against)}
              />
              <Input label="Kab" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {against && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <Info size={14} className="shrink-0 text-slate-400" />
                <span><strong>{against.no}</strong> ka maal wapas ho raha hai</span>
              </p>
            )}
          </Card>

          {/* ---- Items ---- */}
          <Card padding={false}>
            <CardHeader className="p-5 pb-0" title="Kaunsa maal wapas"
              action={<Button size="sm" variant="secondary" icon={Plus} onClick={addRow}>Item</Button>} />

            <div className="mt-2 divide-y divide-slate-100">
              {rows.map((r, i) => (
                <div key={r.key} className="p-4">
                  <div className="grid gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-5">
                      <Combobox
                        label={i === 0 ? 'Item' : undefined}
                        value={r.itemId}
                        display={r.name}
                        onChange={(opt) => pickItem(r.key, opt)}
                        fetchOptions={fetchItems}
                        placeholder="Item dhoondhein"
                        disabled={Boolean(r.maxQty != null)}
                      />
                      {r.maxQty != null && (
                        <p className="mt-1 text-xs text-slate-400">
                          Bill me {formatQty(r.soldQty, r.unit)}
                          {r.returnedQty > 0 && ` · ${formatQty(r.returnedQty, r.unit)} pehle wapas`}
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <Input label={i === 0 ? 'Qty' : undefined} type="number" step="0.01" min="0"
                        suffix={r.unit} value={r.qty}
                        onChange={(e) => setRow(r.key, { qty: e.target.value })}
                        error={r.maxQty != null && Number(r.qty) > r.maxQty ? `Max ${r.maxQty}` : undefined} />
                    </div>

                    <div className="sm:col-span-2">
                      <Input label={i === 0 ? 'Rate' : undefined} type="number" step="0.01" min="0" prefix="₹"
                        value={r.rate} onChange={(e) => setRow(r.key, { rate: e.target.value })} />
                    </div>

                    <div className="sm:col-span-2">
                      <Input label={i === 0 ? 'Discount' : undefined} type="number" step="0.01" min="0" prefix="₹"
                        value={r.discount} onChange={(e) => setRow(r.key, { discount: e.target.value })} />
                    </div>

                    <div className="flex items-end justify-end sm:col-span-1">
                      <button type="button" onClick={() => removeRow(r.key)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-ring"
                        aria-label={`${r.name || 'Row'} hatayein`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {r.itemId && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input placeholder="Is item ka karan (marzi se)" value={r.reason}
                        onChange={(e) => setRow(r.key, { reason: e.target.value })}
                        containerClassName="max-w-xs" />
                      <span className="tabular ml-auto text-sm font-medium text-slate-900">
                        {formatMoney(Math.max(0, Number(r.qty || 0) * Number(r.rate || 0) - Number(r.discount || 0)))}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Karan" subtitle="Note pe chhapega — baad me yaad rehta hai ki kyun wapas hua" />
            <div className="flex flex-wrap gap-2">
              {REASONS.map((rr) => (
                <button key={rr} type="button" onClick={() => setReason(rr)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-ring ${
                    reason === rr ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {rr}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-3">
              <Input label="Ya khud likhein" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Jaise: 2 piece me awaaz aa rahi thi" />
              <Textarea label="Note (marzi se)" rows={2} value={notes}
                onChange={(e) => setNotes(e.target.value)} />
            </div>
          </Card>
        </div>

        {/* ---- Summary ---- */}
        <div>
          <Card className="lg:sticky lg:top-4">
            <CardHeader title="Hisaab" />
            <dl className="space-y-2.5 text-sm">
              <Row label="Item" value={String(filled.length)} />
              <Row label="Taxable" value={formatMoney(totals.taxable)} />
              {gstEnabled && (
                <Row label={isIgst ? 'IGST' : 'CGST + SGST'} value={formatMoney(totals.tax)} />
              )}
              {totals.roundOff !== 0 && <Row label="Round off" value={formatMoney(totals.roundOff)} />}
              <div className="border-t border-slate-200 pt-2.5">
                <Row label={cfg.note} value={formatMoney(totals.grandTotal)} tone="big" />
              </div>
            </dl>

            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {isSale
                ? 'Save karte hi stock wapas badhega aur retailer ka udhaar itna kam ho jayega.'
                : 'Save karte hi stock ghatega aur supplier ko dena itna kam ho jayega.'}
            </p>

            <Button className="mt-4 w-full" size="lg" icon={Save} loading={saving} onClick={save}>
              {cfg.note} banayein
            </Button>
            <Button className="mt-2 w-full" variant="ghost" onClick={() => navigate('/returns')}>
              Rehne dein
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={tone === 'big' ? 'font-medium text-slate-900' : 'text-slate-500'}>{label}</dt>
      <dd className={tone === 'big'
        ? 'tabular text-lg font-semibold text-slate-900'
        : 'tabular font-medium text-slate-900'}>{value}</dd>
    </div>
  );
}

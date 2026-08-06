import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Package, Truck, Info } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, Button, Input, Textarea, Combobox,
  Switch, Badge, useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const emptyRow = () => ({ key: Math.random().toString(36).slice(2), itemId: '', name: '', unit: 'PCS',
  stockQty: 0, qty: '', rate: '', discount: '', gstRate: 0 });

export default function PurchaseForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { gstEnabled } = useAuth();
  const [params] = useSearchParams();

  const [supplier, setSupplier] = useState(null);
  const [billNo, setBillNo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([emptyRow()]);
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [updatePrice, setUpdatePrice] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');

  useEffect(() => {
    api.get('/purchases/next-number').then((r) => setPreview(r.data.preview)).catch(() => {});
    const sid = params.get('supplier');
    if (sid) {
      api.get(`/parties/${sid}`).then((r) =>
        setSupplier({ value: r.data._id, label: r.data.shopName || r.data.name })).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSuppliers = useCallback(async (q) => {
    const res = await api.get('/parties', { params: { type: 'supplier', q, limit: 20 } });
    return res.data.map((p) => ({
      value: p._id,
      label: p.shopName || p.name,
      sublabel: p.phone,
      right: p.balance > 0 ? formatMoney(p.balance) : '',
    }));
  }, []);

  const fetchItems = useCallback(async (q) => {
    const res = await api.get('/items', { params: { q, limit: 20 } });
    return res.data.map((i) => ({
      value: i._id,
      label: i.name,
      sublabel: [i.sku, i.category].filter(Boolean).join(' · '),
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
      itemId: i._id, name: i.name, unit: i.unit, stockQty: i.stockQty,
      rate: String(i.purchasePrice || ''), gstRate: i.gstRate || 0,
      qty: rows.find((r) => r.key === key)?.qty || '1',
    });
  }

  function addRow() { setRows((rs) => [...rs, emptyRow()]); }
  function removeRow(key) {
    setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((r) => r.key !== key)));
  }

  // ---- Live totals (server pe bhi yahi hisaab hota hai) ----
  const totals = useMemo(() => {
    let subTotal = 0, discountTotal = 0, taxableTotal = 0, taxTotal = 0;
    for (const r of rows) {
      if (!r.itemId) continue;
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const disc = Number(r.discount || 0);
      const gross = round2(qty * rate);
      const taxable = round2(gross - disc);
      const tax = gstEnabled ? round2((taxable * Number(r.gstRate || 0)) / 100) : 0;
      subTotal = round2(subTotal + gross);
      discountTotal = round2(discountTotal + disc);
      taxableTotal = round2(taxableTotal + taxable);
      taxTotal = round2(taxTotal + tax);
    }
    const before = round2(taxableTotal + taxTotal);
    const grandTotal = Math.round(before);
    return { subTotal, discountTotal, taxableTotal, taxTotal,
      roundOff: round2(grandTotal - before), grandTotal };
  }, [rows, gstEnabled]);

  const paid = Math.min(Number(paidAmount || 0), totals.grandTotal);
  const due = round2(totals.grandTotal - paid);
  const filledRows = rows.filter((r) => r.itemId && Number(r.qty) > 0);

  async function save() {
    if (!supplier) { toast.error('Pehle supplier chunein'); return; }
    if (!filledRows.length) { toast.error('Kam se kam ek item daalein'); return; }

    setSaving(true);
    try {
      const res = await api.post('/purchases', {
        supplierId: supplier.value,
        supplierBillNo: billNo,
        purchaseDate: date,
        items: filledRows.map((r) => ({
          itemId: r.itemId,
          qty: Number(r.qty),
          rate: Number(r.rate || 0),
          discount: Number(r.discount || 0),
          gstRate: gstEnabled ? Number(r.gstRate || 0) : 0,
        })),
        paidAmount: Number(paidAmount || 0),
        notes,
        updatePurchasePrice: updatePrice,
      });
      toast.success(res.message);
      navigate(`/purchases/${res.data._id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => navigate('/purchases')}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> Saari purchases
      </button>

      <PageHeader
        title="Nayi purchase"
        subtitle={preview ? `Number: ${preview}` : 'Supplier se aaya maal'}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* ---- Supplier + bill ---- */}
          <Card>
            <CardHeader title="Kisse aaya" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <Combobox
                  label="Supplier" required
                  placeholder="Supplier chunein"
                  display={supplier?.label}
                  value={supplier?.value}
                  onChange={setSupplier}
                  fetchOptions={fetchSuppliers}
                  emptyText="Koi supplier nahi mila"
                  onCreateNew={() => navigate('/suppliers')}
                  createNewLabel="Suppliers page pe jaayein"
                />
              </div>
              <Input label="Supplier ka bill number" value={billNo}
                onChange={(e) => setBillNo(e.target.value)} placeholder="ST/2026/119" />
              <Input label="Tareekh" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </Card>

          {/* ---- Items ---- */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Maal</h3>
                <p className="mt-0.5 text-sm text-slate-500">Jo item aaya hai, quantity aur rate ke saath</p>
              </div>
              <Button size="sm" variant="secondary" icon={Plus} onClick={addRow}>Row</Button>
            </div>

            <div className="overflow-x-auto border-t border-slate-200">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 text-left font-semibold">Item</th>
                    <th className="w-24 px-3 py-2.5 text-right font-semibold">Qty</th>
                    <th className="w-28 px-3 py-2.5 text-right font-semibold">Rate</th>
                    <th className="w-24 px-3 py-2.5 text-right font-semibold">Discount</th>
                    {gstEnabled && <th className="w-20 px-3 py-2.5 text-right font-semibold">GST</th>}
                    <th className="w-28 px-3 py-2.5 text-right font-semibold">Total</th>
                    <th className="w-10 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const qty = Number(r.qty || 0);
                    const rate = Number(r.rate || 0);
                    const taxable = round2(qty * rate - Number(r.discount || 0));
                    const tax = gstEnabled ? round2((taxable * Number(r.gstRate || 0)) / 100) : 0;
                    return (
                      <tr key={r.key} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2">
                          <Combobox
                            placeholder="Item dhundhein"
                            display={r.name}
                            value={r.itemId}
                            onChange={(opt) => pickItem(r.key, opt)}
                            fetchOptions={fetchItems}
                            emptyText="Koi item nahi mila"
                            onCreateNew={() => navigate('/items')}
                            createNewLabel="Items page pe jaayein"
                          />
                          {r.itemId && (
                            <p className="mt-1 text-xs text-slate-400">
                              Abhi stock: {formatQty(r.stockQty, r.unit)}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" inputMode="decimal"
                            aria-label={`Row ${idx + 1} quantity`}
                            value={r.qty} onChange={(e) => setRow(r.key, { qty: e.target.value })}
                            className="tabular h-10 w-full rounded-lg border border-slate-300 px-2 text-right focus-ring" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" inputMode="decimal"
                            aria-label={`Row ${idx + 1} rate`}
                            value={r.rate} onChange={(e) => setRow(r.key, { rate: e.target.value })}
                            className="tabular h-10 w-full rounded-lg border border-slate-300 px-2 text-right focus-ring" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" inputMode="decimal"
                            aria-label={`Row ${idx + 1} discount`}
                            value={r.discount} onChange={(e) => setRow(r.key, { discount: e.target.value })}
                            className="tabular h-10 w-full rounded-lg border border-slate-300 px-2 text-right focus-ring" />
                        </td>
                        {gstEnabled && (
                          <td className="px-3 py-2">
                            <input type="number" step="1" min="0" max="28" inputMode="decimal"
                              aria-label={`Row ${idx + 1} GST`}
                              value={r.gstRate} onChange={(e) => setRow(r.key, { gstRate: e.target.value })}
                              className="tabular h-10 w-full rounded-lg border border-slate-300 px-2 text-right focus-ring" />
                          </td>
                        )}
                        <td className="tabular px-3 py-2 text-right font-medium text-slate-900">
                          {r.itemId ? formatMoney(taxable + tax) : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeRow(r.key)}
                            aria-label={`Row ${idx + 1} hatayein`}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-5 py-3">
              <Button size="sm" variant="ghost" icon={Plus} onClick={addRow}>Aur item add karein</Button>
            </div>
          </Card>

          <Card>
            <Textarea label="Note" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Gaadi number / kis truck se aaya" />
          </Card>
        </div>

        {/* ---- Totals ---- */}
        <div className="space-y-5">
          <Card className="lg:sticky lg:top-20">
            <CardHeader title="Hisaab" />

            <dl className="space-y-2 text-sm">
              <Row label="Kul maal" value={formatMoney(totals.subTotal)} />
              {totals.discountTotal > 0 && (
                <Row label="Discount" value={`− ${formatMoney(totals.discountTotal)}`} tone="green" />
              )}
              {gstEnabled && <Row label="GST" value={formatMoney(totals.taxTotal)} />}
              {totals.roundOff !== 0 && (
                <Row label="Round off" value={formatMoney(totals.roundOff)} tone="muted" />
              )}
              <div className="!mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">Kul dena</dt>
                <dd className="tabular text-xl font-semibold text-slate-900">{formatMoney(totals.grandTotal)}</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
              <Input label="Abhi kitna diya" type="number" step="0.01" min="0" prefix="₹"
                value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
                hint="Khali chhod do to poora udhaar" />

              <div className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm',
                due > 0 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900'
              )}>
                <span>{due > 0 ? 'Baaki dena hai' : 'Poora ho gaya'}</span>
                <strong className="tabular">{formatMoney(due)}</strong>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4">
              <Switch
                id="update-price"
                checked={updatePrice}
                onChange={setUpdatePrice}
                label="Purchase price update karein"
                description="Item ka purchase price is bill ke rate se badal jayega"
              />
            </div>

            <Button className="mt-5 w-full" size="lg" icon={Save} loading={saving} onClick={save}
              disabled={!supplier || !filledRows.length}>
              Save karein
            </Button>

            <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <Info size={13} className="mt-0.5 shrink-0" />
              Save karte hi {filledRows.length || 0} item ka stock badh jayega aur supplier ke khate me
              {' '}{formatMoney(totals.grandTotal)} chadh jayega.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('tabular',
        tone === 'green' ? 'text-emerald-700' : tone === 'muted' ? 'text-slate-400' : 'text-slate-900')}>
        {value}
      </dd>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Save, Info, FileText } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, formatQty } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, Button, Input, Textarea, Select,
  Combobox, LineItemCard, NumField, useToast,
} from '@/components/ui';
import PartyPicker from './PartyPicker';
import { bust } from '@/hooks/useQuery';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const emptyRow = () => ({ key: Math.random().toString(36).slice(2), itemId: '', name: '', unit: 'PCS',
  stockQty: 0, qty: '', rate: '', discount: '', gstRate: 0, hsn: '' });

export default function InvoiceForm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { gstEnabled, business } = useAuth();
  const [params] = useSearchParams();
  const orderId = params.get('order');

  const [party, setParty] = useState(null);
  const [partyState, setPartyState] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([emptyRow()]);
  const [extraDiscount, setExtraDiscount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(orderId));

  useEffect(() => {
    api.get('/invoices/next-number').then((r) => setPreview(r.data.preview)).catch(() => {});

    if (!orderId) return;
    api.get(`/invoices/from-order/${orderId}`)
      .then((r) => {
        const d = r.data;
        setParty({ value: d.partyId, label: d.party?.shopName || d.party?.name });
        setPartyState(d.party?.address?.stateCode || '');
        setOrderNo(d.orderNo);
        setRows(d.items.map((i) => ({
          key: Math.random().toString(36).slice(2),
          itemId: i.itemId, name: i.name, unit: i.unit, stockQty: i.stockQty,
          qty: String(i.qty), rate: String(i.rate), discount: '',
          gstRate: i.gstRate, hsn: i.hsn,
        })));
      })
      .catch((err) => { toast.error(err.message); navigate('/orders', { replace: true }); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchItems = useCallback(async (q) => {
    const res = await api.get('/items', { params: { q, limit: 20 } });
    return res.data.map((i) => ({
      value: i._id, label: i.name,
      sublabel: [i.sku, i.category].filter(Boolean).join(' · '),
      right: formatQty(i.stockQty, i.unit),
      raw: i,
    }));
  }, []);

  async function pickParty(opt) {
    setParty(opt);
    if (!opt) { setPartyState(''); return; }
    setPartyState(opt.raw?.address?.stateCode || '');
    // Party badalne pe rate dobara resolve karo
    if (opt.value) {
      for (const r of rows.filter((x) => x.itemId)) {
        try {
          const res = await api.get(`/parties/${opt.value}/rates`, { params: { q: r.name, limit: 1 } });
          const found = res.data.rows?.find((x) => String(x._id) === String(r.itemId));
          if (found) setRow(r.key, { rate: String(found.rate) });
        } catch { /* chup-chaap */ }
      }
    }
  }

  function setRow(key, patch) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function pickItem(key, opt) {
    const i = opt.raw;
    let rate = i.wholesalePrice || i.salePrice || 0;
    if (party?.value) {
      try {
        const res = await api.get(`/parties/${party.value}/rates`, { params: { q: i.name, limit: 5 } });
        const found = res.data.rows?.find((x) => String(x._id) === String(i._id));
        if (found) rate = found.rate;
      } catch { /* chup-chaap */ }
    }
    setRow(key, {
      itemId: i._id, name: i.name, unit: i.unit, stockQty: i.stockQty,
      rate: String(rate), gstRate: i.gstRate || 0, hsn: i.hsn || '',
      qty: rows.find((r) => r.key === key)?.qty || '1',
    });
  }

  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (key) => setRows((rs) => (rs.length === 1 ? [emptyRow()] : rs.filter((r) => r.key !== key)));

  const isIgst = gstEnabled && partyState && business?.address?.stateCode
    && partyState !== business.address.stateCode;

  // ---- Live totals (server pe bhi bilkul yahi hisaab) ----
  const totals = useMemo(() => {
    let subTotal = 0, lineDisc = 0;
    const base = [];
    for (const r of rows) {
      if (!r.itemId) continue;
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      const disc = Number(r.discount || 0);
      const gross = round2(qty * rate);
      const taxable = round2(gross - disc);
      subTotal = round2(subTotal + gross);
      lineDisc = round2(lineDisc + disc);
      base.push({ taxable, gstRate: Number(r.gstRate || 0) });
    }
    const beforeExtra = round2(base.reduce((s, l) => s + l.taxable, 0));
    const extra = round2(Math.min(Math.max(Number(extraDiscount || 0), 0), beforeExtra));

    let taxableTotal = 0, tax = 0;
    for (const l of base) {
      const share = beforeExtra > 0 ? round2((l.taxable / beforeExtra) * extra) : 0;
      const tv = round2(l.taxable - share);
      taxableTotal = round2(taxableTotal + tv);
      if (gstEnabled) tax = round2(tax + round2((tv * l.gstRate) / 100));
    }

    const before = round2(taxableTotal + tax);
    const grandTotal = Math.round(before);
    return {
      subTotal, discountTotal: round2(lineDisc + extra), taxableTotal,
      taxTotal: tax, cgst: round2(tax / 2), sgst: round2(tax - round2(tax / 2)),
      roundOff: round2(grandTotal - before), grandTotal,
    };
  }, [rows, extraDiscount, gstEnabled]);

  const paid = Math.min(Number(paidAmount || 0), totals.grandTotal);
  const due = round2(totals.grandTotal - paid);
  const filled = rows.filter((r) => r.itemId && Number(r.qty) > 0);
  const shortRows = filled.filter((r) => Number(r.qty) > r.stockQty);

  async function save() {
    // `party?.value` — sirf `party` nahi. Ek baar aisa ho chuka hai ki party ka
    // naam to card me dikh raha tha par uski id andar aayi hi nahi thi; tab
    // request bina `partyId` ke chali gayi aur server ne "Retailer nahi mila"
    // bola — jo dekhne wale ko bilkul samajh nahi aata, kyunki retailer to
    // saamne likha hai.
    if (!party?.value) { toast.error('Pehle retailer chunein'); return; }
    if (!filled.length) { toast.error('Kam se kam ek item daalein'); return; }

    setSaving(true);
    try {
      const res = await api.post('/invoices', {
        partyId: party.value,
        orderId: orderId || null,
        invoiceDate: date,
        items: filled.map((r) => ({
          itemId: r.itemId, qty: Number(r.qty), rate: Number(r.rate || 0),
          discount: Number(r.discount || 0), gstRate: gstEnabled ? Number(r.gstRate || 0) : 0,
        })),
        extraDiscount: Number(extraDiscount || 0),
        paidAmount: Number(paidAmount || 0),
        paymentMode,
        notes,
      });
      toast.success(res.message);
      // Home, bill ki list, khata aur dashboard — sab isi bill se badle hain
      bust('invoices', 'khata', 'dashboard', 'parties', 'payments');
      navigate(`/invoices/${res.data._id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-20 text-center text-sm text-slate-400">{t('Order se detail aa rahi hai...')}</p>;

  return (
    <>
      <PageHeader
        title={t('Naya bill')}
        subtitle={[preview && `Number: ${preview}`, orderNo && `Order ${orderNo} ke against`]
          .filter(Boolean).join(' · ')}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title={t('Kiska bill')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <PartyPicker value={party} onChange={pickParty} disabled={Boolean(orderId)} />
              </div>
              <Input label={t('Tareekh')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {gstEnabled && party && (
              <p className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <Info size={14} className="shrink-0" />
                {isIgst
                  ? <>Retailer dusre state me hai — bill pe <strong>IGST</strong> lagega</>
                  : <>Same state — bill pe <strong>{t('CGST + SGST')}</strong> lagega</>}
              </p>
            )}
          </Card>

          <Card padding={false}>
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{t('Maal')}</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {t('Rate retailer ke hisaab se apne aap aata hai')}
                </p>
              </div>
              <Button size="sm" variant="secondary" icon={Plus} onClick={addRow}>{t('Row')}</Button>
            </div>

            {/* Badi screen — ek nazar me poori table */}
            <div className="hidden overflow-x-auto border-t border-slate-200 md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 text-left font-semibold">{t('Item')}</th>
                    <th className="w-24 px-3 py-2.5 text-right font-semibold">{t('Qty')}</th>
                    <th className="w-28 px-3 py-2.5 text-right font-semibold">{t('Rate')}</th>
                    <th className="w-24 px-3 py-2.5 text-right font-semibold">{t('Discount')}</th>
                    {gstEnabled && <th className="w-20 px-3 py-2.5 text-right font-semibold">GST</th>}
                    <th className="w-28 px-3 py-2.5 text-right font-semibold">{t('Total')}</th>
                    <th className="w-10 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const qty = Number(r.qty || 0);
                    const taxable = round2(qty * Number(r.rate || 0) - Number(r.discount || 0));
                    const tax = gstEnabled ? round2((taxable * Number(r.gstRate || 0)) / 100) : 0;
                    const short = r.itemId && qty > r.stockQty;
                    return (
                      <tr key={r.key} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2">
                          <Combobox
                            placeholder={t('Item dhundhein')} display={r.name} value={r.itemId}
                            onChange={(opt) => pickItem(r.key, opt)} fetchOptions={fetchItems}
                            emptyText={t('Koi item nahi mila')}
                          />
                          {r.itemId && (
                            <p className={cn('mt-1 text-xs', short ? 'font-medium text-red-600' : 'text-slate-400')}>
                              Stock: {formatQty(r.stockQty, r.unit)}
                              {short && ' — itna hai hi nahi'}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" inputMode="decimal"
                            aria-label={`Row ${idx + 1} quantity`} value={r.qty}
                            onChange={(e) => setRow(r.key, { qty: e.target.value })}
                            className={cn('tabular h-10 w-full rounded-lg border px-2 text-right focus-ring',
                              short ? 'border-red-400' : 'border-slate-300')} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" inputMode="decimal"
                            aria-label={`Row ${idx + 1} rate`} value={r.rate}
                            onChange={(e) => setRow(r.key, { rate: e.target.value })}
                            className="tabular h-10 w-full rounded-lg border border-slate-300 px-2 text-right focus-ring" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" min="0" inputMode="decimal"
                            aria-label={`Row ${idx + 1} discount`} value={r.discount}
                            onChange={(e) => setRow(r.key, { discount: e.target.value })}
                            className="tabular h-10 w-full rounded-lg border border-slate-300 px-2 text-right focus-ring" />
                        </td>
                        {gstEnabled && (
                          <td className="px-3 py-2">
                            <input type="number" step="1" min="0" max="28" inputMode="decimal"
                              aria-label={`Row ${idx + 1} GST`} value={r.gstRate}
                              onChange={(e) => setRow(r.key, { gstRate: e.target.value })}
                              className="tabular h-10 w-full rounded-lg border border-slate-300 px-2 text-right focus-ring" />
                          </td>
                        )}
                        <td className="tabular px-3 py-2 text-right font-medium text-slate-900">
                          {r.itemId ? formatMoney(taxable + tax) : '—'}
                        </td>
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => removeRow(r.key)}
                            aria-label={`Row ${idx + 1} hatayein`}
                            // h-9 w-9 = 36px. p-1.5 pe ye 28px ka tha aur tablet pe ungli se
                            // chookta tha (mobile-audit ne pakda)
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone — har item ka apna card, kahin khiskana nahi padta */}
            <div className="divide-y divide-slate-100 border-t border-slate-200 md:hidden">
              {rows.map((r, idx) => {
                const qty = Number(r.qty || 0);
                const taxable = round2(qty * Number(r.rate || 0) - Number(r.discount || 0));
                const tax = gstEnabled ? round2((taxable * Number(r.gstRate || 0)) / 100) : 0;
                const short = r.itemId && qty > r.stockQty;
                return (
                  <LineItemCard
                    key={r.key}
                    index={idx}
                    onRemove={() => removeRow(r.key)}
                    total={r.itemId ? formatMoney(taxable + tax) : '—'}
                    picker={(
                      <Combobox
                        placeholder={t('Item dhundhein')} display={r.name} value={r.itemId}
                        onChange={(opt) => pickItem(r.key, opt)} fetchOptions={fetchItems}
                        emptyText={t('Koi item nahi mila')}
                      />
                    )}
                    note={r.itemId && (
                      <p className={cn('mt-1.5 text-xs', short ? 'font-medium text-red-600' : 'text-slate-400')}>
                        Stock: {formatQty(r.stockQty, r.unit)}
                        {short && ' — itna hai hi nahi'}
                      </p>
                    )}
                  >
                    <NumField label={t('Qty')} srLabel={`Item ${idx + 1} quantity`} step="0.01" min="0"
                      invalid={short} value={r.qty}
                      onChange={(e) => setRow(r.key, { qty: e.target.value })} />
                    <NumField label={t('Rate')} srLabel={`Item ${idx + 1} rate`} step="0.01" min="0"
                      value={r.rate}
                      onChange={(e) => setRow(r.key, { rate: e.target.value })} />
                    <NumField label={t('Discount')} srLabel={`Item ${idx + 1} discount`} step="0.01" min="0"
                      value={r.discount}
                      onChange={(e) => setRow(r.key, { discount: e.target.value })} />
                    {gstEnabled && (
                      <NumField label={t('GST %')} srLabel={`Item ${idx + 1} GST`} step="1" min="0" max="28"
                        value={r.gstRate}
                        onChange={(e) => setRow(r.key, { gstRate: e.target.value })} />
                    )}
                  </LineItemCard>
                );
              })}
            </div>

            <div className="border-t border-slate-200 px-5 py-3">
              <Button size="sm" variant="ghost" icon={Plus} onClick={addRow}>{t('Aur item add karein')}</Button>
            </div>
          </Card>

          <Card>
            <Textarea label={t('Note (bill pe chhapega)')} rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} placeholder={t('Maal wapas nahi hoga')} />
          </Card>
        </div>

        <div>
          <Card className="lg:sticky lg:top-20">
            <CardHeader title={t('Hisaab')} />

            <dl className="space-y-2 text-sm">
              <Row label={t('Kul maal')} value={formatMoney(totals.subTotal)} />
              {totals.discountTotal > 0 && (
                <Row label={t('Discount')} value={`− ${formatMoney(totals.discountTotal)}`} tone="green" />
              )}
              {gstEnabled && <Row label={t('Taxable')} value={formatMoney(totals.taxableTotal)} />}
              {gstEnabled && totals.taxTotal > 0 && (isIgst
                ? <Row label="IGST" value={formatMoney(totals.taxTotal)} />
                : <>
                    <Row label="CGST" value={formatMoney(totals.cgst)} />
                    <Row label="SGST" value={formatMoney(totals.sgst)} />
                  </>)}
              {totals.roundOff !== 0 && <Row label={t('Round off')} value={formatMoney(totals.roundOff)} tone="muted" />}
              <div className="!mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                <dt className="font-semibold text-slate-900">{t('Kul')}</dt>
                <dd className="tabular text-xl font-semibold text-slate-900">{formatMoney(totals.grandTotal)}</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
              <Input label={t('Bill pe extra discount')} type="number" step="0.01" min="0" prefix="₹"
                value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)}
                hint={t('Saare items pe barabar bat jayega')} />

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t('Abhi kitna mila')} type="number" step="0.01" min="0" prefix="₹"
                  value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                <Select label={t('Kaise mila')} placeholder="" value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  options={[
                    { value: 'CASH', label: t('Cash') }, { value: 'UPI', label: 'UPI' },
                    { value: 'BANK', label: t('Bank') }, { value: 'CHEQUE', label: t('Cheque') },
                  ]} />
              </div>

              <div className={cn('flex items-center justify-between rounded-lg px-3 py-2.5 text-sm',
                due > 0 ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}>
                <span>{due > 0 ? 'Udhaar jayega' : 'Poora mil gaya'}</span>
                <strong className="tabular">{formatMoney(due)}</strong>
              </div>
            </div>

            {shortRows.length > 0 && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-800">
                {shortRows.length} item ka stock kam hai — bill nahi banega. Quantity theek karein.
              </p>
            )}

            <Button className="mt-5 w-full" size="lg" icon={Save} loading={saving} onClick={save}
              disabled={!party?.value || !filled.length || shortRows.length > 0}>
              {t('Bill banayein')}
            </Button>

            <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <Info size={13} className="mt-0.5 shrink-0" />
              Save karte hi {filled.length || 0} item ka stock ghatega aur {formatMoney(due)} retailer
              ke khate me udhaar chadhega.
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
      <dd className={cn('tabular', tone === 'green' ? 'text-emerald-700'
        : tone === 'muted' ? 'text-slate-400' : 'text-slate-900')}>{value}</dd>
    </div>
  );
}

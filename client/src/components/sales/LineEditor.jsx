import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney, formatQty } from '@/lib/format';
import { Button, Combobox } from '@/components/ui';
import { t } from '@/lib/i18n';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const newLine = () => ({ key: Math.random().toString(36).slice(2), itemId: '', name: '', unit: 'PCS', qty: '1', rate: '', discountPct: '', gstRate: 0 });

export function lineTotals(lines, withGst) {
  let sub = 0; let taxable = 0; let tax = 0;
  for (const l of lines) {
    if (!l.itemId) continue;
    const gross = Number(l.qty || 0) * Number(l.rate || 0);
    const tx = gross * (1 - Number(l.discountPct || 0) / 100);
    sub += gross; taxable += tx; tax += withGst ? (tx * (l.gstRate || 0)) / 100 : 0;
  }
  return { sub: r2(sub), discount: r2(sub - taxable), tax: r2(tax), total: Math.round(taxable + tax) };
}

/** Item lines for quotations and seller orders; rates default to the customer's price */
export default function LineEditor({ lines, setLines, partyId, withDiscount = true, withGst = false }) {
  const fetchItems = useCallback(async (q) => {
    const res = await api.get('/items', { params: { q, limit: 20 } });
    return res.data.map((i) => ({ value: i._id, label: i.name, sublabel: [i.sku, i.hsn && `HSN ${i.hsn}`].filter(Boolean).join(' · '), right: formatQty(i.stockQty, i.unit), raw: i }));
  }, []);
  const set = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function pick(key, opt) {
    if (!opt) { set(key, { itemId: '', name: '' }); return; }
    const i = opt.raw;
    let rate = i.wholesalePrice || i.salePrice || 0;
    if (partyId) {
      try {
        const res = await api.get(`/parties/${partyId}/rates`, { params: { q: i.name, limit: 5 } });
        const found = res.data.rows?.find((x) => String(x._id) === String(i._id));
        if (found) rate = found.rate;
      } catch { /* default rate */ }
    }
    set(key, { itemId: i._id, name: i.name, unit: i.unit, rate: String(rate), gstRate: i.gstRate || 0, stockQty: i.stockQty });
  }

  return (
    <div className="space-y-2">
      {lines.map((l, idx) => {
        const amt = Number(l.qty || 0) * Number(l.rate || 0) * (1 - Number(l.discountPct || 0) / 100);
        return (
          <div key={l.key} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-[minmax(0,3fr)_1fr_1fr_1fr_1fr_auto] sm:border-0 sm:p-0">
            <div className="col-span-2 sm:col-span-1">
              <Combobox label={idx === 0 ? t('Item') : undefined} placeholder={t('Search item')} value={l.itemId} display={l.name} fetchOptions={fetchItems} onChange={(o) => pick(l.key, o)} emptyText={t('No item found')} />
            </div>
            <label className="block text-xs text-slate-500">{idx === 0 && <span className="mb-1 block text-sm font-medium text-slate-700">{t('Qty')}</span>}
              <input aria-label={t('Qty')} type="number" min="0" step="any" inputMode="decimal" value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </label>
            <label className="block text-xs text-slate-500">{idx === 0 && <span className="mb-1 block text-sm font-medium text-slate-700">{t('Rate')}</span>}
              <input aria-label={t('Rate')} type="number" min="0" step="any" inputMode="decimal" value={l.rate} onChange={(e) => set(l.key, { rate: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900" />
            </label>
            {withDiscount ? (
              <label className="block text-xs text-slate-500">{idx === 0 && <span className="mb-1 block text-sm font-medium text-slate-700">{t('Disc %')}</span>}
                <input aria-label={t('Disc %')} type="number" min="0" max="100" step="any" value={l.discountPct} onChange={(e) => set(l.key, { discountPct: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900" />
              </label>
            ) : <span className="hidden sm:block" />}
            <p className="py-2 text-right text-sm font-medium tabular-nums text-slate-900">{formatMoney(amt)}{withGst && l.gstRate ? <span className="block text-[11px] font-normal text-slate-500">{t('+{n}% GST', { n: l.gstRate })}</span> : null}</p>
            <Button variant="ghost" size="sm" icon={Trash2} aria-label={t('Remove line')} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
          </div>
        );
      })}
      <Button variant="secondary" size="sm" icon={Plus} onClick={() => setLines((ls) => [...ls, newLine()])}>{t('Add item')}</Button>
    </div>
  );
}

import { formatMoney, formatDate, formatQty, formatPhone } from '@/lib/format';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/** Printable quotation / sales order / delivery challan (A4, shown only when printing unless `visible`) */
export default function DocSheet({
  title, no, date, business, party, rows, showRates = true, totals = [], meta = [], notes = [], visible = false, signLabels = ['Receiver’s signature', 'Authorised signatory'],
}) {
  const hasHsn = rows.some((r) => r.hsn);
  const hasDisc = rows.some((r) => r.discountPct);
  const hasGst = rows.some((r) => r.gstRate);
  const addr = (a) => [a?.line1, a?.city, a?.state, a?.pincode].filter(Boolean).join(', ');
  return (
    <div className={cn('invoice-sheet mx-auto max-w-[820px] bg-white p-6 text-sm text-slate-900 sm:p-8', !visible && 'print-only')}>
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
        <div>
          <p className="text-lg font-bold">{business?.name}</p>
          <p className="text-xs text-slate-600">{addr(business?.address)}</p>
          <p className="text-xs text-slate-600">{[business?.phone && formatPhone(business.phone), business?.gstin && `GSTIN ${business.gstin}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold uppercase tracking-wide">{t(title)}</p>
          <p className="text-xs">{no}</p>
          <p className="text-xs">{formatDate(date)}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="font-semibold uppercase text-slate-500">{t('To')}</p>
          <p className="text-sm font-semibold">{party?.shopName || party?.name}</p>
          {party?.shopName && party?.name && <p>{party.name}</p>}
          {party?.address && <p>{typeof party.address === 'string' ? party.address : addr(party.address)}</p>}
          {party?.city && !party?.address && <p>{party.city}</p>}
          {party?.phone && <p>{formatPhone(party.phone)}</p>}
          {party?.gstin && <p>GSTIN {party.gstin}</p>}
        </div>
        <div className="space-y-0.5 text-right">
          {meta.filter(([, v]) => v).map(([k, v]) => <p key={k}><span className="text-slate-500">{t(k)}:</span> {v}</p>)}
        </div>
      </div>
      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-slate-400 bg-slate-50 text-left">
            <th className="px-1.5 py-1.5">#</th><th className="px-1.5">{t('Item')}</th>{hasHsn && <th className="px-1.5">HSN</th>}<th className="px-1.5 text-right">{t('Qty')}</th>
            {showRates && <><th className="px-1.5 text-right">{t('Rate')}</th>{hasDisc && <th className="px-1.5 text-right">{t('Disc %')}</th>}{hasGst && <th className="px-1.5 text-right">GST</th>}<th className="px-1.5 text-right">{t('Amount')}</th></>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="px-1.5 py-1.5">{i + 1}</td><td className="px-1.5">{r.name}</td>{hasHsn && <td className="px-1.5">{r.hsn || ''}</td>}
              <td className="px-1.5 text-right tabular-nums">{formatQty(r.qty, r.unit)}</td>
              {showRates && <>
                <td className="px-1.5 text-right tabular-nums">{formatMoney(r.rate)}</td>{hasDisc && <td className="px-1.5 text-right">{r.discountPct ? `${r.discountPct}%` : ''}</td>}
                {hasGst && <td className="px-1.5 text-right">{r.gstRate ? `${r.gstRate}%` : ''}</td>}<td className="px-1.5 text-right tabular-nums">{formatMoney(r.amount)}</td>
              </>}
            </tr>
          ))}
        </tbody>
      </table>
      {totals.length > 0 && (
        <div className="ml-auto mt-2 w-64 text-xs">
          {totals.map(([k, v, bold]) => <p key={k} className={cn('flex justify-between py-0.5', bold && 'border-t border-slate-400 pt-1 text-sm font-bold')}><span>{t(k)}</span><span className="tabular-nums">{v}</span></p>)}
        </div>
      )}
      {notes.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="mt-3 text-xs"><p className="font-semibold text-slate-600">{t(k)}</p><p className="whitespace-pre-wrap">{v}</p></div>
      ))}
      <div className="mt-12 flex justify-between text-xs text-slate-600">
        {signLabels.map((s) => <p key={s} className="border-t border-slate-400 px-6 pt-1">{t(s)}</p>)}
      </div>
    </div>
  );
}

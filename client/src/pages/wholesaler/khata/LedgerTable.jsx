import { formatMoney, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui';

/**
 * Khata ka asli dil — ek hi component, teen jagah use hota hai:
 *   1. Khata > party detail page
 *   2. Retailer/Supplier detail ka "Khata" tab
 *   3. Retailer ka apna "My Khata"
 *
 * Convention (poori app me yahi hai):
 *   debit  = hisaab BADHA  (bill bana, maal gaya)
 *   credit = hisaab GHATA  (paisa aaya)
 */

const typeTone = {
  OPENING: 'slate',
  INVOICE: 'blue',
  PURCHASE: 'amber',
  PAYMENT_IN: 'green',
  PAYMENT_OUT: 'green',
  ADJUSTMENT: 'slate',
  SALE_RETURN: 'amber',
  PURCHASE_RETURN: 'amber',
};

export function BalanceLine({ balance, type = 'retailer', className = '' }) {
  const abs = formatMoney(Math.abs(balance));
  if (Math.abs(balance) < 0.01) {
    return <span className={`font-medium text-slate-500 ${className}`}>Hisaab barabar</span>;
  }
  if (balance > 0) {
    return (
      <span className={`tabular font-semibold text-red-600 ${className}`}>
        {abs} <span className="text-xs font-normal">{type === 'supplier' ? 'dena hai' : 'lena hai'}</span>
      </span>
    );
  }
  return (
    <span className={`tabular font-semibold text-emerald-600 ${className}`}>
      {abs} <span className="text-xs font-normal">advance</span>
    </span>
  );
}

export default function LedgerTable({ data, loading, onRowClick }) {
  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-400">Khata khul raha hai...</p>;
  }
  if (!data) return null;

  const { opening = 0, entries = [], totalDebit = 0, totalCredit = 0 } = data;

  if (!entries.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-slate-700">Is duration me koi lena-dena nahi</p>
        <p className="mt-1 text-xs text-slate-400">Bill banega ya paisa aayega tab yahan dikhega</p>
      </div>
    );
  }

  const link = (e) => {
    if (e.refType === 'Invoice' && e.refId) return `/invoices/${e.refId}`;
    if (e.refType === 'Purchase' && e.refId) return `/purchases/${e.refId}`;
    if (e.refType === 'ReturnNote' && e.refId) return `/returns/${e.refId}`;
    return null;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Kya hua</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Badha (+)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ghata (−)</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Baaki</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <td className="px-4 py-2.5 text-xs text-slate-500">—</td>
            <td className="px-4 py-2.5 text-xs font-medium text-slate-500">Shuruaat ka hisaab</td>
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5" />
            <td className="tabular px-4 py-2.5 text-right text-xs font-medium text-slate-600">
              {formatMoney(opening)}
            </td>
          </tr>

          {entries.map((e) => {
            const to = link(e);
            return (
              <tr key={e._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(e.date)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={typeTone[e.type] || 'slate'}>{e.typeLabel || e.type}</Badge>
                    {e.refNo && (
                      to && onRowClick ? (
                        <button onClick={() => onRowClick(to)}
                          className="text-xs font-medium text-brand-700 underline-offset-2 hover:underline">
                          {e.refNo}
                        </button>
                      ) : <span className="text-xs text-slate-500">{e.refNo}</span>
                    )}
                  </div>
                  {e.note && <p className="mt-1 text-xs text-slate-400">{e.note}</p>}
                </td>
                <td className="tabular px-4 py-3 text-right text-slate-700">
                  {e.debit > 0 ? formatMoney(e.debit) : <span className="text-slate-300">—</span>}
                </td>
                <td className="tabular px-4 py-3 text-right text-emerald-700">
                  {e.credit > 0 ? formatMoney(e.credit) : <span className="text-slate-300">—</span>}
                </td>
                <td className="tabular px-4 py-3 text-right font-medium text-slate-900">
                  {formatMoney(e.balanceAfter)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-medium">
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Kul</td>
            <td className="tabular px-4 py-3 text-right text-slate-900">{formatMoney(totalDebit)}</td>
            <td className="tabular px-4 py-3 text-right text-emerald-700">{formatMoney(totalCredit)}</td>
            <td className="tabular px-4 py-3 text-right text-slate-900">{formatMoney(data.closing)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

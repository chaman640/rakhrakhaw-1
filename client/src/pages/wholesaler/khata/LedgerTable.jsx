import { formatMoney, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui';
import { t } from '@/lib/i18n';

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
    return <span className={`font-medium text-slate-500 ${className}`}>{t('Hisaab barabar')}</span>;
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
      {abs} <span className="text-xs font-normal">{t('advance')}</span>
    </span>
  );
}

export default function LedgerTable({ data, loading, onRowClick }) {
  if (loading) {
    return <p className="py-12 text-center text-sm text-slate-400">{t('Khata khul raha hai...')}</p>;
  }
  if (!data) return null;

  const {
    opening = 0, entries = [], totalDebit = 0, totalCredit = 0,
    truncated = false, total = 0, shown = 0,
  } = data;

  if (!entries.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-medium text-slate-700">{t('Is duration me koi lena-dena nahi')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('Bill banega ya paisa aayega tab yahan dikhega')}</p>
      </div>
    );
  }

  const link = (e) => {
    if (e.refType === 'Invoice' && e.refId) return `/invoices/${e.refId}`;
    if (e.refType === 'Purchase' && e.refId) return `/purchases/${e.refId}`;
    if (e.refType === 'ReturnNote' && e.refId) return `/returns/${e.refId}`;
    return null;
  };

  const notice = truncated && (
    <p className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
      Kul {total} lena-dena hain — yahan sirf aakhri {shown} dikha rahe hain.
      Purana dekhna ho to upar se date lagayein. Neeche wala &ldquo;Baaki&rdquo; poora
      hisaab hi hai.
    </p>
  );

  return (
    <>
    {/* Badi screen — poori table */}
    <div className="hidden overflow-x-auto md:block">
      {notice}
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Date')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Kya hua')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Badha (+)')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Ghata (−)')}</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">{t('Baaki')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <td className="px-4 py-2.5 text-xs text-slate-500">—</td>
            <td className="px-4 py-2.5 text-xs font-medium text-slate-500">{t('Shuruaat ka hisaab')}</td>
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
            <td className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">{t('Kul')}</td>
            <td className="tabular px-4 py-3 text-right text-slate-900">{formatMoney(totalDebit)}</td>
            <td className="tabular px-4 py-3 text-right text-emerald-700">{formatMoney(totalCredit)}</td>
            <td className="tabular px-4 py-3 text-right text-slate-900">{formatMoney(data.closing)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    {/*
      PHONE WALA KHATA.

      Table me paanch column the (Date, Kya hua, Badha, Ghata, Baaki) — 640px.
      Phone 390px ka hai, to "Baaki" hamesha screen se bahar rehta tha. Aur
      khata me dukaandaar sabse pehle wahi dekhta hai: "ab kitna baaki hai".

      Isliye phone pe har lena-dena apni ek line hai: kya hua aur kitna ka
      badla upar, aur uske saamne us waqt ka baaki. Neeche kul ka jod alag
      patti me.
    */}
    <div className="md:hidden">
      {notice}

      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <span className="text-xs font-medium text-slate-500">{t('Shuruaat ka hisaab')}</span>
        <span className="tabular text-xs font-medium text-slate-600">{formatMoney(opening)}</span>
      </div>

      <div className="divide-y divide-slate-100">
        {entries.map((e) => {
          const to = link(e);
          return (
            <div key={e._id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
                  <p className="mt-1 text-xs text-slate-400">{formatDate(e.date)}</p>
                  {e.note && <p className="mt-0.5 text-xs text-slate-400">{e.note}</p>}
                </div>

                <div className="shrink-0 text-right">
                  {e.debit > 0 && (
                    <p className="tabular text-sm font-medium text-slate-800">+ {formatMoney(e.debit)}</p>
                  )}
                  {e.credit > 0 && (
                    <p className="tabular text-sm font-medium text-emerald-700">− {formatMoney(e.credit)}</p>
                  )}
                  <p className="tabular mt-0.5 text-xs text-slate-400">
                    baaki {formatMoney(e.balanceAfter)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-wide text-slate-500">{t('Kul badha')}</span>
          <span className="tabular font-medium text-slate-900">{formatMoney(totalDebit)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="uppercase tracking-wide text-slate-500">{t('Kul ghata')}</span>
          <span className="tabular font-medium text-emerald-700">{formatMoney(totalCredit)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
          <span className="text-sm font-semibold text-slate-900">{t('Baaki')}</span>
          <span className="tabular text-base font-semibold text-slate-900">{formatMoney(data.closing)}</span>
        </div>
      </div>
    </div>
    </>
  );
}

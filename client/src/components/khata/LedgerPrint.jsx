import { formatMoney, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';

/**
 * KHATE KA KAGAZ — CA WALI SHAKAL ME (item 21).
 *
 * App ke andar khata theek dikhta tha, par saal ke aakhir me CA jo maangta hai
 * wo ye nahi hai. Uska maangna bahut khaas hota hai — aur agar kagaz us shakal
 * me na ho to wo dobara banwata hai, ya khud banata hai aur fees leta hai.
 *
 * "Print" pehle bhi tha, par wo POORE PAGE ka print tha — usme filter ke
 * dabbe, button, menu, sab chala jata tha. Aisa kagaz CA ke paas jaate hi
 * wapas aa jata hai.
 *
 * CA ki shakal ki teen shartein, teeno yahan poori hoti hain:
 *
 *   1. OPENING + DEBIT − CREDIT = CLOSING, kagaz pe hi jud jana chahiye.
 *      Isliye opening ki apni line hai, aakhir me "Total" ki line hai, aur
 *      closing alag se. Number chhup kar kahin nahi jata.
 *
 *   2. HAR ENTRY KA SABOOT — kis kagaz se aayi. Isliye "Vch Type" aur "Vch No"
 *      alag khaane hain, note ke andar chhupe hue nahi. CA isi number se
 *      dono taraf ka milaan karta hai.
 *
 *   3. Dr / Cr — "−4,500" nahi. Hisaab ki duniya me minus ka matlab hi ye do
 *      akshar hain, aur CA usi shakal me padhta hai.
 *
 * Alag se koi PDF library NAHI daali. Browser ka apna "Print → Save as PDF"
 * wahi kaam karta hai, har phone aur computer pe pehle se maujood hai, aur
 * bill ka kagaz bhi isi tarah banta hai — do alag tarike rakhne se ek din ek
 * theek rehta aur doosra tootta.
 */

const TYPE_LABEL = {
  OPENING: 'Opening',
  INVOICE: 'Sales Invoice',
  PURCHASE: 'Purchase',
  PAYMENT_IN: 'Receipt',
  PAYMENT_OUT: 'Payment',
  SALE_RETURN: 'Credit Note',
  PURCHASE_RETURN: 'Debit Note',
  ADJUSTMENT: 'Adjustment',
};

/*
  Dr / Cr — kis taraf jhuka hua hai.

  Retailer ka +ve matlab usne dena hai (Dr), supplier ka +ve matlab humne dena
  hai (Cr). Yahi ek jagah hai jahan ye faisla hota hai; poore kagaz me kahin
  aur "+"/"−" nahi chhapta.
*/
function drCr(amount, partyType) {
  const n = Number(amount) || 0;
  if (Math.abs(n) < 0.005) return { text: formatMoney(0), side: '' };
  const isSupplier = partyType === 'supplier';
  const positiveSide = isSupplier ? 'Cr' : 'Dr';
  const negativeSide = isSupplier ? 'Dr' : 'Cr';
  return { text: formatMoney(Math.abs(n)), side: n > 0 ? positiveSide : negativeSide };
}

export default function LedgerPrint({ data, business, from, to, title }) {
  if (!data) return null;

  const party = data.party || {};
  const entries = data.entries || [];
  const b = business || {};

  const bAddr = [b.address?.line1, b.address?.line2, b.address?.city,
    b.address?.state, b.address?.pincode].filter(Boolean).join(', ');
  const pAddr = [party.address?.line1, party.address?.city,
    party.address?.state, party.address?.pincode].filter(Boolean).join(', ');

  const open = drCr(data.opening, party.type);
  const close = drCr(data.closing, party.type);

  return (
    <div className="invoice-sheet bg-white p-6 text-[11px] leading-snug text-slate-900">
      {/* ───────── Dukaan ka sar ───────── */}
      <div className="border-b-2 border-slate-800 pb-3 text-center">
        <p className="text-base font-bold uppercase tracking-wide">{b.name || '—'}</p>
        {bAddr && <p className="mt-0.5 text-[10px] text-slate-600">{bAddr}</p>}
        <p className="text-[10px] text-slate-600">
          {b.phone && <>{t('Phone')}: {b.phone}</>}
          {b.gstin && <> · GSTIN: <strong>{b.gstin}</strong></>}
        </p>
      </div>

      <p className="mt-3 text-center text-sm font-bold uppercase tracking-widest">
        {title || t('Statement of Account')}
      </p>

      {/* ───────── Kiska khata, kis arse ka ───────── */}
      <div className="mt-3 flex items-start justify-between gap-6 border-b border-slate-300 pb-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            {t('Party')}
          </p>
          <p className="mt-0.5 text-xs font-bold">{party.shopName || party.name || '—'}</p>
          {party.shopName && party.name && <p className="text-[10px] text-slate-600">{party.name}</p>}
          {pAddr && <p className="text-[10px] text-slate-600">{pAddr}</p>}
          {party.phone && <p className="text-[10px] text-slate-600">{t('Phone')}: {party.phone}</p>}
          {party.gstin && (
            <p className="text-[10px] text-slate-600">{t('GSTIN: {a0}', { a0: party.gstin })}</p>
          )}
        </div>

        <div className="shrink-0 text-right text-[10px] text-slate-600">
          <p>
            {t('Period')}:{' '}
            <strong>
              {from ? formatDate(from) : t('Shuru se')} — {to ? formatDate(to) : formatDate(new Date())}
            </strong>
          </p>
          <p className="mt-0.5">{t('Nikala gaya')}: {formatDate(new Date())}</p>
        </div>
      </div>

      {/*
        ───────── Khud khata ─────────

        Khaane wahi jo CA maangta hai. "Vch Type" aur "Vch No" alag hain —
        note ke andar chhupe hue nahi — kyunki milaan usi number se hota hai.
      */}
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-y border-slate-400 bg-slate-50 text-[9px] uppercase tracking-wide">
            <th className="px-2 py-1.5 text-left font-semibold">{t('Date')}</th>
            <th className="px-2 py-1.5 text-left font-semibold">{t('Particulars')}</th>
            <th className="px-2 py-1.5 text-left font-semibold">{t('Vch Type')}</th>
            <th className="px-2 py-1.5 text-left font-semibold">{t('Vch No')}</th>
            <th className="px-2 py-1.5 text-right font-semibold">{t('Debit')}</th>
            <th className="px-2 py-1.5 text-right font-semibold">{t('Credit')}</th>
            <th className="px-2 py-1.5 text-right font-semibold">{t('Balance')}</th>
          </tr>
        </thead>

        <tbody>
          <tr className="border-b border-slate-200 bg-slate-50/60">
            <td className="px-2 py-1.5" colSpan={4}>
              <strong>{t('Opening Balance')}</strong>
            </td>
            <td className="px-2 py-1.5" />
            <td className="px-2 py-1.5" />
            <td className="tabular px-2 py-1.5 text-right font-semibold">
              {open.text} {open.side}
            </td>
          </tr>

          {entries.map((e) => {
            const bal = drCr(e.balanceAfter, party.type);
            return (
              <tr key={e._id} className="border-b border-slate-100">
                <td className="whitespace-nowrap px-2 py-1.5">{formatDate(e.date)}</td>
                <td className="px-2 py-1.5">{e.note || TYPE_LABEL[e.type] || e.type}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{TYPE_LABEL[e.type] || e.type}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{e.refNo || '—'}</td>
                <td className="tabular px-2 py-1.5 text-right">
                  {e.debit ? formatMoney(e.debit) : ''}
                </td>
                <td className="tabular px-2 py-1.5 text-right">
                  {e.credit ? formatMoney(e.credit) : ''}
                </td>
                <td className="tabular whitespace-nowrap px-2 py-1.5 text-right">
                  {bal.text} {bal.side}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-y border-slate-400 bg-slate-50 font-semibold">
            <td className="px-2 py-1.5" colSpan={4}>{t('Total')}</td>
            <td className="tabular px-2 py-1.5 text-right">{formatMoney(data.totalDebit)}</td>
            <td className="tabular px-2 py-1.5 text-right">{formatMoney(data.totalCredit)}</td>
            <td className="tabular whitespace-nowrap px-2 py-1.5 text-right">
              {close.text} {close.side}
            </td>
          </tr>
        </tfoot>
      </table>

      {/*
        Kuch entry chhut gayi ho to KAGAZ PE LIKHTE hain.

        Server ek baar me 200 entry deta hai. Bina is line ke kagaz poora
        dikhta hai par hota adhoora — aur CA use sach maan kar aage badh jata
        hai. Adhoora kagaz galat kagaz se bhi khatarnak hai, kyunki wo galat
        nahi lagta.
      */}
      {data.truncated && (
        <p className="mt-2 border border-slate-300 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-700">
          {t('Dhyan dein: is arse me kul {a} entry hain, upar {b} dikhayi gayi hain. Poora khata chahiye to arsa chhota karke dobara nikalein.', {
            a: data.total, b: data.shown,
          })}
        </p>
      )}

      {/* ───────── Baaki, shabdon me ───────── */}
      <div className="mt-3 border-t border-slate-300 pt-2">
        <p className="text-[10px]">
          <span className="text-slate-500">{t('Closing Balance')}:</span>{' '}
          <strong>{close.text} {close.side}</strong>
          {' — '}
          {/* Shabd server se aate hain — wahi jod jo bill pe chalta hai */}
          <span className="text-slate-600">{data.closingInWords}</span>
        </p>
      </div>

      <p className="mt-4 text-center text-[9px] text-slate-400">
        {t('Ye computer se bana kagaz hai — dastkhat ki zarurat nahi.')}
      </p>
    </div>
  );
}

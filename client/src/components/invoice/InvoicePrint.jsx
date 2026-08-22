import { formatMoney, formatQty, formatDate, formatPhone } from '@/lib/format';
import { cn } from '@/lib/cn';
import PayBox from './PayBox';
import { t } from '@/lib/i18n';

const TAX_LABEL = { CGST_SGST: 'CGST + SGST', IGST: 'IGST', NONE: '' };

/**
 * Asli bill ka layout. Screen pe bhi yahi dikhta hai aur Ctrl+P pe A4 pe bhi.
 * Print ke liye alag component nahi banaya — jo dikha wahi chhapega.
 */
/** 18 -> "1 saal 6 mahine" */
function warrantyText(months) {
  const m = Number(months || 0);
  if (!m) return '';
  const y = Math.floor(m / 12);
  const rest = m % 12;
  return [y && `${y} saal`, rest && `${rest} mahine`].filter(Boolean).join(' ');
}

export default function InvoicePrint({ invoice }) {
  const b = invoice.businessSnapshot || {};
  const p = invoice.partySnapshot || {};
  const gst = invoice.gstEnabled;
  const isIgst = invoice.taxType === 'IGST';

  const bAddr = [b.address?.line1, b.address?.line2, b.address?.city,
  b.address?.state, b.address?.pincode].filter(Boolean).join(', ');
  const pAddr = [p.address?.line1, p.address?.city, p.address?.state, p.address?.pincode].
  filter(Boolean).join(', ');

  return (
    <div className="invoice-sheet mx-auto max-w-[820px] bg-white p-6 text-slate-900 sm:p-10">
      {invoice.isCancelled &&
      <div className="mb-4 rounded border-2 border-red-500 px-4 py-2 text-center text-lg font-bold text-red-600">
          {t('CANCELLED')}
        </div>
      }

      {/* ---- Header ---- */}
      <div className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {b.logoUrl &&
          <img src={b.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
          }
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight">{b.name}</h1>
            {bAddr && <p className="mt-1 text-xs leading-snug text-slate-600">{bAddr}</p>}
            <p className="mt-1 text-xs text-slate-600">
              {b.phone && <>{t('Phone')}: {formatPhone(b.phone)}</>}
              {gst && b.gstin && <> · GSTIN: <strong>{b.gstin}</strong></>}
              {/* "· GSTIN:" jaisa tukda har bhasha me wahi rehta hai — allow-list me hai */}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-base font-bold uppercase tracking-wide">
            {invoice.documentType === 'TAX_INVOICE' ? 'Tax Invoice' : 'Bill of Supply'}
          </p>
          <p className="mt-1 text-sm"><strong>{invoice.invoiceNo}</strong></p>
          <p className="text-xs text-slate-600">{formatDate(invoice.invoiceDate)}</p>
        </div>
      </div>

      {/* ---- Party ---- */}
      <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('Bill to')}</p>
          <p className="mt-1 font-semibold">{p.shopName || p.name}</p>
          {p.shopName && p.name && <p className="text-xs text-slate-600">{p.name}</p>}
          {pAddr && <p className="mt-0.5 text-xs leading-snug text-slate-600">{pAddr}</p>}
          {p.phone && <p className="text-xs text-slate-600">{t("Phone: {a0}", { a0: formatPhone(p.phone) })}</p>}
          {gst && p.gstin && <p className="text-xs text-slate-600">{t("GSTIN: {a0}", { a0: p.gstin })}</p>}
        </div>

        <div className="text-right text-xs text-slate-600">
          {gst &&
          <>
              <p>{t('Place of supply')}: <strong>{invoice.placeOfSupplyStateCode || '—'}</strong></p>
              <p className="mt-0.5">{t('Tax')}: <strong>{TAX_LABEL[invoice.taxType]}</strong></p>
            </>
          }
          {invoice.orderId && <p className="mt-0.5">{t('Order ke against')}</p>}
        </div>
      </div>

      {/*
         ---- Items ----
          Ye bill ka asli roop hai — kaagaz jaisa. Phone 390px ka hota hai aur
         GST wale bill me 8 column hote hain, to sab ek doosre se chipak jate
         the ("10 PCS₹10.00" — ginti padhi hi nahi jati thi).
          Isliye table ki apni ek kam se kam chaudai hai aur wo apne dabbe ke
         andar side me khiskati hai. Baaki bill (dukaan ka naam, kiska bill,
         hisaab) phone ki chaudai me hi rehta hai — sirf ginti wali table
         khiskati hai. Chhapte waqt ye dono cheezein hat jati hain (index.css
         me .sheet-scroll dekho).
        */

      }
      <div className={cn('sheet-scroll mt-4 overflow-x-auto', gst && 'sm:overflow-visible')}>
      <table className={cn('w-full border-collapse text-xs [&_td]:pr-2 [&_th]:pr-2',
        '[&_td:last-child]:pr-0 [&_th:last-child]:pr-0',
        gst ? 'min-w-[600px]' : 'min-w-[340px]')}>
        <thead>
          <tr className="border-b-2 border-slate-800 text-left">
            <th className="w-8 py-2 font-semibold">#</th>
            <th className="py-2 font-semibold">{t('Item')}</th>
            {gst && <th className="py-2 font-semibold">HSN</th>}
            <th className="py-2 text-right font-semibold">{t('Qty')}</th>
            <th className="py-2 text-right font-semibold">{t('Rate')}</th>
            {gst && <th className="py-2 text-right font-semibold">{t('Taxable')}</th>}
            {gst && !isIgst && <th className="py-2 text-right font-semibold">CGST</th>}
            {gst && !isIgst && <th className="py-2 text-right font-semibold">SGST</th>}
            {gst && isIgst && <th className="py-2 text-right font-semibold">IGST</th>}
            <th className="py-2 text-right font-semibold">{t('Amount')}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) =>
            <tr key={i} className="border-b border-slate-200 align-top">
              <td className="py-2">{i + 1}</td>
              <td className="py-2">
                <span className="font-medium">{it.name}</span>
                {it.warrantyMonths > 0 &&
                <span className="block text-[10px] text-slate-600">{t("Warranty: {a0}{a1}", { a0:
                    warrantyText(it.warrantyMonths), a1:
                    it.warrantyNote && ` — ${it.warrantyNote}` })}
                </span>
                }
                {it.discount > 0 &&
                <span className="block text-[10px] text-slate-500">{t("Discount {a0}", { a0:
                    formatMoney(it.discount) })}
                </span>
                }
              </td>
              {gst && <td className="py-2">{it.hsn || '—'}</td>}
              <td className="tabular py-2 text-right">{formatQty(it.qty, it.unit)}</td>
              <td className="tabular py-2 text-right">{formatMoney(it.rate)}</td>
              {gst && <td className="tabular py-2 text-right">{formatMoney(it.taxableValue)}</td>}
              {gst && !isIgst &&
              <td className="tabular py-2 text-right">
                  {formatMoney(it.cgst)}
                  <span className="block text-[10px] text-slate-500">{it.gstRate / 2}%</span>
                </td>
              }
              {gst && !isIgst &&
              <td className="tabular py-2 text-right">
                  {formatMoney(it.sgst)}
                  <span className="block text-[10px] text-slate-500">{it.gstRate / 2}%</span>
                </td>
              }
              {gst && isIgst &&
              <td className="tabular py-2 text-right">
                  {formatMoney(it.igst)}
                  <span className="block text-[10px] text-slate-500">{it.gstRate}%</span>
                </td>
              }
              <td className="tabular py-2 text-right font-medium">{formatMoney(it.total)}</td>
            </tr>
            )}
        </tbody>
      </table>
      </div>

      {/* Table kat rahi hai ye pata chalna chahiye — warna user samajhta hai
           ki bas itna hi hai. Kaagaz pe ye line nahi chhapti. */}
      {gst &&
      <p className="no-print mt-1 text-[10px] text-slate-400 sm:hidden">
          {t('GST ke khaane dekhne ke liye table ko ungli se side me khiskayein →')}
        </p>
      }

      {/* ---- Totals ---- */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="flex-1 text-xs">
          <p className="font-semibold">{t('Amount in words')}</p>
          <p className="mt-0.5 text-slate-700">{invoice.amountInWords}</p>

          {gst && invoice.hsnSummary?.length > 1 &&
          <div className="mt-4">
              <p className="font-semibold">{t('HSN wise summary')}</p>
              <table className="mt-1 w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-slate-400 text-left">
                    <th className="py-1">HSN</th>
                    <th className="py-1 text-right">{t('Taxable')}</th>
                    <th className="py-1 text-right">{t('Rate')}</th>
                    <th className="py-1 text-right">{t('Tax')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.hsnSummary.map((h, i) =>
                <tr key={i} className="border-b border-slate-200">
                      <td className="py-1">{h.hsn}</td>
                      <td className="tabular py-1 text-right">{formatMoney(h.taxableValue)}</td>
                      <td className="py-1 text-right">{h.gstRate}%</td>
                      <td className="tabular py-1 text-right">
                        {formatMoney(h.cgst + h.sgst + h.igst)}
                      </td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          }
        </div>

        <div className="w-full sm:w-72">
          <table className="w-full text-xs">
            <tbody>
              <Row label={t('Kul maal')} value={formatMoney(invoice.subTotal)} />
              {invoice.discountTotal > 0 &&
              <Row label={t('Discount')} value={`− ${formatMoney(invoice.discountTotal)}`} />
              }
              {gst && <Row label={t('Taxable value')} value={formatMoney(invoice.taxableTotal)} />}
              {gst && !isIgst && invoice.cgstTotal > 0 &&
              <>
                  <Row label="CGST" value={formatMoney(invoice.cgstTotal)} />
                  <Row label="SGST" value={formatMoney(invoice.sgstTotal)} />
                </>
              }
              {gst && isIgst && invoice.igstTotal > 0 &&
              <Row label="IGST" value={formatMoney(invoice.igstTotal)} />
              }
              {invoice.roundOff !== 0 &&
              <Row label={t('Round off')} value={formatMoney(invoice.roundOff)} />
              }
              <tr className="border-t-2 border-slate-800">
                <td className="py-2 text-sm font-bold">{t('Kul')}</td>
                <td className="tabular py-2 text-right text-sm font-bold">
                  {formatMoney(invoice.grandTotal)}
                </td>
              </tr>
              {invoice.paidAmount > 0 &&
              <Row label={t('Diya')} value={formatMoney(invoice.paidAmount)} />
              }
              <tr className="border-t border-slate-300">
                <td className="py-1.5 font-semibold">{t('Baaki')}</td>
                <td className="tabular py-1.5 text-right font-semibold">
                  {formatMoney(invoice.dueAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Paisa kahan bhejein (QR + bank) ---- */}
      <PayBox invoice={invoice} />

      {/* ---- Footer ---- */}
      <div className="mt-8 flex items-end justify-between gap-6 border-t border-slate-300 pt-4">
        <div className="flex-1 text-[10px] leading-snug text-slate-600">
          {invoice.notes && <p className="mb-2">{invoice.notes}</p>}
          {invoice.termsAndConditions &&
          <>
              <p className="font-semibold text-slate-700">{t('Terms & Conditions')}</p>
              <p className="whitespace-pre-line">{invoice.termsAndConditions}</p>
            </>
          }
        </div>
        <div className="shrink-0 text-center text-xs">
          <div className="h-12" />
          <p className="border-t border-slate-400 px-6 pt-1">{t("{a0} ke liye", { a0: b.name })}</p>
        </div>
      </div>
    </div>);

}

function Row({ label, value }) {
  return (
    <tr>
      <td className="py-1 text-slate-600">{label}</td>
      <td className="tabular py-1 text-right">{value}</td>
    </tr>);

}

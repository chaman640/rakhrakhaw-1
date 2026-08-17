import { useEffect, useState } from 'react';
import { billUpiLink } from '@/lib/billCanvas';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

/**
 * BILL KE NEECHE: "PAISA KAHAN BHEJEIN".
 *
 * Do alag raste, jaan-boojh kar alag dikhaye gaye hain:
 *
 *   QR   — sirf UPI ID se banta hai. Retailer phone uthata hai, scan karta
 *          hai, rakam pehle se bhari hui aati hai. Ek hi kadam.
 *
 *   Bank — account number aur IFSC bas LIKHE jate hain. Inka QR banta hi
 *          nahi: UPI ka QR ek "pata" (naam@bank) maangta hai, account number
 *          nahi. Log aksar poochte hain "account se QR kyun nahi bana" —
 *          jawab yahi hai, aur isliye ye baat yahan likhi hui hai.
 *
 * Poora paisa mil chuka ho to ye dabba dikhta hi nahi — jo dena hi nahi hai
 * uska QR dikhana bekaar hai.
 */
export default function PayBox({ invoice }) {
  const b = invoice.businessSnapshot || {};
  const [qr, setQr] = useState('');

  const due = Number(invoice.dueAmount || 0);
  const showQr = Boolean(b.upiId) && due > 0 && !invoice.isCancelled;
  const hasBank = Boolean(b.bankAccountNumber && b.bankIfsc);
  const link = billUpiLink(invoice);

  useEffect(() => {
    if (!showQr || !link) { setQr(''); return undefined; }
    let alive = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { width: 220, margin: 0 }))
      .then((url) => { if (alive) setQr(url); })
      .catch(() => { if (alive) setQr(''); });
    return () => { alive = false; };
  }, [showQr, link]);

  if (!showQr && !hasBank) return null;

  return (
    <div className="mt-6 rounded-lg border border-slate-300 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {t('Paisa kahan bhejein')}
      </p>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        {showQr && qr && (
          <div className="shrink-0 text-center">
            <img src={qr} alt={t('UPI QR')} className="h-28 w-28" />
            <p className="mt-1 text-[10px] text-slate-500">
              {t('Kisi bhi UPI app se scan karein')}
            </p>
          </div>
        )}

        <div className="min-w-0 flex-1 text-xs">
          {showQr && (
            <p className="text-slate-700">
              {t('Bhejni hai')}: <strong className="tabular">{formatMoney(due)}</strong>
            </p>
          )}
          {b.upiId && (
            <p className="mt-1 text-slate-700">
              UPI: <strong>{b.upiId}</strong>
              {b.upiName && <span className="text-slate-500"> · {b.upiName}</span>}
            </p>
          )}

          {hasBank && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              {(b.bankName || b.bankAccountName) && (
                <p className="text-slate-600">
                  {[b.bankName, b.bankAccountName].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="mt-0.5 text-slate-700">
                A/c <strong className="tabular">{b.bankAccountNumber}</strong>
                {'   '}IFSC <strong>{b.bankIfsc}</strong>
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                {t('Bank wale khate ka QR nahi banta — ye number apne bank app me daalein')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

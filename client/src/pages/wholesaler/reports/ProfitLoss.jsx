import { Info, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card } from '@/components/ui';
import { formatMoney, formatDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * FAYDA-NUKSAN.
 *
 * Ye table nahi hai — ye ek BAYAAN hai, upar se neeche padha jane wala:
 *
 *     itna becha → itne ka pada → itna maal pe bacha
 *     → itna kharch hua → itna asli me bacha
 *
 * Isliye ise generic table wale roop me nahi dikhaya. Table me har line ek
 * jaisi lagti hai; yahan kuch line jod hain aur kuch ghataav — aur wahi farak
 * samajhne wali cheez hai. Ghatne wali har line ke aage "−" hai aur rang
 * halka, jodne wali gehri.
 */

export default function ProfitLoss({ meta }) {
  if (!meta) return null;

  const profit = meta.netProfit || 0;
  const good = profit >= 0;

  return (
    <div className="space-y-5">
      {/* ───────── sabse bada sawal, sabse upar ───────── */}
      <Card className={cn('report-sheet', good ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={cn('text-sm font-medium', good ? 'text-emerald-800' : 'text-red-800')}>
              {good ? t('Asli fayda') : t('Nuksaan')}
            </p>
            <p className={cn('tabular mt-1 text-3xl font-bold', good ? 'text-emerald-900' : 'text-red-900')}>
              {formatMoney(Math.abs(profit))}
            </p>
            <p className={cn('mt-1 text-xs', good ? 'text-emerald-700' : 'text-red-700')}>
              {formatDate(meta.from)} {t('se')} {formatDate(meta.to)}
              {' · '}{meta.bills} {t('bill')}
            </p>
          </div>
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            good ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
            {good ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
        </div>

        {meta.netSale > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-200/60 pt-3">
            <Margin label={t('Maal pe fayda')} pct={meta.grossMarginPct} good={good} />
            <Margin label={t('Sab kharch ke baad')} pct={meta.netMarginPct} good={good} />
          </div>
        )}
      </Card>

      {/* ───────── poora bayaan ───────── */}
      <Card padding={false} className="report-sheet">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{t('Poora hisaab')}</h3>
        </div>

        <dl className="divide-y divide-slate-100">
          <Line label={t('Sale (bina GST)')} amount={meta.sale} />
          {meta.saleReturn > 0 && (
            <Line label={t('Maal wapas aaya')} amount={-meta.saleReturn} minus />
          )}
          {meta.saleReturn > 0 && (
            <Line label={t('Asli sale')} amount={meta.netSale} strong />
          )}

          <Line label={t('Maal ki lagat')} amount={-meta.cost} minus
            hint={t('jitna maal bika, wo aapko kitne ka pada')} />

          <Line label={t('Maal ka fayda')} amount={meta.grossProfit} strong />

          {(meta.expenseByCategory || []).map((c) => (
            <Line key={c.category} label={t(c.label)} amount={-c.amount} minus indent
              hint={`${c.count} ${t('entry')}`} />
          ))}
          <Line label={t('Dukaan ka kharch')} amount={-meta.expenses} minus strong />

          <Line label={good ? t('Asli fayda') : t('Nuksaan')}
            amount={meta.netProfit} strong big tone={good ? 'green' : 'red'} />
        </dl>
      </Card>

      {/* ───────── jo log sabse zyada poochte hain ───────── */}
      <Card className="no-print">
        <div className="flex items-start gap-3">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div className="space-y-2 text-xs leading-relaxed text-slate-600">
            <p>
              <strong className="text-slate-800">{t('GST kamaai nahi hai.')}</strong>{' '}
              {t('Graahak se liya hua tax sarkar ka hai, aapka nahi — isliye upar wali sale me wo nahi juda.')}
              {meta.gstCollected > 0 && (
                <> {t('Is duration me aapne')} <strong>{formatMoney(meta.gstCollected)}</strong> {t('GST ikattha kiya hai.')}</>
              )}
            </p>
            <p>
              <strong className="text-slate-800">{t('Maal khareedna kharch nahi hai.')}</strong>{' '}
              {t('Aaj ₹1 lakh ka maal khareeda aur kuch nahi becha — nuksaan nahi hua, paisa maal me badal gaya. Lagat tabhi ginti hai jab wo maal bikta hai.')}
            </p>
            <p>
              <strong className="text-slate-800">{t('Ye nakad ka hisaab nahi hai.')}</strong>{' '}
              {t('Udhaar becha hua maal bhi sale me hai, chahe paisa abhi na aaya ho. "Kitna paisa aaya" ke liye Khata dekhein.')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Margin({ label, pct, good }) {
  return (
    <div>
      <p className={cn('text-xs', good ? 'text-emerald-700' : 'text-red-700')}>{label}</p>
      <p className={cn('tabular text-lg font-semibold', good ? 'text-emerald-900' : 'text-red-900')}>
        {pct}%
      </p>
    </div>
  );
}

function Line({ label, amount, minus, strong, big, indent, hint, tone }) {
  const color = tone === 'green' ? 'text-emerald-700'
    : tone === 'red' ? 'text-red-700'
      : minus ? 'text-slate-600' : 'text-slate-900';

  return (
    <div className={cn('flex items-baseline justify-between gap-4 px-4',
      big ? 'py-4' : 'py-2.5',
      strong && !big && 'bg-slate-50')}>
      <div className={cn('min-w-0', indent && 'pl-4')}>
        <dt className={cn('truncate',
          big ? 'text-base font-semibold text-slate-900'
            : strong ? 'text-sm font-semibold text-slate-900'
              : indent ? 'text-xs text-slate-500' : 'text-sm text-slate-600')}>
          {label}
        </dt>
        {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
      </div>
      <dd className={cn('tabular shrink-0',
        big ? 'text-xl font-bold' : strong ? 'text-sm font-semibold' : 'text-sm',
        color)}>
        {minus && amount !== 0 ? '− ' : ''}{formatMoney(Math.abs(amount || 0))}
      </dd>
    </div>
  );
}

export function ProfitLossEmpty() {
  return (
    <Card>
      <div className="flex flex-col items-center py-10 text-center">
        <Wallet size={28} className="text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-900">{t('Is duration me kuch nahi hua')}</p>
        <p className="mt-1 text-sm text-slate-500">{t('Date range badal kar dekhein.')}</p>
      </div>
    </Card>
  );
}

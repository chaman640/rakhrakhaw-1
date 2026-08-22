import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * Phone pe maal ki ek line.
 *
 * Bill aur purchase dono me maal ek chaudi table me bharte the (720px). Phone
 * 390px ka hota hai — yaani aadhi table hi dikhti thi. Qty bharo to Rate ke
 * liye ungli se side me khiskao, Rate bharo to Total dekhne ke liye aur
 * khiskao. Ek hi item bharne me teen baar screen ghumani padti thi.
 *
 * Isliye phone pe har item ab apna ek card hai: naam upar, uske neeche do-do
 * karke khaane, aur sabse neeche us item ka apna total. Kuch bhi chhupa nahi
 * hai, kahin khiskana nahi padta.
 *
 * Badi screen pe purani table hi rehti hai — wahan wo theek hi thi.
 */
export default function LineItemCard({ index, picker, note, total, onRemove, children }) {
  return (
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("Item {a0}", { a0:
            index + 1 })}
        </span>
        {onRemove &&
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Item ${index + 1} hatayein`}
          // -my/-mr se dikhne me chipka nahi lagta, par dabne ka ghera 44px
          className="-my-1.5 -mr-1.5 rounded-lg p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-ring">
          
            <Trash2 size={17} />
          </button>
        }
      </div>

      {picker}
      {note}

      <div className="mt-3 grid grid-cols-2 gap-2.5">{children}</div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="text-sm text-slate-500">{t('Is item ka total')}</span>
        <span className="tabular text-base font-semibold text-slate-900">{total}</span>
      </div>
    </div>);

}

/**
 * Card ke andar ek number wala khaana.
 *
 * Table me heading upar ek hi baar likhi thi. Card me har khaane ke upar apni
 * likhaayi chahiye — warna do khali dabbe dikhte hain aur pata hi nahi chalta
 * ki kisme kya bharna hai.
 *
 * Dabba 44px uncha hai (h-11) — table wala 40px mouse ke liye theek tha, ungli
 * ke liye nahi.
 */
/**
 * Sirf padhne wali line — bill/order/purchase khol kar dekhne wale page ke liye.
 *
 * Yahan bharna kuch nahi hota, isliye card halka hai: naam aur uska total ek
 * hi line me (yahi do cheez dukaandaar sabse pehle dekhta hai), aur baaki
 * ginti neeche chhoti likhaayi me — "Qty 5 · Rate ₹100" jaise.
 */
export function ReadLineItem({ title, sub, total, children }) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{title}</p>
          {sub}
        </div>
        <span className="tabular shrink-0 font-semibold text-slate-900">{total}</span>
      </div>
      <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">{children}</dl>
    </div>);

}

/** ReadLineItem ke andar ek chhoti "naam: ginti" jodi */
export function ReadField({ label, value, tone }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-slate-400">{label}</dt>
      <dd className={cn('tabular font-medium', tone === 'red' ? 'text-red-600' : 'text-slate-700')}>
        {value}
      </dd>
    </div>);

}

export function NumField({ label, srLabel, invalid, className, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        aria-label={srLabel || label}
        className={cn(
          'tabular h-11 w-full rounded-lg border px-2.5 text-right focus-ring',
          invalid ? 'border-red-400' : 'border-slate-300',
          className
        )}
        {...props} />
      
    </label>);

}

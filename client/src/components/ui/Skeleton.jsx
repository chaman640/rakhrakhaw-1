import { cn } from '@/lib/cn';

/**
 * LOAD HOTE WAQT KA DHANCHA.
 *
 * Pehle yahan ghoomta hua chakkar (spinner) dikhta tha. Chakkar sirf itna
 * batata hai ki "ruko" — ye nahi ki aage kya aane wala hai. Screen khali se
 * bhari hoti hai to sab kuch ek jhatke me kood jata hai.
 *
 * Skeleton us cheez ka DHANCHA pehle hi bana deta hai jo aane wali hai.
 * Aankh ko pata hota hai ki kahan kya aayega, isliye data aane par kuch
 * hilta nahi — bas rang bhar jata hai. Intezaar utna hi hota hai, par kam
 * lagta hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DHYAN: ye SIRF pehli baar dikhna chahiye.
 *
 * Cache lag jane ke baad zyadatar baar data pehle se paas hota hai aur page
 * turant khulta hai — tab skeleton dikhana ulta bura hai, kyunki maujood data
 * ek pal ke liye gayab ho jata hai. Isliye `useQuery` ka `loading` sirf tab
 * true hota hai jab data hai hi nahi. Skeleton hamesha usi pe lagana.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-slate-200/80', className)}
    />
  );
}

/** Ek line — chaudai alag alag taaki asli likhaayi jaisa lage */
export function SkeletonText({ w = 'w-24', className }) {
  return <Skeleton className={cn('h-3.5', w, className)} />;
}

/**
 * List ki lines — Home, Invoices, Payments, Khata jaisi har list ke liye.
 *
 * Chaudai jaan-boojh kar barabar nahi rakhi. Sab lines ek hi lambai ki hon to
 * wo table jaisi lagti hai, asli list jaisi nahi.
 */
export function SkeletonRows({ rows = 6, className }) {
  const widths = ['w-40', 'w-32', 'w-44', 'w-28', 'w-36', 'w-24'];
  return (
    <div className={cn('divide-y divide-slate-100', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn('h-3.5', widths[i % widths.length])} />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Upar wale ginti ke tile — dashboard aur har list page ke sar pe */
export function SkeletonCards({ cards = 4, className }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4', className)}>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="mt-2 h-3 w-20" />
          <Skeleton className="mt-2 h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Badi screen wali table */
export function SkeletonTable({ rows = 6, cols = 5, className }) {
  return (
    <div className={className}>
      <div className="flex gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Peeche-peeche naya data aa raha hai — sabse upar ek patli patti.
 *
 * Page rokte nahi hain. Dukaandaar kaam karta rahe; jab naya aa jaye to
 * chupchaap lag jaye. Ye patti sirf itna batati hai ki "dekha ja raha hai" —
 * isliye 2px ki hai, jagah nahi ghera.
 */
export function RefreshBar({ show }) {
  if (!show) return null;
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-100"
    >
      <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] bg-brand-600" />
    </div>
  );
}

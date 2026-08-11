import { cn } from '@/lib/cn';

export default function Card({ children, className, padding = true, onClick, ...props }) {
  // onClick diya ho to poora card clickable ho — pehle wo chup-chaap gir jata tha,
  // aur dashboard ke tile pe sirf beech ka hissa kaam karta tha
  const clickable = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      {...(clickable ? { role: 'button', tabIndex: 0,
        onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } } : {})}
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        padding && 'p-5',
        clickable && 'cursor-pointer focus-ring',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  /*
    Phone pe ye tile do-do karke ek line me aate hain (aadhi chaudai). Pehle
    ye poori chaudai lete the — Khata kholo to chaar tile hi poori screen kha
    jate the aur asli list dekhne ke liye neeche khiskana padta tha.

    Aadhi chaudai me icon aur likhaayi ek line me nahi aate, isliye phone pe
    icon upar chala jata hai aur naam ko do line milti hain (truncate nahi,
    warna "Lena hai (retailers se)" kat kar "Lena hai (re..." reh jata tha).
  */
  return (
    <Card className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
      {Icon && (
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11', tones[tone])}>
          <Icon size={18} className="sm:hidden" />
          <Icon size={20} className="hidden sm:block" />
        </div>
      )}
      <div className="min-w-0 w-full">
        <p className="text-sm leading-snug text-slate-500 sm:truncate">{label}</p>
        <p className="tabular mt-0.5 truncate text-lg font-semibold text-slate-900 sm:text-xl">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  );
}

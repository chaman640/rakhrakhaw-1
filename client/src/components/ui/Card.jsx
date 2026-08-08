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
  return (
    <Card className="flex items-center gap-4">
      {Icon && (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', tones[tone])}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <p className="tabular mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  );
}

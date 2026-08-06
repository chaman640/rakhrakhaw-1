import { Package, MoreVertical } from 'lucide-react';
import { formatMoney, formatQty } from '@/lib/format';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

// Mobile ke liye — table ki jagah card
export default function ItemCard({ item, selected, onSelect, onEdit, onStock }) {
  return (
    <div className={cn(
      'flex gap-3 border-b border-slate-100 p-4 last:border-0',
      selected && 'bg-brand-50/50'
    )}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(item._id)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus-ring"
        aria-label={`${item.name} chunein`}
      />

      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          <Package size={20} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => onEdit(item)} className="min-w-0 text-left">
            <p className="truncate font-medium text-slate-900">{item.name}</p>
            <p className="truncate text-xs text-slate-500">
              {[item.sku, item.category].filter(Boolean).join(' · ') || 'Bina category'}
            </p>
          </button>
          <button
            onClick={() => onEdit(item)}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Edit"
          >
            <MoreVertical size={16} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button onClick={() => onStock(item)}>
            <Badge tone={item.isOutOfStock ? 'red' : item.isLowStock ? 'amber' : 'green'}>
              {item.isOutOfStock ? 'Khatam' : formatQty(item.stockQty, item.unit)}
            </Badge>
          </button>
          <span className="tabular text-sm text-slate-700">
            {formatMoney(item.wholesalePrice || item.salePrice)}
          </span>
          {!item.visibleToRetailers && <Badge tone="slate">Retailer se chhupa</Badge>}
        </div>
      </div>
    </div>
  );
}

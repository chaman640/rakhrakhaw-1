import { useEffect, useState } from 'react';
import { Plus, Minus, Equal, History } from 'lucide-react';
import api from '@/lib/api';
import { formatDateTime, formatQty } from '@/lib/format';
import { Modal, Button, Input, Textarea, Badge, Spinner, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const MODES = [
  { value: 'add', label: 'Stock aaya', icon: Plus, tone: 'emerald' },
  { value: 'remove', label: 'Stock gaya', icon: Minus, tone: 'red' },
  { value: 'set', label: 'Ginti karke set', icon: Equal, tone: 'slate' },
];

const TYPE_LABEL = {
  OPENING: 'Opening', PURCHASE: 'Purchase', SALE: 'Sale',
  ADJUSTMENT: 'Adjustment', PURCHASE_RETURN: 'Purchase return', SALE_RETURN: 'Sale return',
};

export default function StockModal({ open, onClose, item, onSaved }) {
  const toast = useToast();
  const [mode, setMode] = useState('add');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open || !item?._id) return;
    setMode('add'); setQty(''); setNote('');
    setLoadingHistory(true);
    api.get(`/items/${item._id}/movements`)
      .then((res) => setMovements(res.data))
      .catch(() => setMovements([]))
      .finally(() => setLoadingHistory(false));
  }, [open, item]);

  if (!item) return null;

  const current = Number(item.stockQty || 0);
  const n = Number(qty || 0);
  const after = mode === 'add' ? current + n : mode === 'remove' ? current - n : n;
  const wouldGoNegative = mode === 'remove' && after < 0;

  async function handleSubmit() {
    if (!qty && mode !== 'set') { toast.error('Quantity daalein'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/items/${item._id}/stock`, { mode, qty: Number(qty || 0), note });
      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={t('Stock badlein')}
      description={item.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={wouldGoNegative}>
            {t('Save karein')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Abhi ka stock */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">{t('Abhi ka stock')}</span>
          <span className="tabular text-lg font-semibold text-slate-900">
            {formatQty(current, item.unit)}
          </span>
        </div>

        {/* Mode */}
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-medium transition-colors focus-ring',
                mode === m.value
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <m.icon size={18} />
              {m.label}
            </button>
          ))}
        </div>

        <Input
          label={mode === 'set' ? 'Naya stock kitna hai' : 'Kitni quantity'}
          type="number" step="0.01" min="0" autoFocus
          suffix={item.unit}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />

        {/* Preview */}
        <div className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3 text-sm',
          wouldGoNegative ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'
        )}>
          <span>{wouldGoNegative ? 'Itna stock hai hi nahi' : 'Iske baad stock hoga'}</span>
          <strong className="tabular">{formatQty(after, item.unit)}</strong>
        </div>

        <Textarea
          label={t('Kyun? (marzi)')}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mode === 'remove' ? 'Damage / sample / ghar le gaya' : 'Supplier se aaya / ginti sahi ki'}
        />

        {/* History */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <History size={15} /> Pichhla record
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-6 text-slate-400"><Spinner /></div>
          ) : !movements.length ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
              {t('Abhi tak koi movement nahi')}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {movements.slice(0, 8).map((m) => (
                <li key={m._id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <Badge tone={m.qty > 0 ? 'green' : 'red'}>
                    {m.qty > 0 ? '+' : ''}{m.qty}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-700">
                      {TYPE_LABEL[m.type] || m.type}
                      {m.note && <span className="text-slate-500"> · {m.note}</span>}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(m.createdAt)}</p>
                  </div>
                  <span className="tabular shrink-0 text-xs text-slate-500">→ {m.balanceAfter}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

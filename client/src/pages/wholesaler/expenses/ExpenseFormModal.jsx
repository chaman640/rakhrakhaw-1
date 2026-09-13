import { useEffect, useMemo, useState } from 'react';
import { Wallet, Check, Package } from 'lucide-react';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { formatMoney, formatQty } from '@/lib/format';
import { Modal, Button, Input, Textarea, Combobox, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * KHARCH LIKHNE KA PARDA.
 *
 * Ye din me das baar khulega — chai, petrol, mazdoori. Isliye tarteeb wahi
 * rakhi hai jo dimaag me aati hai:
 *
 *     kitna  →  kis cheez ka  →  kaise diya
 *
 * Rakam sabse pehle aur sabse badi hai, aur khulte hi ungli usi me hoti hai.
 * Tareekh apne aap "aaj" hai — 95% baar wahi chahiye hoti hai, aur jab nahi
 * chahiye tab wo neeche maujood hai.
 *
 * Shreni chip hain, dropdown nahi. Dropdown me do tap lagte hain (kholo, phir
 * chuno) aur list dikhti nahi; chip ek tap hain aur saamne dikhte hain.
 */

const MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK', label: 'Bank' },
  { value: 'CHEQUE', label: 'Cheque' },
];

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export default function ExpenseFormModal({ open, onClose, expense, categories, onSaved }) {
  const toast = useToast();
  const editing = Boolean(expense?._id);

  const [form, setForm] = useState(() => blank());
  const [customCat, setCustomCat] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  // Waste/Damaged Stock ke liye — kaunsa item, kitni quantity
  const [wasteItem, setWasteItem] = useState(null); // { value, label, raw }
  const [wasteQty, setWasteQty] = useState('');

  function blank() {
    return {
      amount: '', category: '', date: today(), mode: 'CASH', paidTo: '', note: '',
    };
  }

  const fetchItems = async (q) => {
    const res = await api.get('/items', { params: { q, limit: 20 } });
    return res.data.map((i) => ({
      value: i._id,
      label: i.name,
      sublabel: [i.sku, i.category].filter(Boolean).join(' · '),
      right: formatQty(i.stockQty, i.unit),
      raw: i,
    }));
  };

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        amount: String(expense.amount ?? ''),
        category: expense.category || '',
        date: (expense.date || '').slice(0, 10) || today(),
        mode: expense.mode || 'CASH',
        paidTo: expense.paidTo || '',
        note: expense.note || '',
      });
      setShowCustom(false);
      setWasteQty(String(expense.wasteQty || ''));
      // Naam dikhane ke liye — sirf tab jab is expense ne kisi item ka stock ghataya ho
      if (expense.wasteItemId) {
        api.get(`/items/${expense.wasteItemId}`).then((r) => {
          setWasteItem({ value: r.data._id, label: r.data.name, raw: r.data });
        }).catch(() => setWasteItem(null));
      } else {
        setWasteItem(null);
      }
    } else {
      setForm(blank());
      setCustomCat('');
      setShowCustom(false);
      setWasteItem(null);
      setWasteQty('');
    }
  }, [open, expense, editing]);

  /*
    Chip ki tarteeb: pehle wo jo IS dukaan me sabse zyada likhe gaye hain, phir
    baaki jaani-pehchani. Do hafte chalane ke baad har dukaan ke apne teen-chaar
    kharch upar aa jate hain, aur likhna ek tap ka kaam ban jata hai.
  */
  const chips = useMemo(() => {
    const all = [...(categories?.standard || []), ...(categories?.custom || [])];
    const sorted = [...all].sort((a, b) => (b.count || 0) - (a.count || 0));
    // Purana normal kharch hai to use "Waste/Damaged Stock" me badla nahi ja
    // sakta — wo sirf naya likhte waqt chunne layak hai (Expense.js me wajah).
    if (editing && expense?.category !== 'waste-stock') {
      return sorted.filter((c) => !c.touchesStock);
    }
    return sorted;
  }, [categories, editing, expense]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const chosenCategory = showCustom ? customCat.trim() : form.category;
  const isWaste = chips.find((c) => c.value === chosenCategory)?.touchesStock === true;

  // Waste ka amount khud yahan se aata hai — sirf ek andaza (asli lagat
  // server FIFO se nikalta hai), taaki save karne se pehle mota-mota pata chale.
  const wasteQtyNum = Number(wasteQty || 0);
  const wasteStockAvailable = wasteItem?.raw?.stockQty ?? null;
  const wasteQtyOverStock = wasteStockAvailable !== null && wasteQtyNum > wasteStockAvailable;
  const wasteEstimate = wasteItem?.raw?.purchasePrice
    ? round2(Number(wasteItem.raw.purchasePrice) * wasteQtyNum) : 0;

  const amountOk = Number(form.amount) > 0;
  const lockedWasteEdit = editing && expense.category === 'waste-stock';
  const canSave = lockedWasteEdit
    ? true // sirf date/mode/paidTo/note badal rahe hain, wo hamesha theek hai
    : isWaste
      ? Boolean(wasteItem) && wasteQtyNum > 0 && !wasteQtyOverStock
      : amountOk && Boolean(chosenCategory);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const shared = {
        date: form.date,
        mode: form.mode,
        paidTo: form.paidTo.trim(),
        note: form.note.trim(),
      };
      // Waste ki entry edit ho rahi ho to amount/category/item/qty bhejte hi
      // nahi — backend inhe badalne hi nahi deta (Expense.js me wajah likhi hai)
      const payload = lockedWasteEdit
        ? shared
        : isWaste
          ? {
              ...shared,
              amount: wasteEstimate || 0.01, // sirf placeholder — server asli lagat se badal dega
              category: chosenCategory,
              wasteItemId: wasteItem.value,
              wasteQty: wasteQtyNum,
            }
          : { ...shared, amount: Number(form.amount), category: chosenCategory };
      const res = editing
        ? await api.put(`/expenses/${expense._id}`, payload)
        : await api.post('/expenses', payload);
      toast.success(res.message);
      // Kharch badla to fayda-nuksan bhi badla
      bust('expenses', 'reports', 'dashboard', 'items');
      onSaved?.(res.data);
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
      title={editing ? t('Kharch badlein') : t('Kharch likhein')}
      description={editing ? '' : t('Jo paisa dukaan se bahar gaya — chai se lekar kiraya tak')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Rehne dein')}</Button>
          <Button icon={Check} loading={saving} onClick={save} disabled={!canSave}>
            {editing ? t('Save karein') : t('Likh lein')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* ── kis cheez ka ── */}
        <div>
          <p className="mb-1.5 flex items-center text-sm font-medium text-slate-700">
            {t('Kis cheez ka')}
            <span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => { setShowCustom(false); setForm((f) => ({ ...f, category: c.value })); }}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition focus-ring',
                  !showCustom && form.category === c.value
                    ? 'border-brand-600 bg-brand-50 font-medium text-brand-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {t(c.label)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className={cn(
                'rounded-full border border-dashed px-3 py-1.5 text-sm transition focus-ring',
                showCustom
                  ? 'border-brand-600 bg-brand-50 font-medium text-brand-800'
                  : 'border-slate-300 text-slate-500 hover:bg-slate-50',
              )}
            >
              + {t('Naya naam')}
            </button>
          </div>

          {showCustom && (
            <Input
              className="mt-2"
              autoFocus
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              placeholder={t('Jaise: generator ka diesel')}
              hint={t('Ek baar likh dein — agli baar ye bhi chip banke aa jayega')}
            />
          )}
        </div>

        {/* ── kitna — normal kharch, ya waste/damaged stock ka item+qty ── */}
        {isWaste ? (
          <div className="space-y-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3">
            {editing && expense.category === 'waste-stock' ? (
              <>
                <p className="text-sm font-medium text-slate-900">
                  {wasteItem?.label || '—'}
                  {wasteQtyNum > 0 && <span className="ml-1.5 text-slate-500">· {wasteQty}</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {t('Waste/Damaged Stock ki entry me item ya quantity badla nahi ja sakta — hata kar dobara banayein.')}
                </p>
              </>
            ) : (
              <>
                <Combobox
                  label={t('Kaunsa item kharab hua')}
                  placeholder={t('Item dhundhein')}
                  display={wasteItem?.label}
                  value={wasteItem?.value}
                  onChange={setWasteItem}
                  fetchOptions={fetchItems}
                  emptyText={t('Koi item nahi mila')}
                />
                {wasteItem && (
                  <>
                    <Input
                      label={t('Kitni quantity kharab hui')}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max={wasteStockAvailable ?? undefined}
                      value={wasteQty}
                      onChange={(e) => setWasteQty(e.target.value)}
                      hint={wasteStockAvailable !== null
                        ? t('Abhi stock: {a0}', { a0: formatQty(wasteStockAvailable, wasteItem.raw?.unit) })
                        : undefined}
                    />
                    {wasteQtyOverStock && (
                      <p className="text-xs font-medium text-red-600">
                        {t('Itna stock nahi hai — zyada se zyada {a0} chun sakte hain', {
                          a0: formatQty(wasteStockAvailable, wasteItem.raw?.unit),
                        })}
                      </p>
                    )}
                    {wasteQtyNum > 0 && !wasteQtyOverStock && (
                      <p className="flex items-center gap-1.5 text-sm text-slate-700">
                        <Package size={14} className="text-slate-400" />
                        {t('Andazan nuksan: {a0}', { a0: formatMoney(wasteEstimate) })}
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          <Input
            label={t('Kitna')}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            prefix="₹"
            value={form.amount}
            onChange={set('amount')}
            className="text-lg font-semibold"
            placeholder="0"
          />
        )}

        {/* ── kab aur kaise ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Tareekh')} type="date" value={form.date} onChange={set('date')} />
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">{t('Kaise diya')}</p>
            <div className="flex gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, mode: m.value }))}
                  className={cn(
                    'h-10 flex-1 rounded-lg border text-sm transition focus-ring',
                    form.mode === m.value
                      ? 'border-brand-600 bg-brand-50 font-medium text-brand-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {t(m.label)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Input label={t('Kisko diya (marzi se)')} value={form.paidTo} onChange={set('paidTo')}
          placeholder={t('Ramu / Bharat Petrol Pump')} />

        <Textarea label={t('Note (marzi se)')} rows={2} value={form.note} onChange={set('note')}
          placeholder={t('Gaadi UP78 AB 1234 me daala')} />

        <p className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Wallet size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            {isWaste
              ? t('Save karte hi itni quantity ka stock kam ho jayega, aur uski lagat hi is kharch ka amount ban jayegi.')
              : t('Maal khareedna kharch nahi hai — wo "Purchase" me jata hai. Yahan sirf wo paisa likhein jo maal ke alawa bahar gaya.')}
          </span>
        </p>
      </div>
    </Modal>
  );
}

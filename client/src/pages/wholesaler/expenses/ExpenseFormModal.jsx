import { useEffect, useMemo, useState } from 'react';
import { Wallet, Check } from 'lucide-react';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { Modal, Button, Input, Textarea, useToast } from '@/components/ui';
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

export default function ExpenseFormModal({ open, onClose, expense, categories, onSaved }) {
  const toast = useToast();
  const editing = Boolean(expense?._id);

  const [form, setForm] = useState(() => blank());
  const [customCat, setCustomCat] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  function blank() {
    return {
      amount: '', category: '', date: today(), mode: 'CASH', paidTo: '', note: '',
    };
  }

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
    } else {
      setForm(blank());
      setCustomCat('');
      setShowCustom(false);
    }
  }, [open, expense, editing]);

  /*
    Chip ki tarteeb: pehle wo jo IS dukaan me sabse zyada likhe gaye hain, phir
    baaki jaani-pehchani. Do hafte chalane ke baad har dukaan ke apne teen-chaar
    kharch upar aa jate hain, aur likhna ek tap ka kaam ban jata hai.
  */
  const chips = useMemo(() => {
    const all = [...(categories?.standard || []), ...(categories?.custom || [])];
    return [...all].sort((a, b) => (b.count || 0) - (a.count || 0));
  }, [categories]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const chosenCategory = showCustom ? customCat.trim() : form.category;
  const amountOk = Number(form.amount) > 0;
  const canSave = amountOk && Boolean(chosenCategory);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        amount: Number(form.amount),
        category: chosenCategory,
        date: form.date,
        mode: form.mode,
        paidTo: form.paidTo.trim(),
        note: form.note.trim(),
      };
      const res = editing
        ? await api.put(`/expenses/${expense._id}`, payload)
        : await api.post('/expenses', payload);
      toast.success(res.message);
      // Kharch badla to fayda-nuksan bhi badla
      bust('expenses', 'reports', 'dashboard');
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
        {/* ── kitna ── */}
        <Input
          label={t('Kitna')}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          autoFocus
          prefix="₹"
          value={form.amount}
          onChange={set('amount')}
          className="text-lg font-semibold"
          placeholder="0"
        />

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
            {t('Maal khareedna kharch nahi hai — wo "Purchase" me jata hai. Yahan sirf wo paisa likhein jo maal ke alawa bahar gaya.')}
          </span>
        </p>
      </div>
    </Modal>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Banknote, Smartphone, Landmark, FileCheck } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Modal, Button, Input, Select, Textarea, useToast } from '@/components/ui';

const MODES = [
  { value: 'CASH', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'BANK', label: 'Bank', icon: Landmark },
  { value: 'CHEQUE', label: 'Cheque', icon: FileCheck },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Paisa entry karne ka form.
 *
 * `fixedParty` mile to party pehle se chuni hui hai (party detail se khula hai),
 * warna dropdown se chunni padegi (Payments page se khula hai).
 */
export default function PaymentFormModal({ open, onClose, fixedParty = null, onSaved }) {
  const toast = useToast();

  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPartyId(fixedParty?._id || '');
    setAmount(''); setMode('CASH'); setDate(todayStr());
    setReference(''); setNote(''); setError('');

    if (!fixedParty) {
      api.get('/parties', { params: { type: 'all', limit: 300 } })
        .then((r) => setParties(r.data)).catch(() => {});
    }
  }, [open, fixedParty]);

  const selected = useMemo(
    () => fixedParty || parties.find((p) => p._id === partyId) || null,
    [fixedParty, parties, partyId]
  );

  const isSupplier = selected?.type === 'supplier';
  const direction = isSupplier ? 'OUT' : 'IN';
  const due = Number(selected?.balance || 0);

  async function save() {
    if (!partyId) return setError('Pehle party chunein');
    if (!(Number(amount) > 0)) return setError('Amount daaliye');

    setSaving(true);
    setError('');
    try {
      const res = await api.post('/payments', {
        partyId, direction, amount: Number(amount), mode, date,
        reference: reference.trim(), note: note.trim(),
      });
      toast.success(res.message);
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isSupplier ? 'Paisa diya' : 'Paisa aaya'}
      description={selected
        ? `${selected.shopName || selected.name} — ${isSupplier ? 'inko dena tha' : 'inse lena tha'} ${formatMoney(Math.max(due, 0))}`
        : 'Kisse paisa mila ya kisko diya, wo entry karein'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Rehne dein</Button>
          <Button onClick={save} loading={saving}>Entry karein</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!fixedParty && (
          <Select
            label="Kiska paisa"
            required
            placeholder="Party chunein"
            value={partyId}
            onChange={(e) => setPartyId(e.target.value)}
            options={parties.map((p) => ({
              value: p._id,
              label: `${p.shopName || p.name}${p.balance > 0 ? ` — ${formatMoney(p.balance)} baaki` : ''}`,
            }))}
          />
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Kaise mila</span>
          <div className="grid grid-cols-4 gap-2">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                aria-pressed={mode === m.value}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors focus-ring ${
                  mode === m.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <m.icon size={16} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Kitna" required type="number" min="0" step="0.01" prefix="₹"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            hint={due > 0 ? `Poora ${formatMoney(due)} baaki hai` : undefined}
          />
          <Input label="Kab" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {due > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAmount(String(due))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-ring">
              Poora {formatMoney(due)}
            </button>
            <button type="button" onClick={() => setAmount(String(Math.round(due / 2)))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-ring">
              Aadha
            </button>
          </div>
        )}

        {mode !== 'CASH' && (
          <Input
            label={mode === 'CHEQUE' ? 'Cheque number' : 'Transaction / UTR number'}
            value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder={mode === 'CHEQUE' ? '123456' : '4xxxxxxxxxxx'}
          />
        )}

        <Textarea label="Note (marzi se)" rows={2} value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Jaise: Ramesh ke haath bheja" />

        {!isSupplier && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Paisa apne aap sabse purane bill pe lagega. Zyada hua to advance jama rahega.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

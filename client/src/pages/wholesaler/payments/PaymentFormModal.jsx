import { useCallback, useEffect, useState } from 'react';
import { Banknote, Smartphone, Landmark, FileCheck } from 'lucide-react';
import api from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { Modal, Button, Input, Combobox, Textarea, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

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
 * warna Payments page se khula hai — tab search karke chunni padti hai.
 *
 * Yahan Combobox jaan-boojh kar hai, plain dropdown nahi: 200 se zyada party
 * hone par dropdown me kuch party chhut jati thi (aur phone pe scroll karna
 * bhi mushkil hai). Ab server pe search hoti hai, list poori chahiye hi nahi.
 */
export default function PaymentFormModal({
  open, onClose, fixedParty = null, onSaved, defaultRefund = false,
}) {
  const toast = useToast();

  // { value, label, raw } — Combobox ka format
  const [party, setParty] = useState(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('CASH');
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refund, setRefund] = useState(false);
  const [ask, setAsk] = useState(null);        // "jama kar dein?" wala sawal

  useEffect(() => {
    if (!open) return;
    setParty(fixedParty
      ? { value: fixedParty._id, label: fixedParty.shopName || fixedParty.name, raw: fixedParty }
      : null);
    setAmount(''); setMode('CASH'); setDate(todayStr());
    setReference(''); setNote(''); setError('');
    /*
      Jama tab ke "Wapas karein" se khula ho to parda WAPASI ki halat me hi
      khulna chahiye. Pehle wo "Paisa aaya" me khulta tha aur andar jaake ek
      aur button dabana padta tha — do bar wahi baat, aur beech me galti se
      seedha Entry dab jaye to ulta hi paisa chadh jata.
    */
    setRefund(defaultRefund); setAsk(null);
  }, [open, fixedParty, defaultRefund]);

  const fetchParties = useCallback(async (q) => {
    const res = await api.get('/parties', { params: { type: 'all', q, limit: 20 } });
    return res.data.map((pp) => ({
      value: pp._id,
      label: pp.shopName || pp.name,
      sublabel: `${pp.type === 'supplier' ? 'Supplier' : 'Retailer'} · ${pp.phone}`,
      right: pp.balance > 0 ? formatMoney(pp.balance) : '',
      raw: pp,
    }));
  }, []);

  const selected = party?.raw || null;

  const isSupplier = selected?.type === 'supplier';
  /*
    `refund` = ulti taraf ka paisa — jama paisa graahak ko WAPAS karna (ya
    supplier se wapas milna). Ye pehle mumkin hi nahi tha: har entry ek hi
    taraf jati thi, aur wapasi karne par uska jama paisa ghatne ki jagah BADH
    jata tha.
  */
  const direction = refund
    ? (isSupplier ? 'IN' : 'OUT')
    : (isSupplier ? 'OUT' : 'IN');

  const balance = Number(selected?.balance || 0);
  const due = Math.max(balance, 0);
  const jama = Math.max(-balance, 0);          // ulta balance = jama paisa
  // Is parde pe "poora kitna" ka matlab: paisa aa raha ho to udhaar, ja raha
  // ho to jama. Ek naam, taaki hint aur button dono kabhi alag na bolein.
  const hadd = refund ? jama : due;

  async function send(allowAdvance = false) {
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/payments', {
        partyId: party.value, direction, amount: Number(amount), mode, date,
        reference: reference.trim(), note: note.trim(),
        ...(allowAdvance ? { allowAdvance: true } : {}),
      });
      toast.success(res.message);
      onSaved?.(res.data);
      setAsk(null);
      onClose();
    } catch (err) {
      /*
        Server "zyada paisa hai" par 400 deta hai aur saath me poora hisaab
        (`needsAdvance`, `extra`). Use error ki tarah dikhana galat hoga — ye
        galti nahi, ek SAWAL hai. Isliye yahan uska parda khulta hai:
        "₹3,000 zyada hai. Jama kar dein?"
      */
      if (err.details?.needsAdvance) setAsk(err.details);
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!party?.value) return setError('Pehle party chunein');
    if (!(Number(amount) > 0)) return setError('Amount daaliye');
    return send(false);
  }

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={refund ? t('Jama paisa wapas') : (isSupplier ? t('Paisa diya') : t('Paisa aaya'))}
      description={selected
        ? (jama > 0
          ? `${selected.shopName || selected.name} — ${formatMoney(jama)} jama pada hai`
          : `${selected.shopName || selected.name} — ${isSupplier ? t('inko dena tha') : t('inse lena tha')} ${formatMoney(due)}`)
        : t('Kisse paisa mila ya kisko diya, wo entry karein')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Rehne dein')}</Button>
          <Button onClick={save} loading={saving}>{t('Entry karein')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/*
          Jama paisa pada ho tabhi "wapas karein" ka rasta dikhta hai —
          warna ye khaana sirf uljhata hai. Yahi wo option hai jo pehle
          poore app me kahin tha hi nahi.
        */}
        {jama > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-sm text-emerald-900">
              <strong>{formatMoney(jama)}</strong> {t('inka jama paisa hai')}
            </p>
            <Button size="sm" variant={refund ? 'primary' : 'secondary'}
              onClick={() => setRefund((v) => !v)}>
              {refund ? t('Nahi, paisa aaya hai') : t('Wapas karein')}
            </Button>
          </div>
        )}

        {!fixedParty && (
          <Combobox
            label={t('Kiska paisa')}
            required
            value={party?.value}
            display={party?.label}
            onChange={setParty}
            fetchOptions={fetchParties}
            placeholder={t('Naam ya phone se dhoondhein')}
          />
        )}

        <div>
          {/* Wapasi me paisa JA raha hai, aa nahi raha — "Kaise mila" ulta padhta hai */}
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            {refund ? t('Kaise diya') : t('Kaise mila')}
          </span>
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
            label={t('Kitna')} required type="number" min="0" step="0.01" prefix="₹"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            /*
              Wapasi me hadd `due` nahi, `jama` hai — aur ye baat sirf shabdon
              ki nahi thi: wapasi ke parde pe bhi "Poora ₹5,000 baaki hai"
              likha aata tha aur neeche wala button bhi UDHAAR bhar deta tha,
              jabki wahan bharna jama paisa chahiye. Ek galat tap se ulta
              hisaab ban jata.
            */
            hint={hadd > 0
              ? (refund ? `Poora ${formatMoney(hadd)} jama hai` : `Poora ${formatMoney(hadd)} baaki hai`)
              : undefined}
          />
          <Input label={t('Kab')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {hadd > 0 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAmount(String(hadd))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-ring">
              Poora {formatMoney(hadd)}
            </button>
            <button type="button" onClick={() => setAmount(String(Math.round(hadd / 2)))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-ring">
              {t('Aadha')}
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

        <Textarea label={t('Note (marzi se)')} rows={2} value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('Jaise: Ramesh ke haath bheja')} />

        {/* Wapasi pe ye line jhooth thi — us paise ka kisi bill se lena-dena
            hi nahi, wo to khate se BAAHAR ja raha hai */}
        {!isSupplier && !refund && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {t('Paisa apne aap sabse purane bill pe lagega. Zyada hua to advance jama rahega.')}
          </p>
        )}
        {refund && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {t('Itna jama paisa khate se ghat jayega. Isse kisi bill ka baaki nahi badlega.')}
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>

      {/*
        "₹3,000 zyada hai. Jama kar dein?"

        Ye galti ka laal dabba NAHI hai — ye ek sawal hai. Server ne rok kar
        poora hisaab bhej diya hai; yahan wahi saaf shabdon me poochha jata
        hai. Haan dabate hi WAHI entry `allowAdvance` ke saath dobara jati
        hai. Isi ek parde se advance "haadsa" se "faisla" ban jata hai.
      */}
      <Modal
        open={!!ask}
        onClose={() => setAsk(null)}
        title={t('Ye paisa jama kar dein?')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAsk(null)}>{t('Nahi, badal dein')}</Button>
            <Button onClick={() => send(true)} loading={saving}>{t('Haan, jama kar dein')}</Button>
          </>
        }
      >
        {ask && (
          <div className="space-y-3 text-sm">
            <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              <Row label={t('Aap daal rahe hain')} value={formatMoney(ask.amount)} />
              <Row label={isSupplier ? t('Dena tha') : t('Lena tha')} value={formatMoney(ask.outstanding)} />
              <Row label={t('Zyada hai')} value={formatMoney(ask.extra)} strong />
            </dl>
            <p className="text-slate-600">
              {/* Upar ki teen line me ₹5,000.00 likha hai — yahan ₹5000 likhna
                  ek hi rakam ko do shakal me dikhata hai. Wahi formatMoney. */}
              {t('Ye {n} inke khate me JAMA ho jayega. Agle bill me se apne aap kat jayega, ya aap kabhi bhi wapas kar sakte hain.', { n: formatMoney(ask.extra) })}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={cn('tabular', strong ? 'font-semibold text-amber-700' : 'text-slate-900')}>{value}</dd>
    </div>
  );
}

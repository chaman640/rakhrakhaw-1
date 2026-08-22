import { useCallback, useEffect, useState } from 'react';
import { Phone, UserPlus, Search, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { bust } from '@/hooks/useQuery';
import { formatMoney, formatPhone } from '@/lib/format';
import { Button, Input, Combobox, Spinner, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * "KISKA BILL" — number se shuru.
 *
 * Pehle yahan ek naam wala search box tha. Wo counter pe kaam nahi karta:
 * dukaandaar graahak ko naam se nahi, NUMBER se pehchanta hai ("wo 98111 wala
 * bhaiya"). Aur naye graahak ke liye pehle Retailers page pe jaakar entry
 * banani padti thi, phir wapas aakar bill — do jagah ka chakkar, aur beech me
 * aadha bhara hua bill khoya.
 *
 * Ab teen halat hain, teeno ek hi jagah:
 *
 *   1. number mila           → seedha aage, udhaar bhi saamne dikh jata hai
 *   2. number naya hai       → wahin naam bhar kar bana lo, page badla hi nahi
 *   3. number kisi aur ka hai → (sirf hadd wale staff ke liye) saaf mana kar
 *                               dete hain, bina naam bataye
 *
 * Naam se dhoondhna hata nahi diya — bahut baar number yaad nahi hota. Wo ek
 * link ke peeche hai, kyunki number wala rasta das me se nau baar chalta hai.
 */
export default function PartyPicker({ value, onChange, disabled }) {
  const toast = useToast();
  const [mode, setMode] = useState('phone');            // 'phone' | 'name'
  const [phone, setPhone] = useState('');
  const debouncedPhone = useDebounce(phone, 400);

  const [state, setState] = useState('idle');           // idle | searching | found | new | taken
  const [newForm, setNewForm] = useState({ name: '', shopName: '' });
  const [creating, setCreating] = useState(false);

  const digits = debouncedPhone.replace(/\D/g, '');

  useEffect(() => {
    if (value) return undefined;                        // pehle se chuna hua hai
    if (digits.length !== 10) { setState('idle'); return undefined; }

    let alive = true;
    setState('searching');
    api.get('/parties/lookup', { params: { phone: digits, type: 'retailer' } })
      .then((res) => {
        if (!alive) return;
        const { party, takenByOther } = res.data;
        if (party) {
          onChange({
            value: party._id,
            label: party.shopName || party.name,
            raw: party,
          });
          setState('found');
        } else if (takenByOther) {
          setState('taken');
        } else {
          setState('new');
          setNewForm({ name: '', shopName: '' });
        }
      })
      .catch(() => { if (alive) setState('idle'); });

    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, value]);

  const fetchParties = useCallback(async (q) => {
    const res = await api.get('/parties', { params: { type: 'retailer', status: 'active', q, limit: 20 } });
    return res.data.map((p) => ({
      value: p._id, label: p.shopName || p.name, sublabel: p.phone,
      right: p.balance > 0 ? formatMoney(p.balance) : '',
      raw: p,
    }));
  }, []);

  // `phoneArg` null = number wale raste se aaya (jo type kiya wahi lo).
  // Khali string = naam wale raste se aaya, matlab number hai hi nahi.
  async function createParty(phoneArg = null) {
    if (!newForm.name.trim()) { toast.error('Naam to daal dijiye'); return; }
    setCreating(true);
    try {
      const res = await api.post('/parties', {
        type: 'retailer',
        name: newForm.name.trim(),
        shopName: newForm.shopName.trim(),
        // `phoneArg` khali string ho sakti hai — "number hai hi nahi"
        phone: phoneArg === null ? digits : phoneArg,
      });
      const party = res.data;
      onChange({ value: party._id, label: party.shopName || party.name, raw: party });
      setState('found');
      // Retailer ki list bhi taaza — warna naya banda wahan turant nahi dikhta
      bust('parties', 'khata');
      toast.success(`${party.name} jud gaya`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    onChange(null);
    setPhone('');
    setState('idle');
    setNewForm({ name: '', shopName: '' });
  }

  /* ───────────── chun liya — ab bas dikhana hai ───────────── */
  if (value) {
    const raw = value.raw || {};
    const due = Number(raw.balance || 0);
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-brand-700">
            {(value.label || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{value.label}</p>
            <p className="truncate text-xs text-slate-600">
              {raw.name && raw.shopName && raw.name !== value.label ? `${raw.name} · ` : ''}
              {formatPhone(raw.phone || phone)}
            </p>
            {due > 0 && (
              <p className="tabular mt-1 text-xs font-medium text-amber-700">
                {t('Purana udhaar')}: {formatMoney(due)}
                {raw.creditLimit > 0 && (
                  <span className="text-slate-500"> · {t('hadd')} {formatMoney(raw.creditLimit)}</span>
                )}
              </p>
            )}
          </div>
          {!disabled && (
            <Button size="sm" variant="ghost" icon={X} onClick={reset}>{t('Badlein')}</Button>
          )}
        </div>
      </div>
    );
  }

  /* ───────────── naam se dhoondhne wala rasta ───────────── */
  if (mode === 'name') {
    return (
      <div>
        <Combobox
          label={t('Retailer')} required placeholder={t('Naam ya dukaan se dhundhein')}
          display="" value=""
          onChange={(opt) => { onChange(opt); setState('found'); }}
          fetchOptions={fetchParties}
          emptyText={t('Koi active retailer nahi mila')}
        />

        {/*
          BINA NUMBER KE NAYA GRAAHAK.

          Ye poore raste ki jad thi. "Naam se dhoondho" sirf DHOONDHTA tha —
          naya banane ka ek hi rasta tha, number wala. Mandi me aadha graahak
          number deta hi nahi, isliye dukaandaar ya to jhootha number bhar
          deta tha (9999999999, ya apna hi) ya bill app me daalta hi nahi.
          Pehle se list me nakli number bhar jate aur WhatsApp wali yaad-dahani
          galat aadmi ko chali jati; doosre se poori bikri hi hisaab se gayab
          ho jati.
        */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-900">{t('Number nahi hai?')}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('Sirf naam se bhi bill ban jayega. Number baad me kabhi bhi jod sakte hain.')}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label={t('Naam')} value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('Suresh Kumar')} />
            <Input label={t('Dukaan ka naam')} value={newForm.shopName}
              onChange={(e) => setNewForm((f) => ({ ...f, shopName: e.target.value }))}
              placeholder={t('Suresh Auto Store')} hint={t('Bill pe yahi chhapega')} />
          </div>
          <Button className="mt-3" size="sm" icon={CheckCircle2} loading={creating}
            onClick={() => createParty('')} disabled={!newForm.name.trim()}>
            {t('Bina number ke jodein')}
          </Button>
        </div>

        {/* -my-1.5 + py-2 = dikhne me link, par tap ka ghera 32px+ */}
        <button type="button" onClick={() => setMode('phone')}
          className="-my-1.5 mt-2 flex items-center gap-1.5 rounded py-2 text-xs font-medium text-brand-700 hover:underline focus-ring">
          <Phone size={13} /> {t('Number se dhundhein')}
        </button>
      </div>
    );
  }

  /* ───────────── number wala rasta ───────────── */
  return (
    <div>
      <Input
        label={t('Retailer ka phone number')}
        required
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        maxLength={13}
        prefix="+91"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
        placeholder="98765 43210"
        hint={t('10 digit daalte hi purana graahak apne aap nikal aayega')}
      />

      {state === 'searching' && (
        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <Spinner size={13} /> {t('Dhundh raha hoon...')}
        </p>
      )}

      {state === 'taken' && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {t('Ye number kisi aur ke naam hai. Malik se kahiye ki ye retailer aapke naam kar dein.')}
        </p>
      )}

      {state === 'new' && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
            <UserPlus size={15} className="text-brand-600" />
            {t('Naya graahak hai — yahin bana lein')}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('Bas naam chahiye. Address aur GST baad me Retailers page se bhar sakte hain.')}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label={t('Naam')} required autoFocus value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('Suresh Kumar')} />
            <Input label={t('Dukaan ka naam')} value={newForm.shopName}
              onChange={(e) => setNewForm((f) => ({ ...f, shopName: e.target.value }))}
              placeholder={t('Suresh Auto Store')} hint={t('Bill pe yahi chhapega')} />
          </div>

          {/* Seedha `onClick={createParty}` mat likhna — React pehla argument
              me CLICK KA EVENT bhejta hai, aur wo `phoneArg` ban kar phone ki
              jagah chala jata hai */}
          <Button className="mt-3" size="sm" icon={CheckCircle2} loading={creating}
            onClick={() => createParty(null)} disabled={!newForm.name.trim()}>
            {t('Jodkar aage badhein')}
          </Button>
        </div>
      )}

      <button type="button" onClick={() => setMode('name')}
        className={cn('mt-1 flex items-center gap-1.5 rounded py-2 text-xs font-medium text-brand-700 hover:underline focus-ring',
          state === 'new' && 'mt-2')}>
        <Search size={13} /> {t('Number yaad nahi? Naam se dhundhein')}
      </button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Modal, Button, Input, Select, Textarea, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

const blank = {
  name: '', shopName: '', phone: '', email: '',
  address: { line1: '', city: '', state: '', pincode: '' },
  gstin: '', openingBalance: '', creditLimit: '', notes: '',
};

export default function PartyFormModal({ open, onClose, party, type, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(party?._id);
  const isRetailer = type === 'retailer';
  const label = isRetailer ? 'Retailer' : 'Supplier';

  const [form, setForm] = useState(blank);
  const [states, setStates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    api.get('/business/states').then((r) => setStates(r.data.map((s) => s.name))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    if (party?._id) {
      setForm({
        name: party.name || '',
        shopName: party.shopName || '',
        phone: party.phone || '',
        email: party.email || '',
        address: {
          line1: party.address?.line1 || '',
          city: party.address?.city || '',
          state: party.address?.state || '',
          pincode: party.address?.pincode || '',
        },
        gstin: party.gstin || '',
        openingBalance: '',
        creditLimit: String(party.creditLimit ?? ''),
        notes: party.notes || '',
      });
    } else {
      setForm(blank);
    }
  }, [open, party]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setAddr = (k) => (e) => setForm((f) => ({ ...f, address: { ...f.address, [k]: e.target.value } }));

  async function submit(e) {
    e?.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const payload = {
      name: form.name.trim(),
      shopName: form.shopName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address,
      gstin: form.gstin.trim(),
      creditLimit: Number(form.creditLimit || 0),
      notes: form.notes.trim(),
    };

    try {
      if (isEdit) {
        await api.put(`/parties/${party._id}`, payload);
        toast.success('Save ho gaya');
      } else {
        await api.post('/parties', {
          ...payload, type, openingBalance: Number(form.openingBalance || 0),
        });
        toast.success(`${payload.name} add ho gaya`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
      if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `${label} edit karein` : `Naya ${label.toLowerCase()}`}
      description={isEdit ? party?.name : (isRetailer
        ? 'Jo retailer khud link se nahi juda, use yahan se add kar sakte hain'
        : 'Jinse aap maal khareedte hain')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('Cancel')}</Button>
          <Button onClick={submit} loading={saving}>{isEdit ? 'Save karein' : 'Add karein'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Dukaan ka naam')} placeholder={isRetailer ? 'Suresh Auto Store' : 'Sharma Traders'}
            value={form.shopName} onChange={set('shopName')} error={fieldErrors.shopName} />
          <Input label={t('Vyakti ka naam')} required placeholder={t('Suresh Kumar')}
            value={form.name} onChange={set('name')} error={fieldErrors.name} />
          {/*
            EK hi `hint` — pehle DO likhe the.

            JSX me ek hi naam do baar likho to chup-chaap AAKHRI wala jeetta
            hai. Yahan aakhri wala aksar `undefined` hota tha (supplier ke liye,
            aur edit karte waqt bhi) — matlab "Nahi hai to khali chhod dein"
            wali sahaayta un sab jagah gayab thi jahan uski sabse zyada zarurat
            thi. Build sirf ek chetavni deti thi, aur wo dikhti nahi.
          */}
          <Input label={t('Phone (marzi se)')} type="tel" inputMode="numeric" prefix="+91"
            placeholder="98765 43210" value={form.phone} onChange={set('phone')}
            error={fieldErrors.phone}
            hint={isRetailer && !isEdit
              ? t('Isi number se wo link kholkar login karega')
              : t('Nahi hai to khali chhod dein — naam se bhi bill ban jayega')} />
          <Input label={t('Email')} type="email" value={form.email} onChange={set('email')} error={fieldErrors.email} />
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">{t('Address aur GST')}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('Address')} value={form.address.line1} onChange={setAddr('line1')}
              containerClassName="sm:col-span-2" />
            <Input label={t('Sheher')} value={form.address.city} onChange={setAddr('city')} />
            <Select label={t('State')} placeholder={t('State chunein')} options={states}
              value={form.address.state} onChange={setAddr('state')}
              hint={t('Bill pe IGST lagega ya CGST+SGST — isse tay hoga')} />
            <Input label={t('Pincode')} inputMode="numeric" maxLength={6}
              value={form.address.pincode} onChange={setAddr('pincode')}
              error={fieldErrors['address.pincode']} />
            <Input label={t('GSTIN (agar hai)')} value={form.gstin} className="uppercase"
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              placeholder={t('09AAACH7409R1ZZ')} error={fieldErrors.gstin} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-900">{t('Hisaab')}</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isEdit && (
              <Input label={t('Purana hisaab')} type="number" step="0.01" prefix="₹"
                value={form.openingBalance} onChange={set('openingBalance')}
                hint={isRetailer ? 'Inka kitna udhaar pehle se hai' : 'Inka kitna paisa dena hai'} />
            )}
            <Input label={t('Credit limit')} type="number" step="1" min="0" prefix="₹"
              value={form.creditLimit} onChange={set('creditLimit')}
              hint={t('0 = koi limit nahi')} />
          </div>
        </div>

        <Textarea label={t('Note')} rows={2} value={form.notes} onChange={set('notes')}
          placeholder={t('Har mangal ko aata hai / cash me hi deta hai')} />
      </form>
    </Modal>
  );
}

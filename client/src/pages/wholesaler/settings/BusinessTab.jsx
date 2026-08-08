import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Store, Save, CheckCircle2, Smartphone } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Input, Select, Textarea, Card, CardHeader, Switch, useToast } from '@/components/ui';

const emptyAddress = { line1: '', line2: '', city: '', state: '', pincode: '' };

export default function BusinessTab({ business, onSaved }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const fileRef = useRef(null);

  const [states, setStates] = useState([]);
  const [form, setForm] = useState(() => ({
    name: business.name || '',
    phone: business.phone || '',
    email: business.email || '',
    address: { ...emptyAddress, ...(business.address || {}) },
    gstEnabled: Boolean(business.gstEnabled),
    gstin: business.gstin || '',
    invoicePrefix: business.invoicePrefix || 'INV',
    upiId: business.upiId || '',
    upiName: business.upiName || '',
    lowStockThreshold: business.lowStockThreshold ?? 5,
    termsAndConditions: business.termsAndConditions || '',
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    api.get('/business/states').then((res) => setStates(res.data.map((s) => s.name))).catch(() => {});
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setAddr = (key) => (e) =>
    setForm((f) => ({ ...f, address: { ...f.address, [key]: e.target.value } }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: {
          line1: form.address.line1, line2: form.address.line2,
          city: form.address.city, state: form.address.state, pincode: form.address.pincode,
        },
        gstEnabled: form.gstEnabled,
        invoicePrefix: form.invoicePrefix,
        upiId: form.upiId.trim(),
        upiName: form.upiName.trim(),
        lowStockThreshold: Number(form.lowStockThreshold),
        termsAndConditions: form.termsAndConditions,
      };
      if (form.gstEnabled) payload.gstin = form.gstin;

      const res = await api.put('/business/me', payload);
      onSaved(res.data);
      await refresh();
      toast.success('Profile save ho gaya');
    } catch (err) {
      toast.error(err.message);
      if (err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await api.post('/business/logo', fd);
      onSaved({ ...business, logoUrl: res.data.logoUrl });
      await refresh();
      toast.success('Logo lag gaya');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemoveLogo() {
    try {
      await api.delete('/business/logo');
      onSaved({ ...business, logoUrl: '' });
      await refresh();
      toast.info('Logo hata diya');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* ---- Logo ---- */}
      <Card>
        <CardHeader title="Logo" subtitle="Har invoice ke upar chhapega" />
        <div className="flex items-center gap-4">
          {business.logoUrl ? (
            <img src={business.logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Store size={22} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogo} />
            <Button type="button" variant="secondary" size="sm" icon={Upload} loading={uploading}
              onClick={() => fileRef.current?.click()}>
              {business.logoUrl ? 'Badlein' : 'Upload karein'}
            </Button>
            {business.logoUrl && (
              <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={handleRemoveLogo}>
                Hatayein
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">PNG, JPG ya WEBP · 3 MB tak</p>
      </Card>

      {/* ---- Basic details ---- */}
      <Card>
        <CardHeader title="Dukaan ki detail" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Dukaan ka naam" required value={form.name} onChange={set('name')} error={fieldErrors.name} />
          <Input label="Phone" prefix="+91" value={form.phone} onChange={set('phone')} error={fieldErrors.phone} />
          <Input label="Email" type="email" value={form.email} onChange={set('email')}
            containerClassName="sm:col-span-2" error={fieldErrors.email} />
        </div>
      </Card>

      {/* ---- Address ---- */}
      <Card>
        <CardHeader title="Address" subtitle="Invoice pe yahi address aayega" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Address line 1" value={form.address.line1} onChange={setAddr('line1')} containerClassName="sm:col-span-2" />
          <Input label="Address line 2" value={form.address.line2} onChange={setAddr('line2')} containerClassName="sm:col-span-2" />
          <Input label="Sheher" value={form.address.city} onChange={setAddr('city')} />
          <Select label="State" options={states} value={form.address.state}
            onChange={setAddr('state')} placeholder="State chunein"
            hint="Isi se tay hoga CGST+SGST lagega ya IGST" />
          <Input label="Pincode" inputMode="numeric" maxLength={6}
            value={form.address.pincode} onChange={setAddr('pincode')}
            error={fieldErrors['address.pincode']} />
        </div>
      </Card>

      {/* ---- GST ---- */}
      <Card>
        <CardHeader title="GST" />
        <Switch
          id="gst-toggle"
          checked={form.gstEnabled}
          onChange={(v) => setForm((f) => ({ ...f, gstEnabled: v }))}
          label="Meri dukaan GST registered hai"
          description="Off rakha to bill 'Bill of Supply' banega — koi tax column nahi. On karne par 'Tax Invoice' banega."
        />

        {form.gstEnabled && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Input
              label="GSTIN"
              required
              placeholder="09AAACH7409R1ZZ"
              value={form.gstin}
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              className="uppercase tracking-wide"
              hint="15 character. Pehle 2 digit aapke state ke honge."
              error={fieldErrors.gstin}
            />
            {!form.address.state && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Pehle upar State chun lein — GSTIN uske saath match kiya jayega.
              </p>
            )}
          </div>
        )}

        {!form.gstEnabled && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              Bina GST ke bhi poori app chalegi — items, orders, khata, payments sab kuch. Bas bill pe tax nahi lagega.
            </span>
          </div>
        )}
      </Card>

      {/* ---- UPI ---- */}
      <Card>
        <CardHeader
          title="UPI se paisa lena"
          subtitle="Ye daal denge to retailer apne phone se seedha aapko paisa bhej payega"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Aapki UPI ID" value={form.upiId} onChange={set('upiId')}
            placeholder="ramesh@okhdfcbank" error={fieldErrors.upiId}
            hint="GPay/PhonePe app me 'UPI ID' ke naam se milti hai" />
          <Input label="UPI pe naam" value={form.upiName} onChange={set('upiName')}
            placeholder={form.name || 'Ramesh Auto Parts'}
            hint="Retailer ko paisa bhejte waqt yahi naam dikhega" />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Smartphone size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            Retailer ko QR aur "UPI app kholein" ka button dikhega. Paisa bhejne ke baad wo
            "bhej diya" dabayega — aap apna account dekh kar confirm karenge, tabhi khate me lagega.
          </span>
        </div>
      </Card>

      {/* ---- Defaults ---- */}
      <Card>
        <CardHeader title="Default settings" subtitle="Bill aur stock ke chhote settings" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Invoice number prefix" value={form.invoicePrefix} onChange={set('invoicePrefix')}
            hint="Bill aisa dikhega: INV/26-27/0001" />
          <Input label="Low stock warning" type="number" min="0" value={form.lowStockThreshold}
            onChange={set('lowStockThreshold')} hint="Itne se kam stock par alert aayega" />
          <Textarea label="Invoice ke terms & conditions" rows={3} value={form.termsAndConditions}
            onChange={set('termsAndConditions')} containerClassName="sm:col-span-2"
            placeholder="Maal wapas nahi hoga. Payment 30 din me." />
        </div>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" icon={Save} loading={saving} size="lg" className="shadow-lg">
          Save karein
        </Button>
      </div>
    </form>
  );
}

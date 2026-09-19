import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Upload, Trash2, Store, Save, CheckCircle2, QrCode, Landmark, FileText, Info, Plus,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useQuery, bust } from '@/hooks/useQuery';
import {
  PageHeader, Tabs, Button, Input, Select, Textarea, Card, CardHeader, Switch,
  Spinner, useToast,
} from '@/components/ui';
import AccountTab from './settings/AccountTab';
import { t } from '@/lib/i18n';

/**
 * PROFILE — dukaan ki pehchan, paisa lene ka tarika, aur apna account.
 *
 * Ye pehle Settings ke andar do tab me chhupa hua tha. Bahar isliye laya gaya
 * ki ye roz ki cheez hai: UPI ID badalni ho, address theek karna ho, ya bas
 * ye dekhna ho ki bill pe kya chhap raha hai. Ab upar apne naam pe dabate hi
 * seedha yahi khulta hai.
 *
 * Staff ko sirf "Mera account" dikhta hai — dukaan ki pehchan aur paisa lene
 * ka tarika sirf malik ka mamla hai.
 */

const emptyAddress = { line1: '', line2: '', city: '', state: '', pincode: '' };

export default function Profile() {
  const { isOwner, business: authBusiness } = useAuth();
  const [params, setParams] = useSearchParams();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const wanted = params.get('tab');
  const [tab, setTab] = useState(() => (wanted && ['shop', 'pay', 'bill', 'me'].includes(wanted) ? wanted : 'shop'));

  useEffect(() => { if (!isOwner) setTab('me'); }, [isOwner]);

  useEffect(() => {
    api.get('/business/me')
      .then((res) => setBusiness(res.data))
      .finally(() => setLoading(false));
  }, []);

  const changeTab = (next) => {
    setTab(next);
    params.set('tab', next);
    setParams(params, { replace: true });
  };

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400"><Spinner size={28} /></div>;
  }

  return (
    <>
      <PageHeader
        title={t('Profile')}
        subtitle={isOwner
          ? t('Dukaan ki pehchan, paisa lene ka tarika aur apna login')
          : t('Aapka apna login')}
      />

      <Tabs
        value={tab}
        onChange={changeTab}
        tabs={[
          ...(isOwner ? [
            { value: 'shop', label: 'Dukaan' },
            { value: 'pay', label: 'Paisa lena' },
            { value: 'bill', label: 'Bill' },
          ] : []),
          { value: 'me', label: 'Mera account' },
        ]}
      />

      {isOwner && business && tab === 'shop' && (
        <ShopSection business={business} onSaved={setBusiness} />
      )}
      {isOwner && business && tab === 'pay' && (
        <PaySection business={business} onSaved={setBusiness} />
      )}
      {isOwner && business && tab === 'bill' && (
        <BillSection business={business} onSaved={setBusiness} />
      )}
      {tab === 'me' && <AccountTab />}

      {!isOwner && authBusiness?.name && (
        <p className="mt-5 text-center text-xs text-slate-400">
          {t('Dukaan ki detail sirf malik badal sakta hai')}
        </p>
      )}
    </>
  );
}

/** Sab section ek hi tarah save karte hain — isliye ek hi jagah */
function useBusinessSave(onSaved) {
  const toast = useToast();
  const { refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const save = async (payload, message = 'Save ho gaya') => {
    setSaving(true);
    setFieldErrors({});
    try {
      const res = await api.put('/business/me', payload);
      onSaved(res.data);
      await refresh();
      toast.success(message);
      return true;
    } catch (err) {
      toast.error(err.message);
      if (err.details) setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, fieldErrors };
}

function SaveBar({ saving }) {
  return (
    <div className="sticky bottom-20 flex justify-end lg:bottom-4">
      <Button type="submit" icon={Save} loading={saving} size="lg" className="shadow-lg">
        {t('Save karein')}
      </Button>
    </div>
  );
}

/* ══════════════════════════════ Story — WhatsApp Status jaisa ══════════════════════════════ */

function StoriesCard() {
  const toast = useToast();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(null); // { file, previewUrl }
  const [caption, setCaption] = useState('');

  const { data: stories } = useQuery(['my-stories'], () => api.get('/stories').then((r) => r.data));

  function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPending({ file, previewUrl: URL.createObjectURL(file) });
  }

  function cancelPending() {
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setCaption('');
  }

  async function post() {
    if (!pending) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', pending.file);
      if (caption.trim()) fd.append('caption', caption.trim());
      await api.post('/stories', fd);
      toast.success(t('Story lag gayi'));
      cancelPending();
      bust('my-stories');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/stories/${id}`);
      bust('my-stories');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <Card>
      <CardHeader title={t('Story')} subtitle={t('24 ghante ke liye rehti hai — jude hue retailer dekh sakenge')} />

      <div className="flex flex-wrap gap-2">
        {stories?.map((s) => (
          <div key={s._id} className="group relative h-20 w-20 overflow-hidden rounded-lg ring-1 ring-slate-200">
            <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-0.5 left-0.5 rounded bg-black/50 px-1 text-[10px] text-white">
              {t('{n} dekhi', { n: s.viewCount })}
            </span>
            <button
              type="button"
              onClick={() => remove(s._id)}
              aria-label={t('Hatayein')}
              className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-red-600 shadow focus-ring"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={pickFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-600 focus-ring"
        >
          <Plus size={22} />
        </button>
      </div>

      {pending && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 p-2">
          <img src={pending.previewUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
          <Input value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder={t('Caption (marzi se)')} containerClassName="flex-1" />
          <Button size="sm" variant="ghost" onClick={cancelPending}>{t('Rehne dein')}</Button>
          <Button size="sm" loading={uploading} onClick={post}>{t('Post karein')}</Button>
        </div>
      )}
    </Card>
  );
}

/* ══════════════════════════════ 1. Dukaan ══════════════════════════════ */

function ShopSection({ business, onSaved }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const fileRef = useRef(null);
  const coverFileRef = useRef(null);
  const navigate = useNavigate();
  const [states, setStates] = useState([]);
  const [gstReady, setGstReady] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const { save, saving, fieldErrors } = useBusinessSave(onSaved);

  const [form, setForm] = useState(() => ({
    name: business.name || '',
    phone: business.phone || '',
    email: business.email || '',
    bio: business.bio || '',
    address: { ...emptyAddress, ...(business.address || {}) },
    gstEnabled: Boolean(business.gstEnabled),
    gstin: business.gstin || '',
  }));

  useEffect(() => {
    api.get('/business/states').then((res) => setStates(res.data.map((s) => s.name))).catch(() => {});
    // "Kitne item pe rate/HSN nahi hai" — chetavni isi se banti hai
    api.get('/items/gst-ready').then((res) => setGstReady(res.data)).catch(() => {});
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setAddr = (key) => (e) => setForm((f) => ({ ...f, address: { ...f.address, [key]: e.target.value } }));

  async function handleSave(e) {
    e.preventDefault();
    const payload = {
      name: form.name, phone: form.phone, email: form.email, bio: form.bio,
      address: { ...form.address },
      gstEnabled: form.gstEnabled,
    };
    if (form.gstEnabled) payload.gstin = form.gstin;
    await save(payload, 'Dukaan ki detail save ho gayi');
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

  async function removeLogo() {
    try {
      await api.delete('/business/logo');
      onSaved({ ...business, logoUrl: '' });
      await refresh();
      toast.info('Logo hata diya');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleCoverPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append('coverPhoto', file);
      const res = await api.post('/business/cover-photo', fd);
      onSaved({ ...business, coverPhotoUrl: res.data.coverPhotoUrl });
      await refresh();
      toast.success(t('Cover photo lag gayi'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCoverUploading(false);
      if (coverFileRef.current) coverFileRef.current.value = '';
    }
  }

  async function removeCoverPhoto() {
    try {
      await api.delete('/business/cover-photo');
      onSaved({ ...business, coverPhotoUrl: '' });
      await refresh();
      toast.info(t('Cover photo hata di'));
    } catch (err) {
      toast.error(err.message);
    }
  }

  /*
   * Approval toggle — turant save hota hai, "Save karein" button ka
   * intezaar nahi karta (InviteCard.jsx me bhi yahi tarika hai, wahin se
   * bhi ye setting badli ja sakti hai).
   */
  async function toggleApproval(value) {
    try {
      const res = await api.put('/business/me', { autoApproveRetailers: value });
      onSaved(res.data);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <Card padding={false}>
        <div className="p-5 pb-0">
          <CardHeader title={t('Cover photo')} subtitle={t('Retailer jab aapki dukaan kholega, sabse upar yahi dikhega')} />
        </div>
        <div className="relative mx-5 mb-5 h-32 overflow-hidden rounded-lg bg-slate-100 sm:h-40">
          {business.coverPhotoUrl ? (
            <img src={business.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Store size={32} />
            </div>
          )}
          <div className="absolute bottom-2 right-2 flex flex-wrap justify-end gap-2">
            <input ref={coverFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCoverPhoto} />
            <Button type="button" variant="secondary" size="sm" icon={Upload} loading={coverUploading}
              onClick={() => coverFileRef.current?.click()}>
              {business.coverPhotoUrl ? t('Badlein') : t('Upload karein')}
            </Button>
            {business.coverPhotoUrl && (
              <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={removeCoverPhoto}>
                {t('Hatayein')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <StoriesCard />

      <Card>
        <CardHeader title={t('Logo')} subtitle={t('Har invoice ke upar chhapega')} />
        <div className="flex items-center gap-4">
          {business.logoUrl ? (
            <img src={business.logoUrl} alt={t('Logo')} className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Store size={22} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogo} />
            <Button type="button" variant="secondary" size="sm" icon={Upload} loading={uploading}
              onClick={() => fileRef.current?.click()}>
              {business.logoUrl ? t('Badlein') : t('Upload karein')}
            </Button>
            {business.logoUrl && (
              <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={removeLogo}>
                {t('Hatayein')}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">{t('PNG, JPG ya WEBP · 3 MB tak')}</p>
      </Card>

      <Card>
        <CardHeader title={t('Dukaan ki detail')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Dukaan ka naam')} required value={form.name} onChange={set('name')} error={fieldErrors.name} />
          <Input label={t('Phone')} prefix="+91" value={form.phone} onChange={set('phone')} error={fieldErrors.phone} />
          <Input label={t('Email')} type="email" value={form.email} onChange={set('email')}
            containerClassName="sm:col-span-2" error={fieldErrors.email} />
          <Textarea label={t('Bio')} rows={2} maxLength={300} value={form.bio} onChange={set('bio')}
            containerClassName="sm:col-span-2" error={fieldErrors.bio}
            placeholder={t('Chhota parichay — jaise "10 saal se auto parts ka thok kaam"')}
            hint={t('{n}/300', { n: form.bio.length })} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t('Retailer approval')} />
        <Switch
          id="profile-auto-approve"
          checked={Boolean(business.autoApproveRetailers)}
          onChange={toggleApproval}
          label={t('Apne aap approve kar do')}
          description={t('On karne par koi bhi retailer aapki dukaan seedha dekh aur order kar sakega — approval ka intezaar nahi karna padega. Off rakhne par har naye retailer ko pehle aapki manzoori chahiye hogi.')}
        />
      </Card>

      <Card>
        <CardHeader title={t('Address')} subtitle={t('Invoice pe yahi address aayega')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Address line 1')} value={form.address.line1} onChange={setAddr('line1')} containerClassName="sm:col-span-2" />
          <Input label={t('Address line 2')} value={form.address.line2} onChange={setAddr('line2')} containerClassName="sm:col-span-2" />
          <Input label={t('Sheher')} value={form.address.city} onChange={setAddr('city')} />
          <Select label={t('State')} options={states} value={form.address.state}
            onChange={setAddr('state')} placeholder={t('State chunein')}
            hint={t('Isi se tay hoga CGST+SGST lagega ya IGST')} />
          <Input label={t('Pincode')} inputMode="numeric" maxLength={6}
            value={form.address.pincode} onChange={setAddr('pincode')}
            error={fieldErrors['address.pincode']} />
        </div>
      </Card>

      <Card>
        <CardHeader title="GST" />
        <Switch
          id="gst-toggle"
          checked={form.gstEnabled}
          onChange={(v) => setForm((f) => ({ ...f, gstEnabled: v }))}
          label={t('Meri dukaan GST registered hai')}
          description={t("Off rakha to bill 'Bill of Supply' banega — koi tax column nahi. On karne par 'Tax Invoice' banega.")}
        />

        {/*
          GST ON karne se PEHLE bata do ki kitna kaam baaki hai.

          Ye chetavni na hone se ek chup-chaap nuksaan hota tha: GST ON karte
          hi bill "TAX INVOICE" ban jata hai, par jin item pe rate 0 hai unpe
          tax lagta hi nahi. Bill dekhne me poora sahi lagta hai — bas usme tax
          hai hi nahi. Ye mahino chalta rehta hai aur pakda tab jata hai jab CA
          return bharne baithta hai, aur tab tak wo bill graahak ke paas ja
          chuke hote hain.
        */}
        {form.gstEnabled && gstReady && !gstReady.ready && (
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-3 text-xs text-amber-900">
            <p className="font-medium">
              {gstReady.zeroRate > 0 && `${gstReady.zeroRate} item pe GST rate nahi hai`}
              {gstReady.zeroRate > 0 && gstReady.noHsn > 0 && ' · '}
              {gstReady.noHsn > 0 && `${gstReady.noHsn} pe HSN nahi hai`}
            </p>
            <p className="mt-1">
              {t('Un item ka bill 0% tax ka banega. Items page se rate bhar lein.')}
            </p>
            {gstReady.samples?.length > 0 && (
              <p className="mt-1 text-amber-700">
                {gstReady.samples.map((x) => x.name).join(', ')}
                {gstReady.zeroRate + gstReady.noHsn > gstReady.samples.length && ' …'}
              </p>
            )}
            <button type="button" onClick={() => navigate('/items')}
              className="mt-2 font-medium underline focus-ring">
              {t('Items page kholein')}
            </button>
          </div>
        )}

        {form.gstEnabled && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Input label={t('GSTIN')} required placeholder={t('09AAACH7409R1ZZ')}
              value={form.gstin}
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              className="uppercase tracking-wide"
              hint={t('15 character. Pehle 2 digit aapke state ke honge.')}
              error={fieldErrors.gstin} />
            {!form.address.state && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t('Pehle upar State chun lein — GSTIN uske saath match kiya jayega.')}
              </p>
            )}
          </div>
        )}

        {!form.gstEnabled && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>{t('Bina GST ke bhi poori app chalegi — items, orders, khata, payments sab kuch. Bas bill pe tax nahi lagega.')}</span>
          </div>
        )}
      </Card>

      <SaveBar saving={saving} />
    </form>
  );
}

/* ═══════════════════════════ 2. Paisa lena ═══════════════════════════ */

function PaySection({ business, onSaved }) {
  const { save, saving, fieldErrors } = useBusinessSave(onSaved);
  const [form, setForm] = useState(() => ({
    bankName: business.bankName || '',
    bankAccountName: business.bankAccountName || '',
    bankAccountNumber: business.bankAccountNumber || '',
    bankIfsc: business.bankIfsc || '',
  }));

  /*
    DO YA ZYADA UPI (Part 49) — poori list yahan. Kabhi kisi ka bhi UPI ID
    khaali na chhode isliye purana single-UPI data bhi yahin dikh jaata hai:
    agar `upiAccounts` khaali hai par purana `upiId` bhara hua hai (naye
    field se pehle ka account), usi ko pehli row bana dete hain — warna
    purana UPI "gayab" lagta.
  */
  const [accounts, setAccounts] = useState(() => {
    if (business.upiAccounts?.length) {
      return business.upiAccounts.map((a) => ({ _id: a._id, label: a.label || '', upiId: a.upiId || '' }));
    }
    if (business.upiId) return [{ label: business.upiName || '', upiId: business.upiId }];
    return [];
  });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function setAccount(i, key, value) {
    setAccounts((list) => list.map((a, idx) => (idx === i ? { ...a, [key]: value } : a)));
  }
  function addAccount() {
    setAccounts((list) => [...list, { label: '', upiId: '' }]);
  }
  function removeAccount(i) {
    setAccounts((list) => list.filter((_, idx) => idx !== i));
  }

  async function handleSave(e) {
    e.preventDefault();
    await save({
      upiAccounts: accounts
        .filter((a) => a.upiId.trim())
        .map((a) => ({ label: a.label.trim(), upiId: a.upiId.trim() })),
      bankName: form.bankName.trim(),
      bankAccountName: form.bankAccountName.trim(),
      bankAccountNumber: form.bankAccountNumber.trim(),
      bankIfsc: form.bankIfsc.trim().toUpperCase(),
    }, 'Paisa lene ka tarika save ho gaya');
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <Card>
        <CardHeader
          title={t('UPI — QR wala rasta')}
          subtitle={t('Bill pe QR isi se banta hai. Ek se zyada UPI rakh sakte hain — har bill banate waqt chun sakte hain kaunsa use karna hai.')}
        />

        <div className="space-y-3">
          {accounts.map((a, i) => (
            <div key={a._id || i} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <Input
                  label={t('UPI ID')}
                  value={a.upiId}
                  onChange={(e) => setAccount(i, 'upiId', e.target.value)}
                  placeholder={t('ramesh@okhdfcbank')}
                  error={i === 0 ? fieldErrors.upiId : undefined}
                  hint={i === 0 ? t("GPay/PhonePe app me 'UPI ID' ke naam se milti hai") : undefined}
                />
                <Input
                  label={t('Kis liye (naam)')}
                  value={a.label}
                  onChange={(e) => setAccount(i, 'label', e.target.value)}
                  placeholder={t('Jaise: Dukaan, Personal, SBI khata')}
                  hint={i === 0 ? t('Bill banate waqt yahi naam dikhega chunne ke liye') : undefined}
                />
              </div>
              <button
                type="button"
                onClick={() => removeAccount(i)}
                aria-label={t('Hatayein')}
                className="mt-6 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-ring"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addAccount}>
            {t('Naya UPI jodein')}
          </Button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-900">
          <QrCode size={14} className="mt-0.5 shrink-0" />
          <span>{t('Har bill pe baaki rakam ka QR apne aap ban jayega — retailer ko rakam bharni bhi nahi padegi.')}</span>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t('Bank ka khata — likhne wala rasta')}
          subtitle={t('Ye bill pe likha jayega, taaki NEFT/IMPS karne wale seedha daal sakein.')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Bank ka naam')} value={form.bankName} onChange={set('bankName')}
            placeholder={t('HDFC Bank')} />
          <Input label={t('Khate pe naam')} value={form.bankAccountName} onChange={set('bankAccountName')}
            placeholder={business.name || ''} />
          <Input label={t('Account number')} value={form.bankAccountNumber} onChange={set('bankAccountNumber')}
            inputMode="numeric" error={fieldErrors.bankAccountNumber} />
          <Input label={t('IFSC')} value={form.bankIfsc}
            onChange={(e) => setForm((f) => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))}
            className="uppercase tracking-wide" placeholder={t('HDFC0001234')}
            error={fieldErrors.bankIfsc} />
        </div>

        {/*
          Ye sawal har koi poochta hai, isliye jawab yahin likha hai — support
          me nahi. "Account number daal diya, QR kyun nahi bana?"
        */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <Info size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            {t('Account number aur IFSC se QR nahi ban sakta — UPI ka QR sirf UPI ID (naam@bank) se banta hai. Isliye account wali detail bill pe likhi jati hai, aur QR upar wali UPI ID se banta hai.')}
          </span>
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <Landmark size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <p className="text-xs text-slate-500">
            {t('Dono me se jo bhara hoga wahi bill pe aayega. Dono bhar denge to QR bhi rahega aur account bhi — retailer jo chahe use kar lega.')}
          </p>
        </div>
      </Card>

      <SaveBar saving={saving} />
    </form>
  );
}

/* ═══════════════════════════ 3. Bill ki setting ═══════════════════════════ */

function BillSection({ business, onSaved }) {
  const { save, saving } = useBusinessSave(onSaved);
  const [form, setForm] = useState(() => ({
    invoicePrefix: business.invoicePrefix || 'INV',
    lowStockThreshold: business.lowStockThreshold ?? 5,
    deliveryCharge: business.deliveryCharge || '',
    termsAndConditions: business.termsAndConditions || '',
  }));

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSave(e) {
    e.preventDefault();
    await save({
      invoicePrefix: form.invoicePrefix,
      lowStockThreshold: Number(form.lowStockThreshold),
      deliveryCharge: Number(form.deliveryCharge || 0),
      termsAndConditions: form.termsAndConditions,
    }, 'Bill ki setting save ho gayi');
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <Card>
        <CardHeader title={t('Bill aur stock')} subtitle={t('Bill aur stock ke chhote settings')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('Invoice number prefix')} value={form.invoicePrefix} onChange={set('invoicePrefix')}
            hint={t('Bill aisa dikhega: INV/26-27/0001')} />
          <Input label={t('Low stock warning')} type="number" min="0" value={form.lowStockThreshold}
            onChange={set('lowStockThreshold')} hint={t('Itne se kam stock par alert aayega')} />
          <Input label={t('Delivery charge')} type="number" min="0" step="0.01" prefix="₹" value={form.deliveryCharge}
            onChange={set('deliveryCharge')} hint={t('Har bill mein apne aap jud jaata hai — bill banate waqt bhi badal sakte hain')} />
          <Textarea label={t('Invoice ke terms & conditions')} rows={3} value={form.termsAndConditions}
            onChange={set('termsAndConditions')} containerClassName="sm:col-span-2"
            placeholder={t('Maal wapas nahi hoga. Payment 30 din me.')} />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
          <span>{t('Ye shart har naye bill ke neeche chhapegi. Purane bill jaise the waise hi rahenge.')}</span>
        </div>
      </Card>

      <SaveBar saving={saving} />
    </form>
  );
}

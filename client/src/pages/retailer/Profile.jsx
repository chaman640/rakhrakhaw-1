import { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { Save, KeyRound, LogOut, Store } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatPhone, formatMoney } from '@/lib/format';
import {
  PageHeader, Card, CardHeader, Button, Input, Select, Badge, useToast } from
'@/components/ui';

export default function Profile() {
  const { user, party, business, refresh, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [states, setStates] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || '',
    shopName: party?.shopName || '',
    gstin: party?.gstin || '',
    address: {
      line1: party?.address?.line1 || '',
      city: party?.address?.city || '',
      state: party?.address?.state || '',
      pincode: party?.address?.pincode || ''
    }
  });
  const [saving, setSaving] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    api.get('/business/states').then((res) => setStates(res.data.map((s) => s.name))).catch(() => {});
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setAddr = (key) => (e) => setForm((f) => ({ ...f, address: { ...f.address, [key]: e.target.value } }));

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile', form);
      await refresh();
      toast.success('Profile save ho gaya');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(e) {
    e.preventDefault();
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', pw);
      setPw({ currentPassword: '', newPassword: '' });
      toast.success('Password badal gaya');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPwLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <PageHeader title={t("Profile")} subtitle={t("Aapki dukaan ki detail")} />

      <div className="space-y-5">
        {/* Kis wholesaler se jude hain */}
        <Card>
          <div className="flex items-center gap-4">
            {business?.logoUrl ?
            <img src={business.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200" /> :

            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Store size={20} />
              </div>
            }
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-500">{t("Aap jude hain")}</p>
              <p className="truncate font-medium text-slate-900">{business?.name}</p>
            </div>
            <Badge tone={party?.status === 'active' ? 'green' : 'amber'}>
              {party?.status === 'active' ? 'Active' : 'Approval baaki'}
            </Badge>
          </div>

          {typeof party?.balance === 'number' && party.balance > 0 &&
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {t('Aapka udhaar')}: <strong>{formatMoney(party.balance)}</strong>
            </p>
          }
        </Card>

        <Card>
          <CardHeader title={t("Dukaan ki detail")} />
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t("Dukaan ka naam")} value={form.shopName} onChange={set('shopName')} />
              <Input label={t("Aapka naam")} required value={form.name} onChange={set('name')} />
              <Input label={t("Phone")} value={formatPhone(user?.phone)} disabled
              hint={t("Login number badal nahi sakta")} />
              <Input label={t("GSTIN (agar hai)")} value={form.gstin}
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              className="uppercase" placeholder={t("09AAACH7409R1ZZ")} />
              <Input label={t("Address")} value={form.address.line1} onChange={setAddr('line1')}
              containerClassName="sm:col-span-2" />
              <Input label={t("Sheher")} value={form.address.city} onChange={setAddr('city')} />
              <Select label={t("State")} options={states} value={form.address.state}
              onChange={setAddr('state')} placeholder={t("State chunein")} />
              <Input label={t("Pincode")} inputMode="numeric" maxLength={6}
              value={form.address.pincode} onChange={setAddr('pincode')} />
            </div>
            <Button type="submit" icon={Save} loading={saving}>{t("Save karein")}</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={t("Password badlein")} />
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t("Purana password")} type="password" required
              value={pw.currentPassword}
              onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} />
              <Input label={t("Naya password")} type="password" required autoComplete="new-password"
              value={pw.newPassword}
              onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} />
            </div>
            <Button type="submit" icon={KeyRound} loading={pwLoading}>{t("Password badlein")}</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={t("Logout")} />
          <Button variant="danger" icon={LogOut} onClick={handleLogout}>{t("Logout")}</Button>
        </Card>
      </div>
    </>);

}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Button, Input, Spinner } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * Staff yahan aata hai jab malik ka invite link kholta hai.
 * URL: /join-staff/<token>
 *
 * Role aur ijazat pehle se tay hoti hai — yahan sirf naam, number aur apna
 * password bharna hota hai. Password kabhi malik ke paas nahi jata.
 */
export default function JoinStaff() {
  const { token } = useParams();
  const { joinAsStaff } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');

  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    let alive = true;
    api.get(`/staff/invites/${token}`).
    then((res) => {
      if (!alive) return;
      setInvite(res.data);
      // Malik ne number pehle se baandh diya ho to wahi bhar dete hain
      if (res.data.lockedPhone) {
        setForm((f) => ({ ...f, phone: res.data.lockedPhone }));
      }
    }).
    catch((err) => {if (alive) setLinkError(err.message);}).
    finally(() => {if (alive) setChecking(false);});
    return () => {alive = false;};
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      await joinAsStaff(token, form);
      navigate('/home', { replace: true });
    } catch (err) {
      setError(err.message);
      if (Array.isArray(err.details)) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">
        <Spinner size={28} />
      </div>);

  }

  if (linkError) {
    return (
      <AuthShell title={t('Link kaam nahi kar rahi')}>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle size={20} />
          </div>
          <p className="text-sm text-slate-600">{linkError}</p>
          <p className="mt-2 text-xs text-slate-500">
            {t('Dukaan ke malik se nayi link mangwa lijiye.')}
          </p>
          <Link to="/login" className="mt-4 text-sm font-medium text-brand-700 hover:underline">
            {t('Login page pe jayein')}
          </Link>
        </div>
      </AuthShell>);

  }

  return (
    <AuthShell
      brandName={invite.businessName}
      logoUrl={invite.logoUrl}
      subtitle={t('Apna login bana lijiye')}>
      
      <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-brand-50 p-3">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-700" />
        <div className="text-sm">
          <p className="font-medium text-brand-900">{t("Aap {a0} ke roop me jud rahe hain", { a0:
              invite.staffRoleLabel })}
          </p>
          {invite.roleHint &&
          <p className="mt-0.5 text-xs text-brand-800">{invite.roleHint}</p>
          }
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('Aapka naam')}
          required
          placeholder={t('Ramesh Kumar')}
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name} />
        
        <Input
          label={t('Phone number')}
          required
          type="tel"
          inputMode="numeric"
          placeholder="9876543210"
          value={form.phone}
          onChange={set('phone')}
          error={fieldErrors.phone}
          disabled={Boolean(invite.lockedPhone)}
          hint={invite.lockedPhone ?
          'Malik ne ye number pehle se bhar diya hai' :
          'Isi number se login karenge'} />
        
        <Input
          label={t('Password banayein')}
          required
          type="password"
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password}
          hint={t('Kam se kam 6 character. Ye sirf aapko pata rahega — malik ko bhi nahi.')} />
        

        {error &&
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        }

        <Button type="submit" className="w-full" loading={loading}>
          {t('Jud jayein')}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        {t('Pehle se account hai?')}{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          {t('Login karein')}
        </Link>
      </p>
    </AuthShell>);

}

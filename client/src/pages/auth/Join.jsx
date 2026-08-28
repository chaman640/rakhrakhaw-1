import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import OtpStep from '@/components/auth/OtpStep';
import { Button, Input, Spinner } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * Retailer yahan aata hai jab wholesaler ka WhatsApp link kholta hai.
 * URL: /join/ABCD1234
 */
export default function Join() {
  const { inviteCode } = useParams();
  const { signupRetailer } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [checking, setChecking] = useState(true);
  const [linkError, setLinkError] = useState('');

  const [form, setForm] = useState({ name: '', shopName: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  // Do kadam: pehle detail, phir OTP (Signup.jsx me poori wajah)
  const [step, setStep] = useState('form');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const cleanPhone = form.phone.replace(/\D/g, '').slice(-10);

  useEffect(() => {
    let alive = true;
    api.get(`/auth/invite/${inviteCode}`).
    then((res) => {if (alive) setInvite(res.data);}).
    catch((err) => {if (alive) setLinkError(err.message);}).
    finally(() => {if (alive) setChecking(false);});
    return () => {alive = false;};
  }, [inviteCode]);

  function goToOtp(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (cleanPhone.length !== 10) {
      setFieldErrors({ phone: t('Poora 10 digit ka number daalein') });
      return;
    }
    if (form.password.length < 6) {
      setFieldErrors({ password: t('Password kam se kam 6 character ka rakhein') });
      return;
    }
    setStep('otp');
  }

  async function finish(otpToken) {
    setError('');
    setLoading(true);
    try {
      await signupRetailer({ ...form, phone: cleanPhone, inviteCode, otpToken });
      navigate('/pending', { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
      setStep('form');
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
      <AuthShell title={t('Link kaam nahi kar raha')}>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle size={20} />
          </div>
          <p className="text-sm text-slate-600">{linkError}</p>
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
      subtitle={
      <>
          {[invite.city, invite.state].filter(Boolean).join(', ')}
          {(invite.city || invite.state) && <br />}
          {t('Yahan se order karne ke liye apni dukaan register karein')}
        </>
      }
      footer={
      <>
          {t('Pehle se account hai?')}{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            {t('Login karein')}
          </Link>
        </>
      }>
      
      {step === 'otp' ? (
        <OtpStep
          phone={cleanPhone}
          purpose="SIGNUP"
          onVerified={finish}
          onBack={() => setStep('form')}
          note={loading ? t('Account ban raha hai...') : null}
        />
      ) : (
      <form onSubmit={goToOtp} className="space-y-4">
        <Input
          label={t('Aapki dukaan ka naam')}
          required
          placeholder={t('Suresh Auto Store')}
          value={form.shopName}
          onChange={set('shopName')}
          error={fieldErrors.shopName} />
        
        <Input
          label={t('Aapka naam')}
          required
          placeholder={t('Suresh Kumar')}
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name} />
        
        <Input
          label={t('Phone number')}
          required
          type="tel"
          inputMode="numeric"
          prefix="+91"
          placeholder="98765 43210"
          value={form.phone}
          onChange={set('phone')}
          error={fieldErrors.phone} />
        
        <Input
          label={t('Password banayein')}
          required
          type="password"
          autoComplete="new-password"
          placeholder={t('Kam se kam 6 character')}
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password} />
        

        {error && !Object.keys(fieldErrors).length &&
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        }

        <Button type="submit" className="w-full" loading={loading}>
          {t('Aage badhein')}
        </Button>

        <p className="text-center text-xs text-slate-500">{t("Register karne ke baad {a0} approve karenge, phir catalog khul jayega.", { a0:
            invite.businessName })}
        </p>
      </form>
      )}
    </AuthShell>);

}

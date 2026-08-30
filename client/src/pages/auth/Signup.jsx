import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import OtpStep from '@/components/auth/OtpStep';
import { Button, Input } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * DO KADAM: pehle detail, phir OTP.
 *
 * Ulta karne ki koshish ki thi (pehle number verify, phir baaki form). Wo bura
 * tha: aadmi ek SMS ka intezaar karta, phir teen aur khaane bharta, aur beech
 * me OTP ki mohlat khatam ho jati. Ab jab poora form bhara ja chuka hota hai
 * tabhi SMS jata hai — aur verify hote hi account ban jata hai.
 */

export default function Signup() {
  const { signupWholesaler } = useAuth();

  /*
    Salesman ka code — link se aata hai (/signup?ref=ABC123).

    Ye sirf aage bhej diya jata hai; iski jaanch server karta hai. Galat ya
    khali code se signup RUKTA NAHI — bas dukaan kisi ke naam nahi chadhti.
    Signup ko is ek cheez pe rokna sabse bada nuksan hota.
  */
  const [sp] = useSearchParams();
  const refCode = (sp.get('ref') || '').trim().toUpperCase();
  const navigate = useNavigate();

  const [form, setForm] = useState({ businessName: '', name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form');          // 'form' ya 'otp'

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const cleanPhone = form.phone.replace(/\D/g, '').slice(-10);

  /** Pehla kadam — form theek hai to OTP wale kadam pe */
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

  /** OTP verify ho gaya — ab account ban sakta hai */
  async function finish(otpToken) {
    setError('');
    setLoading(true);
    try {
      await signupWholesaler({ ...form, phone: cleanPhone, otpToken, ...(refCode ? { refCode } : {}) });
      navigate('/settings?welcome=1', { replace: true });
    } catch (err) {
      /*
        Yahan tak aakar fail hona kam hota hai (number pehle hi jaancha ja chuka
        hai), par ho sakta hai — jaise usi pal kisi aur ne wahi number le liya.
        Us halat me form pe wapas bhej dete hain, warna aadmi OTP wale kadam pe
        phansa rehta hai jahan wo kuch theek kar hi nahi sakta.
      */
      setError(err.message);
      if (err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t('Wholesaler account')}
      subtitle={t('Do minute me apni dukaan set kar lein')}
      footer={
        <>
          {t('Account pehle se hai?')}{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            {t('Login karein')}
          </Link>
        </>
      }
    >
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
          label={t('Dukaan ka naam')}
          required
          placeholder={t('Ramesh Auto Parts')}
          value={form.businessName}
          onChange={set('businessName')}
          error={fieldErrors.businessName}
        />
        <Input
          label={t('Aapka naam')}
          required
          placeholder={t('Ramesh Kumar')}
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name}
        />
        <Input
          label={t('Phone number')}
          required
          type="tel"
          inputMode="numeric"
          prefix="+91"
          placeholder="98765 43210"
          hint={t('Isi number se login hoga')}
          value={form.phone}
          onChange={set('phone')}
          error={fieldErrors.phone}
        />
        <Input
          label={t('Password')}
          required
          type="password"
          autoComplete="new-password"
          placeholder={t('Kam se kam 6 character')}
          value={form.password}
          onChange={set('password')}
          error={fieldErrors.password}
        />

        {error && !Object.keys(fieldErrors).length && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          {t('Aage badhein')}
        </Button>

        <p className="text-center text-xs text-slate-500">
          {t('Agle kadam me is number pe OTP bhejenge')}
        </p>
      </form>
      )}
    </AuthShell>
  );
}

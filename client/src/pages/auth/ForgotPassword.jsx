import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import AuthShell from '@/components/auth/AuthShell';
import OtpStep from '@/components/auth/OtpStep';
import { Button, Input } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * PASSWORD BHOOL GAYE.
 *
 * Teen kadam: number → OTP → naya password.
 *
 * Pehle iska koi rasta hi nahi tha. Password bhoolne ka matlab tha wholesaler
 * ko phone karna, aur wo bhi kuch nahi kar sakta tha — dukaandaar apne hi app
 * se bahar ho jata tha aur uska poora hisaab andar phansa reh jata tha.
 *
 * Naya password lagne ke baad LOGIN APNE AAP NAHI hota — aadmi ko ek baar khud
 * type karna padta hai. Ek extra kadam lagta hai, par usi ek baar me wo password
 * yaad ho jata hai; apne aap andar ghusa dene se agli baar phir wahi dikkat.
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState('phone');   // phone → otp → password → done
  const [phone, setPhone] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const clean = phone.replace(/\D/g, '').slice(-10);

  function goToOtp(e) {
    e.preventDefault();
    setError('');
    if (clean.length !== 10) {
      setError(t('Poora 10 digit ka number daalein'));
      return;
    }
    setStep('otp');
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError(t('Password kam se kam 6 character ka rakhein'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { phone: clean, otpToken, newPassword: password });
      setStep('done');
    } catch (err) {
      setError(err.message);
      /*
        Mohlat khatam ho gayi to OTP wale kadam pe wapas — warna aadmi naya
        password likhta rehta hai aur har baar wahi error dekhta hai, bina koi
        rasta dikhe.
      */
      if (/mohlat|verify/i.test(err.message)) setStep('otp');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t('Password bhool gaye?')}
      subtitle={t('Apne number pe OTP mangwa kar naya password bana lein')}
      footer={
        <>
          {t('Yaad aa gaya?')}{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            {t('Login karein')}
          </Link>
        </>
      }
    >
      {step === 'phone' && (
        <form onSubmit={goToOtp} className="space-y-4">
          <Input
            label={t('Phone number')}
            required
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            prefix="+91"
            placeholder="98765 43210"
            hint={t('Wahi number jisse aap login karte hain')}
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(''); }}
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full">{t('OTP bhejein')}</Button>
        </form>
      )}

      {step === 'otp' && (
        <OtpStep
          phone={clean}
          purpose="RESET"
          onBack={() => setStep('phone')}
          onVerified={(token) => { setOtpToken(token); setStep('password'); }}
        />
      )}

      {step === 'password' && (
        <form onSubmit={save} className="space-y-4">
          <Input
            label={t('Naya password')}
            required
            type="password"
            autoComplete="new-password"
            placeholder={t('Kam se kam 6 character')}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            {t('Password badal dein')}
          </Button>
        </form>
      )}

      {step === 'done' && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <p className="text-sm font-medium text-slate-900">{t('Naya password lag gaya')}</p>
          <p className="text-sm text-slate-500">{t('Ab usi se login kar lijiye.')}</p>
          <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
            {t('Login karein')}
          </Button>
        </div>
      )}
    </AuthShell>
  );
}

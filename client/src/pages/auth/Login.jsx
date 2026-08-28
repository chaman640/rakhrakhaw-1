import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Button, Input } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ phone: '', password: '' });

  /*
    BAHAR KYUN HUE — pehli hi baar me dikha do (item 24).

    `useState` ke andar padha jata hai, `useEffect` me nahi: ek pal ke liye
    bhi khali login page dikh jaye to aadmi ke man me sawal reh jata hai.
    Padhte hi mita bhi dete hain, warna wahi purani baat har baar login page
    pe chipki rehti.
  */
  const [error, setError] = useState(() => {
    try {
      const why = sessionStorage.getItem('rr_logout_reason') || '';
      if (why) sessionStorage.removeItem('rr_logout_reason');
      return why;
    } catch { return ''; }
  });
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(form.phone, form.password);
      const from = location.state?.from?.pathname;
      if (data.user.role === 'retailer') {
        navigate(data.party?.status === 'active' ? (from || '/shop') : '/pending', { replace: true });
      } else {
        navigate(from || '/home', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t('Rakh Rakhav')}
      subtitle={t('Apne phone number se login karein')}
      footer={
        <>
          {t('Nayi dukaan hai?')}{' '}
          <Link to="/signup" className="font-medium text-brand-700 hover:underline">
            {t('Wholesaler account banayein')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('Phone number')}
          required
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          prefix="+91"
          placeholder="98765 43210"
          value={form.phone}
          onChange={set('phone')}
        />
        <Input
          label={t('Password')}
          required
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={form.password}
          onChange={set('password')}
        />

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          {t('Login')}
        </Button>

        {/*
          "Password bhool gaye" — login button ke NEECHE, upar nahi.

          Upar rakhne par wo password wale khaane ke bilkul paas aa jata hai aur
          jaldi me galti se dab jata hai. Jise sach me zarurat hai wo do second
          ruk kar dhoondh hi leta hai.
        */}
        <p className="text-center">
          <Link to="/forgot" className="text-sm font-medium text-brand-700 hover:underline">
            {t('Password bhool gaye?')}
          </Link>
        </p>

        <p className="text-center text-xs text-slate-500">
          {t('Retailer ho? Apne wholesaler ka bheja hua link kholo.')}
        </p>
      </form>
    </AuthShell>
  );
}

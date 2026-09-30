import { useState } from 'react';
import HelpVideos from '@/components/help/HelpVideos';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { BadgeCheck, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Button, Input } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [params] = useSearchParams();
  const [form, setForm] = useState(() => {
    let company = params.get('c') || '';
    try { if (!company) company = localStorage.getItem('rr_company_code') || ''; } catch { /* private mode */ }
    return { phone: '', password: '', companyCode: company.toUpperCase(), employeeCode: (params.get('e') || '').toUpperCase() };
  });
  const [mode, setMode] = useState(() => (params.get('c') ? 'employee' : 'phone'));

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
      const data = mode === 'employee'
        ? await login('', form.password, { companyCode: form.companyCode.trim().toUpperCase(), employeeCode: form.employeeCode.trim().toUpperCase() })
        : await login(form.phone, form.password);
      if (mode === 'employee') { try { localStorage.setItem('rr_company_code', form.companyCode.trim().toUpperCase()); } catch { /* ignore */ } }
      const from = location.state?.from?.pathname;
      if (data.user.role === 'retailer') {
        navigate(data.party?.status === 'active' ? (from || '/shop') : '/pending', { replace: true });
      } else {
        navigate(from || (data.user.staffRole === 'employee' ? '/emp' : '/menu'), { replace: true });
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
      <HelpVideos placement="login" variant="inline" className="mb-4 w-full justify-center" />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={t('Sign in with')}>
          {[['phone', 'Mobile number', Phone], ['employee', 'Employee ID', BadgeCheck]].map(([m, l, Icon]) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setError(''); }}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium ${mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              <Icon size={15} />{t(l)}
            </button>
          ))}
        </div>
        {mode === 'phone' ? (
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
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('Company code')} required autoCapitalize="characters" placeholder={'RAMES42'} value={form.companyCode}
              onChange={(e) => setForm((f) => ({ ...f, companyCode: e.target.value.toUpperCase() }))} hint={t('Ask your employer')} />
            <Input label={t('Employee ID')} required autoCapitalize="characters" placeholder={'EMP-0001'} value={form.employeeCode}
              onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value.toUpperCase() }))} />
          </div>
        )}
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

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Button, Input } from '@/components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
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
        navigate(from || '/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Rakh Rakhav"
      subtitle="Apne phone number se login karein"
      footer={
        <>
          Nayi dukaan hai?{' '}
          <Link to="/signup" className="font-medium text-brand-700 hover:underline">
            Wholesaler account banayein
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Phone number"
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
          label="Password"
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
          Login
        </Button>

        <p className="text-center text-xs text-slate-500">
          Retailer ho? Apne wholesaler ka bheja hua link kholo.
        </p>
      </form>
    </AuthShell>
  );
}

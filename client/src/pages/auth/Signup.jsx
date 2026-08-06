import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Button, Input } from '@/components/ui';

export default function Signup() {
  const { signupWholesaler } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ businessName: '', name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);
    try {
      await signupWholesaler(form);
      navigate('/settings?welcome=1', { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.details) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Wholesaler account"
      subtitle="Do minute me apni dukaan set kar lein"
      footer={
        <>
          Account pehle se hai?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Login karein
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Dukaan ka naam"
          required
          placeholder="Ramesh Auto Parts"
          value={form.businessName}
          onChange={set('businessName')}
          error={fieldErrors.businessName}
        />
        <Input
          label="Aapka naam"
          required
          placeholder="Ramesh Kumar"
          value={form.name}
          onChange={set('name')}
          error={fieldErrors.name}
        />
        <Input
          label="Phone number"
          required
          type="tel"
          inputMode="numeric"
          prefix="+91"
          placeholder="98765 43210"
          hint="Isi number se login hoga"
          value={form.phone}
          onChange={set('phone')}
          error={fieldErrors.phone}
        />
        <Input
          label="Password"
          required
          type="password"
          autoComplete="new-password"
          placeholder="Kam se kam 6 character"
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
          Account banayein
        </Button>
      </form>
    </AuthShell>
  );
}

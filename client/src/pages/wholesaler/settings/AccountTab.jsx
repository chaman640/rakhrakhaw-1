import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatPhone } from '@/lib/format';
import { Button, Input, Card, CardHeader, useToast } from '@/components/ui';

export default function AccountTab() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('Dono naye password same nahi hain');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password badal gaya');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Aapka account" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Naam</dt>
            <dd className="font-medium text-slate-900">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Login number</dt>
            <dd className="font-medium text-slate-900">{formatPhone(user?.phone)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Password badlein" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Purana password" type="password" required
            value={form.currentPassword} onChange={set('currentPassword')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Naya password" type="password" required autoComplete="new-password"
              value={form.newPassword} onChange={set('newPassword')} hint="Kam se kam 6 character" />
            <Input label="Naya password dobara" type="password" required autoComplete="new-password"
              value={form.confirmPassword} onChange={set('confirmPassword')} />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <Button type="submit" icon={KeyRound} loading={loading}>Password badlein</Button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Logout" subtitle="Is device se nikal jayein" />
        <Button variant="danger" icon={LogOut} onClick={handleLogout}>Logout</Button>
      </Card>
    </div>
  );
}

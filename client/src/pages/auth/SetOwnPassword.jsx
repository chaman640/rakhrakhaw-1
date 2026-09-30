import { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/components/ui';
import { t } from '@/lib/i18n';

/** Shown on first sign-in (or after a reset) until the user replaces the temporary password */
export default function SetOwnPassword() {
  const { user, passwordChanged, logout } = useAuth();
  const [f, setF] = useState({ current: '', next: '', again: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError('');
    if (f.next.length < 6) { setError(t('Password must be at least 6 characters')); return; }
    if (f.next !== f.again) { setError(t('The two passwords do not match')); return; }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: f.current, newPassword: f.next });
      passwordChanged();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <form onSubmit={save} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-700"><KeyRound size={20} /></span>
        <h1 className="mt-3 text-lg font-semibold text-slate-900">{t('Set your own password')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('Hi {n}, you signed in with a temporary password from your employer. Choose a new one to continue.', { n: user?.name?.split(' ')[0] || '' })}</p>
        <div className="mt-4 space-y-3">
          <Input label={t('Temporary password')} type="password" autoComplete="current-password" required value={f.current} onChange={set('current')} />
          <Input label={t('New password')} type="password" autoComplete="new-password" required value={f.next} onChange={set('next')} hint={t('At least 6 characters')} />
          <Input label={t('Repeat new password')} type="password" autoComplete="new-password" required value={f.again} onChange={set('again')} />
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="mt-4 w-full" loading={busy}>{t('Save and continue')}</Button>
        <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><LogOut size={14} />{t('Sign out')}</button>
      </form>
    </div>
  );
}

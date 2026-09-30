import { useEffect, useState } from 'react';
import {
  KeyRound, ShieldCheck, ShieldAlert, Check, Copy, LogOut,
} from 'lucide-react';
import api, { setToken } from './partnerApi';

const input = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900';
const btn = 'w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60';

export function AdminLogin({ onDone }) {
  const [f, setF] = useState({ email: '', password: '' });
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function first(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/admin/login', f);
      if (res.data.twoFactor) setChallenge(res.data.challenge);
      else { setToken(res.data.token, true); onDone(res.data); }
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  async function second(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.post('/admin/login/2fa', { challenge, code });
      setToken(res.data.token, true);
      onDone(res.data);
    } catch (e2) {
      setErr(e2.message);
      if (/expired/i.test(e2.message)) setChallenge('');
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white"><KeyRound size={20} /></div>
        <h1 className="text-xl font-bold text-slate-900">RakhRakhav Admin</h1>
        <p className="text-sm text-slate-500">{challenge ? 'Enter the 6-digit code from your authenticator app' : 'Sign in to the admin panel'}</p>
      </div>
      {!challenge ? (
        <form onSubmit={first} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <input type="email" autoComplete="username" placeholder="Email" required value={f.email} onChange={(e) => setF((p) => ({ ...p, email: e.target.value }))} className={input} />
          <input type="password" autoComplete="current-password" placeholder="Password" required value={f.password} onChange={(e) => setF((p) => ({ ...p, password: e.target.value }))} className={input} />
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
          <button type="submit" disabled={busy} className={btn}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      ) : (
        <form onSubmit={second} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <input inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" required value={code} onChange={(e) => setCode(e.target.value)} className={`${input} text-center text-lg tracking-widest`} />
          <p className="text-xs text-slate-500">Lost your phone? Enter one of your backup codes instead.</p>
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}
          <button type="submit" disabled={busy} className={btn}>{busy ? 'Checking…' : 'Verify'}</button>
          <button type="button" onClick={() => { setChallenge(''); setCode(''); setErr(''); }} className="w-full text-sm text-slate-500">Back</button>
        </form>
      )}
    </div>
  );
}

function TwoFactor({ me, onChanged }) {
  const [setup, setSetup] = useState(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [off, setOff] = useState({ password: '', code: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!setup?.otpauth) return;
    import('qrcode').then((m) => m.default.toDataURL(setup.otpauth, { margin: 1, width: 180 })).then(setQr).catch(() => setQr(''));
  }, [setup]);

  async function start() {
    setErr('');
    try { setSetup((await api.post('/admin/2fa/start')).data); } catch (e) { setErr(e.message); }
  }
  async function confirm(e) {
    e.preventDefault(); setErr('');
    try { const res = await api.post('/admin/2fa/confirm', { code }); setCodes(res.data.backupCodes); setSetup(null); onChanged(); } catch (e2) { setErr(e2.message); }
  }
  async function disable(e) {
    e.preventDefault(); setErr('');
    try { await api.post('/admin/2fa/disable', off); setOff({ password: '', code: '' }); onChanged(); } catch (e2) { setErr(e2.message); }
  }

  if (codes) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={16} />Two-step verification is on</p>
        <p className="text-sm text-slate-600">Save these backup codes somewhere safe. Each works once if you lose your phone. They will not be shown again.</p>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 font-mono text-sm">{codes.map((c) => <span key={c}>{c}</span>)}</div>
        <button type="button" onClick={() => navigator.clipboard?.writeText(codes.join('\n'))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"><Copy size={14} />Copy codes</button>
        <button type="button" onClick={() => setCodes(null)} className="ml-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white">I have saved them</button>
      </div>
    );
  }
  if (me.totpEnabled) {
    return (
      <form onSubmit={disable} className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><ShieldCheck size={16} />Two-step verification is on</p>
        {me.require2fa ? <p className="text-xs text-slate-500">Required for your account by the Super Admin.</p> : (
          <>
            <p className="text-xs text-slate-500">To turn it off, confirm your password and a current code.</p>
            <div className="flex flex-wrap gap-2">
              <input type="password" placeholder="Password" value={off.password} onChange={(e) => setOff({ ...off, password: e.target.value })} className={`${input} w-40 flex-1`} />
              <input inputMode="numeric" placeholder="Code" value={off.code} onChange={(e) => setOff({ ...off, code: e.target.value })} className={`${input} w-28`} />
              <button type="submit" className="rounded-lg border border-red-300 px-3 text-sm font-semibold text-red-700">Turn off</button>
            </div>
          </>
        )}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </form>
    );
  }
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-700"><ShieldAlert size={16} />Two-step verification is off</p>
      {!setup ? (
        <>
          <p className="text-sm text-slate-600">Protect the admin panel with a code from Google Authenticator, Microsoft Authenticator or any TOTP app.</p>
          <button type="button" onClick={start} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Set up now</button>
        </>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          <p className="text-sm text-slate-600">1. Scan this QR code in your authenticator app (or type the key).</p>
          <div className="flex flex-wrap items-center gap-4">
            {qr && <img src={qr} alt="Authenticator QR code" className="h-44 w-44 rounded-lg border border-slate-200" />}
            <code className="break-all rounded bg-slate-100 px-2 py-1 text-xs">{setup.secret}</code>
          </div>
          <p className="text-sm text-slate-600">2. Enter the 6-digit code it shows.</p>
          <div className="flex gap-2">
            <input inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className={`${input} w-36 text-center tracking-widest`} />
            <button type="submit" className="rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white">Turn on</button>
          </div>
        </form>
      )}
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}

function PasswordForm() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  async function go(e) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const res = await api.post('/admin/password', f);
      if (res.data?.token) setToken(res.data.token, true);
      setMsg('Password changed. Other devices have been signed out.');
      setF({ currentPassword: '', newPassword: '' });
    } catch (e2) { setErr(e2.message); }
  }
  return (
    <form onSubmit={go} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input type="password" autoComplete="current-password" placeholder="Current password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} className={`${input} min-w-40 flex-1`} />
        <input type="password" autoComplete="new-password" placeholder="New password (10+ letters & numbers)" required value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} className={`${input} min-w-40 flex-1`} />
        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Change</button>
      </div>
      {msg && <p className="flex items-center gap-1.5 text-sm text-emerald-700"><Check size={14} />{msg}</p>}
      {err && <p className="text-sm text-red-700">{err}</p>}
    </form>
  );
}

export function SecurityPanel({ me, onChanged, onSignedOut }) {
  async function everywhere() {
    if (!window.confirm('Sign out of the admin panel on every device, including this one?')) return;
    try { await api.post('/admin/logout', { everywhere: true }); } catch { /* signing out anyway */ }
    onSignedOut();
  }
  return (
    <div className="space-y-4">
      {me.mustSetup2fa && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">Your account requires two-step verification. Set it up below to open the admin panel.</p>
      )}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-1 font-semibold text-slate-900">{me.name || me.email}</p>
        <p className="text-sm text-slate-500">{me.email} · {me.roleLabel}{me.lastLoginAt ? ` · last sign-in ${new Date(me.lastLoginAt).toLocaleString('en-IN')}` : ''}</p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-3 font-semibold text-slate-900">Two-step verification</p><TwoFactor me={me} onChanged={onChanged} /></section>
      <section className="rounded-xl border border-slate-200 bg-white p-4"><p className="mb-3 font-semibold text-slate-900">Password</p><PasswordForm /></section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-1 font-semibold text-slate-900">Sessions</p>
        <p className="mb-3 text-sm text-slate-500">Lost a device or shared your password by mistake? End every session.</p>
        <button type="button" onClick={everywhere} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700"><LogOut size={14} />Sign out everywhere</button>
      </section>
    </div>
  );
}

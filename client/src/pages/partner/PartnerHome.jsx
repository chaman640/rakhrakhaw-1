import { useCallback, useEffect, useState } from 'react';
import {
  Copy, Check, LogOut, IndianRupee, Store, Clock, Link2, ShieldCheck, Wallet,
} from 'lucide-react';
import api, { getToken, setToken } from './partnerApi';

/*
  SALESMAN KA POORA HISSA — ek hi file me.

  Ye jaan-boojh kar app ke baaki hisse se alag rakha gaya hai: apna login, apna
  layout, apna API. Iska app ke AuthContext, layout ya i18n se koi rishta nahi.

  Do wajah:
    1. Ye system thode dino ka hai. Ise app ke andar guthne se hataana bhi utna
       hi mushkil ho jata jitna banana.
    2. Salesman dukaan ka aadmi hai hi nahi. Use app ke pehre me ghusane ka
       matlab hota har pehre me ek aur "agar salesman hai to..." — aur ek din
       unme se koi ek chhoot jata.
*/

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const dt = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—');

function Field({ label, hint, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Stat({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

/* ─────────────────────────── login / signup ─────────────────────────── */

function Gate({ onDone }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({
    name: '', phone: '', password: '',
    mode: 'upi', upiId: '', accountName: '', accountNumber: '', ifsc: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function go(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = mode === 'login'
        ? await api.post('/login', { phone: f.phone, password: f.password })
        : await api.post('/signup', {
          name: f.name,
          phone: f.phone,
          password: f.password,
          payout: f.mode === 'upi'
            ? { mode: 'upi', upiId: f.upiId }
            : {
              mode: 'bank', accountName: f.accountName,
              accountNumber: f.accountNumber, ifsc: f.ifsc,
            },
        });
      setToken(res.data.token);
      onDone();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700 text-white">
          <IndianRupee size={22} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Rakh Rakhav Partner</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dukaan jodiye, har payment pe ₹30 kamaiye
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {[['login', 'Login'], ['signup', 'Naya account']].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setMode(k); setErr(''); }}
            className={`rounded-md py-2 text-sm font-semibold transition ${
              mode === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={go} className="space-y-3.5 rounded-xl border border-slate-200 bg-white p-5">
        {mode === 'signup' && (
          <Field label="Aapka naam" value={f.name} onChange={set('name')} required />
        )}
        <Field
          label="Mobile number" type="tel" inputMode="numeric"
          value={f.phone} onChange={set('phone')} required
        />
        <Field
          label="Password" type="password" value={f.password} onChange={set('password')} required
          hint={mode === 'signup' ? 'Kam se kam 6 akshar' : undefined}
        />

        {mode === 'signup' && (
          <>
            <div className="border-t border-slate-200 pt-3.5">
              <p className="mb-2 text-sm font-medium text-slate-700">Paisa kahan bhejein?</p>
              <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {[['upi', 'UPI'], ['bank', 'Bank account']].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setF((p) => ({ ...p, mode: k }))}
                    className={`rounded-md py-1.5 text-sm font-semibold ${
                      f.mode === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {f.mode === 'upi' ? (
                <Field
                  label="UPI ID" value={f.upiId} onChange={set('upiId')} required
                  placeholder="naam@okaxis" hint="Isi pe aapka paisa aayega"
                />
              ) : (
                <div className="space-y-3">
                  <Field label="Khate pe naam" value={f.accountName} onChange={set('accountName')} required />
                  <Field
                    label="Account number" inputMode="numeric"
                    value={f.accountNumber} onChange={set('accountNumber')} required
                  />
                  <Field
                    label="IFSC code" value={f.ifsc} onChange={set('ifsc')} required
                    placeholder="SBIN0001234"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Ye detail abhi bhar dein — paisa dete waqt yahi kaam aayegi.
            </p>
          </>
        )}

        {err && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-teal-700 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? 'Ruko...' : mode === 'login' ? 'Login karein' : 'Account banayein'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-slate-500">
        Har dukaan pe zyada se zyada 12 mahine tak ₹30 — yaani ₹360.
      </p>
    </div>
  );
}

/* ─────────────────────────── dashboard ─────────────────────────── */

function Dashboard({ onLogout }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setD((await api.get('/me')).data); } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(d.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard band hai — link neeche dikh hi raha hai */ }
  }

  if (err) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-slate-700">{err}</p>
        <button type="button" onClick={onLogout} className="mt-3 text-sm font-semibold text-teal-700 underline">
          Dobara login karein
        </button>
      </div>
    );
  }

  if (!d) return <div className="py-20 text-center text-slate-400">Ruko...</div>;

  const s = d.salesman;
  const wa = `https://wa.me/?text=${encodeURIComponent(
    `Rakh Rakhav — thok dukaan ka poora hisaab, ek app me. Stock, bill, khata, udhaar sab.\n\n${d.link}`,
  )}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <p className="font-bold text-slate-900">{s.name}</p>
            <p className="text-xs text-slate-500">{s.phone}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {/* Paisa — sabse upar, kyunki wahi dekhne aate hain */}
        <div className="rounded-xl bg-teal-700 p-5 text-white">
          <p className="text-sm text-teal-100">Abhi tak kamaya</p>
          <p className="text-4xl font-bold">{inr(s.earnedRupees)}</p>
          <div className="mt-4 flex gap-6 border-t border-teal-600 pt-3 text-sm">
            <span><span className="text-teal-200">Mil chuka:</span> {inr(s.paidRupees)}</span>
            <span className="font-semibold"><span className="text-teal-200 font-normal">Baaki:</span> {inr(s.baakiRupees)}</span>
          </div>
        </div>

        {/* Link — asli kaam ka auzaar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Link2 size={15} /> Aapka link
          </p>
          <div className="mb-3 break-all rounded-lg bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-700">
            {d.link}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copied ? <><Check size={15} className="text-emerald-600" /> Copy ho gaya</> : <><Copy size={15} /> Copy karein</>}
            </button>
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center rounded-lg bg-teal-700 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              WhatsApp pe bhejein
            </a>
          </div>
          <p className="mt-2.5 text-xs text-slate-500">
            Is link se jo dukaan account banayegi, wo aapke naam chadh jayegi. Payment
            hote hi ₹{d.rate} aapke khaate me aa jayega — {d.maxMahine} mahine tak.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat icon={Store} label="Dukaanein judi" value={d.ginti.jude} />
          <Stat icon={IndianRupee} label="Paisa de rahi hain" value={d.ginti.paisaDeneWale} tone="green" />
          <Stat icon={Clock} label="Abhi tak nahi" value={d.ginti.abhiTakNahi} tone="amber" />
        </div>

        {/* Dukaanein */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            Aapki jodi hui dukaanein
          </p>
          {d.dukaanein.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Abhi koi dukaan nahi judi. Upar wala link bhejna shuru kijiye.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {d.dukaanein.map((r) => (
                <div key={r._id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{r.shopName}</p>
                    <p className="text-xs text-slate-500">
                      {dt(r.juda)} ko judi
                      {r.mahine > 0 && ` · ${r.mahine}/${d.maxMahine} mahine`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold ${r.kamaiRupees > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {inr(r.kamaiRupees)}
                    </p>
                    {r.mahine === 0 && <p className="text-[11px] text-amber-700">payment baaki</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kab kitna mila */}
        {d.milaHua.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
              Aapko kab kitna mila
            </p>
            <div className="divide-y divide-slate-100">
              {d.milaHua.map((p) => (
                <div key={p._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-600">
                    {dt(p.kab)}{p.reference && <span className="ml-2 text-xs text-slate-400">{p.reference}</span>}
                  </span>
                  <span className="font-semibold text-slate-900">{inr(p.rupees)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <Wallet size={15} className="mt-0.5 shrink-0 text-slate-400" />
          <span>
            Paisa aapke {s.payout?.mode === 'bank' ? 'bank account' : 'UPI'} pe bheja jayega
            {s.payout?.mode === 'bank'
              ? ` — ${s.payout.accountNumber}`
              : ` — ${s.payout?.upiId}`}.
            Badalna ho to bataiye.
          </span>
        </div>

        <p className="flex items-center justify-center gap-1.5 pb-6 text-xs text-slate-400">
          <ShieldCheck size={13} /> Pehle se judi dukaan dobara jodne pe paisa nahi milta
        </p>
      </main>
    </div>
  );
}

export default function PartnerHome() {
  const [logged, setLogged] = useState(() => Boolean(getToken()));

  const logout = () => { setToken('', false); setLogged(false); };

  return logged
    ? <Dashboard onLogout={logout} />
    : <Gate onDone={() => setLogged(true)} />;
}

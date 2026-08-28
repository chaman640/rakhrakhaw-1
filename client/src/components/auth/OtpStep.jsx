import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * OTP WALA KADAM — signup aur "password bhool gaye", dono ke liye ek hi.
 *
 * Teen jagah lagta hai (wholesaler signup, retailer join, forgot password).
 * Teen jagah teen baar likhne ka matlab hota teen jagah alag alag bugs — aur
 * OTP wo cheez hai jahan ek chhoti si galti aadmi ko app se hi bahar kar deti
 * hai. Isliye ek hi component, teenon jagah wahi.
 *
 * Kholte hi OTP apne aap chala jata hai — ek extra button ("bhejein") sirf ek
 * extra tap hai, kyunki yahan aane ka matlab hi hai ki OTP chahiye.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEV ME CODE SCREEN PE.
 *
 * Server bina SMS wali key ke chalta hai (tab code log me chhapta hai), aur us
 * halat me wahi code jawab me bhi aata hai. Wo yahan ek saaf peele dabbe me
 * dikh jata hai, taaki app banate waqt baar baar terminal na kholna pade.
 *
 * Production me ye kabhi nahi aata — server wahan bhejta hi nahi.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function OtpStep({ phone, purpose, onVerified, onBack, title, note }) {
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [devCode, setDevCode] = useState('');
  const [wait, setWait] = useState(0);

  const inputRef = useRef(null);
  const sentOnce = useRef(false);

  const send = useCallback(async () => {
    setSending(true);
    setError('');
    setInfo('');
    try {
      const res = await api.post('/auth/otp/send', { phone, purpose });
      setInfo(res.message);
      setDevCode(res.data?.devCode || '');
      setWait(res.data?.resendAfterSec || 60);
      inputRef.current?.focus();
    } catch (err) {
      setError(err.message);
      /*
        "60 second baad bhej sakte hain" — ye galti nahi, sirf intezaar hai.
        Us halat me bhi ginti chalu kar dete hain, warna aadmi baar baar dabata
        rehta hai aur har baar wahi laal message dekhta hai.
      */
      const secs = Number(String(err.message).match(/(\d+)\s*second/)?.[1] || 0);
      if (secs > 0) setWait(secs);
    } finally {
      setSending(false);
    }
  }, [phone, purpose]);

  // Kholte hi ek baar — `useRef` isliye ki React dev mode do baar mount karta
  // hai, aur bina rok ke do SMS chale jate (aur doosra "60 second ruko" khata)
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send();
  }, [send]);

  // Dobara bhejne ki ulti ginti
  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setInterval(() => setWait((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(id);
  }, [wait]);

  async function verify(e) {
    e?.preventDefault();
    if (code.length !== 6) {
      setError(t('Poora 6 ank ka OTP daalein'));
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const res = await api.post('/auth/otp/verify', { phone, purpose, code });
      await onVerified(res.data.otpToken);
    } catch (err) {
      setError(err.message);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg bg-brand-50 px-3 py-3 text-sm text-brand-900">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">{title || t('Number verify karein')}</p>
          <p className="mt-0.5 text-brand-800">
            {t('6 ank ka OTP {a} pe bheja hai', { a: `+91 ${phone}` })}
          </p>
          {note && <p className="mt-1 text-xs text-brand-700">{note}</p>}
        </div>
      </div>

      {devCode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-medium">{t('Test ke liye OTP:')}</span>{' '}
          <span className="tabular text-base font-semibold tracking-widest">{devCode}</span>
          <p className="mt-0.5 text-xs text-amber-700">
            {t('SMS ki setting nahi lagi hai, isliye yahan dikha diya. Live pe ye kabhi nahi dikhega.')}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="otp-code" className="mb-1.5 block text-sm font-medium text-slate-700">
          {t('OTP')}
        </label>
        <input
          id="otp-code"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          placeholder="••••••"
          className="h-14 w-full rounded-lg border border-slate-300 bg-white text-center text-2xl font-semibold
                     tracking-[0.5em] text-slate-900 placeholder:tracking-[0.4em] placeholder:text-slate-300
                     hover:border-slate-400 focus-ring"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {!error && info && !devCode && (
        <p className="text-center text-xs text-slate-500">{info}</p>
      )}

      <Button type="submit" className="w-full" loading={verifying} disabled={code.length !== 6}>
        {t('Verify karein')}
      </Button>

      <div className="flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 focus-ring"
          >
            <ArrowLeft size={14} /> {t('Peeche')}
          </button>
        ) : <span />}

        <button
          type="button"
          onClick={send}
          disabled={wait > 0 || sending}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline
                     disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline focus-ring"
        >
          <RefreshCw size={14} className={sending ? 'animate-spin' : ''} />
          {wait > 0 ? t('Dobara bhejein ({n})', { n: wait }) : t('Dobara bhejein')}
        </button>
      </div>
    </form>
  );
}

import { ChevronDown, Wallet } from 'lucide-react';
import { useState } from 'react';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

/**
 * "KITNA BAAKI HAI" — ek hi dabba, saare page pe wahi.
 *
 * Shikayat seedhi thi: ek page pe ek number, doosre pe doosra, aur dono ek hi
 * cheez ka naam le rahe the. Wajah ye thi ki har page apna jod khud lagata tha —
 * kahin khata, kahin khule bill, kahin dono ka mel.
 *
 * Server ab ek hi jagah se jawab deta hai (`balance.service.js`) aur wahi
 * `hisaab` har page ko bhejta hai. Ye component usi ek jawab ko dikhata hai.
 * Isliye ab do page pe do number dikhna mumkin hi nahi — dikhane wala code hi
 * ek hai.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * BADA NUMBER UPAR, TOD-PHOD ANDAR.
 *
 * Dukaandaar ko 90% waqt sirf ek number chahiye. Par jab wo number galat lage
 * (aur yahi wo pal hai jab app par bharosa toot ta hai), tab ek tap me poora
 * hisaab khul jana chahiye — kitna bill ka, kitna purana, kitna jama.
 * Isliye tod-phod chhupi hai, gayab nahi.
 * ─────────────────────────────────────────────────────────────────────────
 */
export default function HisaabCard({
  hisaab, title, shopName, tone = 'auto', compact = false, footer = null,
}) {
  const [open, setOpen] = useState(false);
  if (!hisaab) return null;

  const {
    netDue = 0, billsDue = 0, otherDue = 0, advance = 0, openBills = 0, advanceFrom = [],
  } = hisaab;

  const jamaMode = advance > 0 && netDue <= 0;
  const amount = jamaMode ? advance : netDue;

  // Jama paisa hara, udhaar laal, chukta neutral — rang hi pehla jawab hai
  const skin = tone !== 'auto' ? tone : jamaMode ? 'good' : amount > 0 ? 'due' : 'clear';
  const box = {
    good: 'border-emerald-200 bg-emerald-50',
    due: 'border-amber-200 bg-amber-50',
    clear: 'border-slate-200 bg-white',
  }[skin];
  const ink = {
    good: 'text-emerald-700', due: 'text-amber-800', clear: 'text-slate-900',
  }[skin];

  const label = title
    || (jamaMode ? t('Aapka jama paisa') : amount > 0 ? t('Baaki') : t('Sab clear hai'));

  // Tod-phod tabhi jab sach me todne layak kuch ho
  const canOpen = (billsDue > 0 && otherDue > 0) || advanceFrom.length > 0
    || (jamaMode && advance > 0);

  return (
    <div className={`rounded-xl border ${box} ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-600">{label}</p>
          <p className={`mt-0.5 text-2xl font-semibold tabular ${ink}`}>{formatMoney(amount)}</p>

          {/*
            KISKE PAAS — buy mode aane ke baad ye sabse zaroori line hai.
            Ek hi retailer ab kai dukaano se maal leta hai; bina dukaan ke naam
            ke "₹2,000 jama hai" ka koi matlab hi nahi banta.
          */}
          {shopName && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {jamaMode
                ? t('{a} ke paas jama hai', { a: shopName })
                : t('{a} ka hisaab', { a: shopName })}
            </p>
          )}

          {!open && billsDue > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {t('{n} bill khule hain', { n: openBills })} · {formatMoney(billsDue)}
            </p>
          )}
        </div>

        {canOpen && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs
                       font-medium text-slate-600 hover:bg-white/70 hover:text-slate-900 focus-ring"
            aria-expanded={open}
          >
            {t('Hisaab')}
            <ChevronDown size={14} className={open ? 'rotate-180 transition' : 'transition'} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-1.5 border-t border-white/70 pt-3 text-sm">
          {billsDue > 0 && (
            <Row label={t('Khule bill ka')} value={billsDue} sub={t('{n} bill', { n: openBills })} />
          )}
          {otherDue > 0 && (
            /*
              "Purana hisaab" = wo udhaar jo kisi bill se nahi aaya (opening
              balance ya seedhi adjustment). Ye number pehle kahin dikhta hi
              nahi tha — isliye bill jodne par jod kabhi milta hi nahi tha aur
              dukaandaar ko lagta tha app galat gin raha hai.
            */
            <Row label={t('Bill ke bahar ka (purana hisaab)')} value={otherDue} />
          )}
          {advance > 0 && (
            <Row label={t('Jama paisa')} value={advance} minus />
          )}

          {advanceFrom.length > 0 && (
            <div className="mt-2 rounded-lg bg-white/70 p-2.5">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <Wallet size={12} /> {t('Ye paisa aaya kahan se')}
              </p>
              <ul className="space-y-0.5">
                {advanceFrom.map((a, i) => (
                  <li key={`${a.refNo}-${i}`} className="flex justify-between gap-3 text-xs text-slate-600">
                    <span className="truncate">
                      {a.refNo || t('Entry')}{a.note ? ` · ${a.note}` : ''}
                    </span>
                    <span className="shrink-0 tabular">{formatMoney(a.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

function Row({ label, value, sub, minus = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-600">
        {label}
        {sub && <span className="ml-1 text-xs text-slate-400">{sub}</span>}
      </span>
      <span className={`shrink-0 tabular font-medium ${minus ? 'text-emerald-700' : 'text-slate-900'}`}>
        {minus ? '− ' : ''}{formatMoney(value)}
      </span>
    </div>
  );
}

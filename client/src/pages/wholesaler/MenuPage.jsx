import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, LogOut, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useOrderBadge } from '@/hooks/useOrderBadge';
import { wholesalerNav, retailerNav } from '@/components/layout/navConfig';
import { Card, Button, ConfirmModal, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * MENU — poore app ki soochi, A se Z tak.
 *
 * Pehle ye ek daraz (drawer) thi jo side se aati thi. Do dikkat thin:
 *
 *  1. **Daraz me lambi list padhi nahi jati.** 16 line ek patli 270px chaudi
 *     patti me, bina kisi kram ke (jis kram me code me likhi thi usi kram me).
 *     Dhoondhne ka koi tarika nahi tha — sirf upar se neeche aankh daudana.
 *  2. **Daraz ka apna koi pata nahi hota.** Peeche ka button use band kar deta
 *     hai, link bhejna mumkin nahi, aur "wapas menu pe jao" jaisi koi cheez
 *     hoti hi nahi.
 *
 * Ab ye apna page hai (`/menu`) aur teen cheezein badli hain:
 *
 *  - **Khoj sabse upar.** "kharch" ya "udhaar" likhte hi seedha wahi page.
 *    Khoj naam me bhi dhoondhti hai aur uske MATLAB me bhi — "udhaar" likhne
 *    pe Khata milta hai, jabki us naam me "udhaar" hai hi nahi.
 *  - **A se Z.** Kram ab code ka nahi, akshar ka hai. Dukaandaar ko "P" pata
 *    hai to Payment, Purchase, Profile ek saath mil jate hain.
 *  - **Har naam ke saath ek line.** "Khata" aur "Payment" dono me paisa hai;
 *    naam padh kar naya banda galat page kholta tha.
 *
 * Desktop pe baayein wali sidebar jaisi thi waisi hai — ye page wahan bhi
 * khulta hai par zarurat kam padti hai.
 */
export default function MenuPage() {
  const toast = useToast();
  const { isRetailer, user, business, can, logout } = useAuth();
  const { count: cartCount } = useCart();
  const newOrders = useOrderBadge();

  const [q, setQ] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [askLogout, setAskLogout] = useState(false);

  const badges = { cartCount, newOrders };

  const all = useMemo(() => {
    const nav = isRetailer ? retailerNav : wholesalerNav.filter((n) => !n.perm || can(n.perm));
    // Anuvaad ke BAAD chhantna zaroori hai — Hindi me "खाता" ka akshar alag hai
    return [...nav]
      .map((n) => ({ ...n, name: t(n.label), meaning: n.desc ? t(n.desc) : '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isRetailer, can]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    // `alt` = wo purane naam jo ab menu me nahi hain par log abhi bhi dhoondhte
    // hain ("supplier", "kharch"). Bina iske teen page ek me milne ke baad
    // khoj se hi gayab ho jate
    return all.filter((n) => `${n.name} ${n.meaning} ${n.label} ${n.desc || ''} ${n.alt || ''}`
      .toLowerCase().includes(needle));
  }, [all, q]);

  // A–Z ke dabbe. Khoj chalu ho to kram todna bekaar hai — tab seedhi list.
  const groups = useMemo(() => {
    if (q.trim()) return [{ letter: '', rows: filtered }];
    const map = new Map();
    for (const row of filtered) {
      const letter = (row.name[0] || '#').toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter).push(row);
    }
    return [...map.entries()].map(([letter, rows]) => ({ letter, rows }));
  }, [filtered, q]);

  async function doLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      toast.error(err.message);
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{t('Menu')}</h1>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {business?.name} · {filtered.length} {t('jagah')}
        </p>
      </div>

      {/* ---- khoj ---- */}
      <div className="relative mb-4">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('Menu me dhundhein')}
          placeholder={t('Kya kholna hai? Jaise "kharch" ya "udhaar"')}
          className={cn(
            'w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900',
            'placeholder:text-slate-400 focus-ring'
          )}
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label={t('Khoj hatayein')}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 focus-ring">
            <X size={16} />
          </button>
        )}
      </div>

      {!filtered.length ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-slate-900">{t('Kuch nahi mila')}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t('Doosre shabd se dekhein — jaise "bill", "paisa" ya "maal".')}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.letter || 'khoj'}>
              {g.letter && (
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {g.letter}
                </p>
              )}
              <Card padding={false}>
                <ul>
                  {g.rows.map((row) => (
                    <MenuRow key={row.to} row={row}
                      badge={row.badgeKey ? badges[row.badgeKey] : 0} />
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* ---- neeche: kaun logged in hai, aur nikalne ka rasta ---- */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.phone}</p>
          </div>
          <Button variant="secondary" icon={LogOut} onClick={() => setAskLogout(true)}>
            {t('Logout')}
          </Button>
        </div>
      </Card>

      <ConfirmModal
        open={askLogout}
        onClose={() => setAskLogout(false)}
        onConfirm={doLogout}
        loading={loggingOut}
        title={t('Logout karein?')}
        message={t('Dobara login karne ke liye phone number aur password lagega.')}
        confirmLabel={t("Haan, logout")}
      />
    </>
  );
}

function MenuRow({ row, badge }) {
  const Icon = row.icon;
  return (
    <li className="border-b border-slate-100 last:border-0">
      {/* py-3 = tap ka ghera 48px+; ungli se galat line kabhi nahi dabti */}
      <Link to={row.to}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 focus-ring">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-900">{row.name}</span>
            {badge > 0 && (
              <span className="shrink-0 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold leading-4 text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          {row.meaning && (
            <span className="mt-0.5 block truncate text-xs text-slate-500">{row.meaning}</span>
          )}
        </span>
        <ChevronRight size={16} className="shrink-0 text-slate-300" />
      </Link>
    </li>
  );
}

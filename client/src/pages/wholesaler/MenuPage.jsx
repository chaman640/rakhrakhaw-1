import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronRight, LogOut, X, Pin, PinOff, Video } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { useCart } from '@/context/CartContext';
import { useOrderBadge } from '@/hooks/useOrderBadge';
import { useIntakeBadge } from '@/hooks/useIntakeBadge';
import { wholesalerNav, buyerNav } from '@/components/layout/navConfig';
import ModeSwitch from '@/components/layout/ModeSwitch';
import { Card, Button, ConfirmModal, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

// Quick Links — sirf is phone/browser ke liye (localStorage), account ki
// cheez nahi hai isliye server pe nahi bhejte
const PINS_KEY = 'rr_quick_links';
function loadPins() {
  try { return JSON.parse(localStorage.getItem(PINS_KEY) || '[]'); } catch { return []; }
}
function savePins(pins) {
  try { localStorage.setItem(PINS_KEY, JSON.stringify(pins)); } catch { /* private window */ }
}

/*
 * HAR APP KA APNA RANG — Odoo jaisa (Part 32).
 *
 * Pehle sabhi icon ek hi halke-grey dabbe me the — safe, par phiki. Odoo ke
 * app-launcher me har app ka apna rang hai, isliye ek nazar me hi pehchana
 * jata hai. Yahan bhi wahi kiya — bas rang HAMESHA isi kram me ghoomte hain
 * (index se), isliye ek app ka rang kabhi random nahi badalta.
 */
const TILE_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-pink-100', text: 'text-pink-700' },
  { bg: 'bg-lime-100', text: 'text-lime-700' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
];

/**
 * MENU — poore app ka launcher, Odoo jaisa (Part 32).
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
 * Phir ye apna page bana (`/menu`), aur ab Odoo jaisa rangeen app-grid ban
 * gaya hai — har app ka apna rang, ek nazar me pehchana jaye:
 *
 *  - **Khoj sabse upar.** "kharch" ya "udhaar" likhte hi seedha wahi page.
 *  - **Rangeen tile.** A-Z ki jagah ab seedha grid hai (jaisa Odoo me hota
 *    hai) — har app ki apni jagah, apna rang. Kram wahi hai jo navConfig.js
 *    me pehle se socha-samjha tay hai (roz ke kaam pehle).
 *  - **Pin/Quick Links** waisi hi hai — tile ke corner me chhota button.
 *
 * Desktop pe bhi yahi page khulta hai, bas grid me zyada column aa jate hain.
 */
export default function MenuPage() {
  const toast = useToast();
  const { user, business, can, logout } = useAuth();
  const { buying, isBuyMode, shop } = useShop();
  const { count: cartCount } = useCart();
  const newOrders = useOrderBadge();
  const intakeCount = useIntakeBadge();

  const [q, setQ] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [askLogout, setAskLogout] = useState(false);
  const [pinned, setPinned] = useState(loadPins);

  function togglePin(to) {
    setPinned((cur) => {
      const next = cur.includes(to) ? cur.filter((p) => p !== to) : [...cur, to];
      savePins(next);
      return next;
    });
  }

  const badges = { cartCount, newOrders, intakeCount };

  /*
    Kram ab CODE me jo likha hai wahi hai — A-Z nahi. `navConfig.js` me kram
    jaan-boojh kar tay kiya gaya hai (roz ka kaam sabse pehle), aur Odoo ka
    apna app-launcher bhi kisi tarah "install order" jaisa kuch istemal karta
    hai, alphabetically nahi — isi soch se milta hai.
  */
  const all = useMemo(() => {
    const nav = buying ? buyerNav : wholesalerNav.filter((n) => !n.perm || can(n.perm));
    return nav.map((n) => ({ ...n, name: t(n.label), meaning: n.desc ? t(n.desc) : '' }));
  }, [buying, can]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    // `alt` = wo purane naam jo ab menu me nahi hain par log abhi bhi dhoondhte
    // hain ("supplier", "kharch"). Bina iske teen page ek me milne ke baad
    // khoj se hi gayab ho jate
    return all.filter((n) => `${n.name} ${n.meaning} ${n.label} ${n.desc || ''} ${n.alt || ''}`
      .toLowerCase().includes(needle));
  }, [all, q]);

  // Jis kram me pin kiya usi kram me — naye pin sabse peeche
  const pinnedRows = useMemo(() => {
    const map = new Map(all.map((n) => [n.to, n]));
    return pinned.map((to) => map.get(to)).filter(Boolean);
  }, [all, pinned]);

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
          {(isBuyMode && shop?.name) || business?.name} · {filtered.length} {t('jagah')}
        </p>
      </div>

      {/*
        Seller ⇄ Buyer — ab yahan (Part 52), Profile se hata kar. Wahan
        settings ke beech mein confuse karta tha. Yahan aadmi "kya karna
        hai" soch kar aata hai — sahi jagah. Confirmation khud ModeSwitch
        ke andar hai (Menu bahut baar khulta hai, isliye ek tap kaafi nahi).
      */}
      <ModeSwitch />

      {/* ---- Quick Links — jo pin kiye hain, sabse upar ---- */}
      {pinnedRows.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('Quick Links')}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {pinnedRows.map((row, i) => {
              const Icon = row.icon;
              const color = TILE_COLORS[i % TILE_COLORS.length];
              return (
                <Link
                  key={row.to}
                  to={row.to}
                  className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl p-2 text-center hover:bg-slate-50 focus-ring"
                >
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm', color.bg, color.text)}>
                    <Icon size={22} />
                  </span>
                  <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">
                    {row.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 xs:grid-cols-4 sm:grid-cols-5 lg:grid-cols-6">
          {filtered.map((row, i) => (
            <AppTile
              key={row.to}
              row={row}
              color={TILE_COLORS[i % TILE_COLORS.length]}
              badge={row.badgeKey ? badges[row.badgeKey] : 0}
              pinned={pinned.includes(row.to)}
              onTogglePin={() => togglePin(row.to)}
            />
          ))}
        </div>
      )}

      {/* ---- kabhi bhi dobara seekh sakte hain ---- */}
      <Card className="mt-4">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('rr:show-tour'))}
          className="flex w-full items-center gap-3 text-left focus-ring"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Video size={17} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium text-slate-900">{t('Tutorial dobara dekhein')}</span>
            <span className="block text-xs text-slate-500">{t('Har page ka video, phir se')}</span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-slate-300" />
        </button>
      </Card>

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

function AppTile({ row, color, badge, pinned, onTogglePin }) {
  const Icon = row.icon;
  return (
    <div className="relative flex flex-col items-center">
      <Link
        to={row.to}
        aria-label={row.meaning ? `${row.name} — ${row.meaning}` : row.name}
        className="flex flex-col items-center gap-1.5 rounded-2xl p-1.5 text-center hover:bg-slate-50 focus-ring"
      >
        <span className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm', color.bg, color.text)}>
          <Icon size={26} />
          {badge > 0 && (
            <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </span>

        <span className="line-clamp-2 text-xs font-medium leading-tight text-slate-700">{row.name}</span>
      </Link>

      {/*
        Pin button `<Link>` ke ANDAR nahi, BAAJU me hai (sibling) — button ko
        anchor ke andar rakhna galat HTML hai aur browser me kabhi-kabhi
        dono click ek saath chal jate hain. Yahan `absolute` se upar dikh
        jata hai, par asal me alag hi element hai.
      */}
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={pinned ? t('Quick Links se hatayein') : t('Quick Links me jodein')}
        className={cn(
          'absolute right-1 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200 focus-ring',
          pinned ? 'text-brand-600' : 'text-slate-300',
        )}
      >
        {pinned ? <PinOff size={11} /> : <Pin size={11} />}
      </button>
    </div>
  );
}

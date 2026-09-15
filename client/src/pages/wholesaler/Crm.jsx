import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Clock, Skull, Users, MessageCircle, ChevronRight, IndianRupee,
} from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { formatMoney, formatDate, formatPhone } from '@/lib/format';
import { PageHeader, Card, StatCard, Button, EmptyState, Spinner, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/**
 * CRM — "kaun abhi dekh raha hai, kaun chup ho gaya, kaun gaya hi gaya."
 *
 * Poora hisaab `crm.service.js` me hota hai — yahan sirf teen dabbe hain:
 *
 *   NAYE LEADS   — jinke cart me abhi maal pada hai, order nahi diya. Sabse
 *                  upar isliye ki ye SABSE GARAM hai — abhi dekh raha hai.
 *   FOLLOW-UP    — pehle order dete the, 15-45 din se chup hain.
 *   DEAD         — 45+ din se gayab, ya kabhi order kiya hi nahi (naye
 *                  jude retailer ko 14 din ki mohlat milti hai).
 *
 * Har jagah "Chat" seedha usi retailer ki chat khol deta hai (Part 43 wala
 * kaam, yahan se seedha istemal), aur naam pe tap `/retailers/:id?tab=orders`
 * khol deta hai — order history sabse pehle, "detail" tab me dhoondhna nahi
 * padta.
 */
export default function Crm() {
  const navigate = useNavigate();
  const toast = useToast();

  const { data, loading, error } = useQuery(
    ['crm', 'overview'],
    () => api.get('/crm/overview').then((r) => r.data),
    { onError: (err) => toast.error(err.message) },
  );

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={26} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon={Users}
        title={t('Load nahi hua')}
        message={error.message}
      />
    );
  }

  const s = data.summary;

  return (
    <>
      <PageHeader
        title={t('CRM')}
        subtitle={t('Kaun kharidne ke kareeb hai, kaun bhoolne laga hai — sab ek jagah')}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('Naye leads')} value={s.leadsCount} icon={ShoppingCart} tone="brand" />
        <StatCard label={t('Follow-up chahiye')} value={s.followUpCount} icon={Clock} tone="amber" />
        <StatCard label={t('Dead')} value={s.deadCount} icon={Skull} tone="red" />
        <StatCard label={t('Chalu retailer')} value={s.activeCount} icon={Users} tone="green" />
      </div>

      <Section
        title={t('Naye leads')}
        subtitle={t('Cart mein maal pada hai, order abhi nahi diya')}
        icon={ShoppingCart}
        tone="brand"
        rows={data.leads}
        empty={t('Abhi kisi ke cart mein kuch pada nahi hai')}
        renderMeta={(r) => (
          <>
            <p className="tabular text-sm font-semibold text-slate-900">{formatMoney(r.cartValue)}</p>
            <p className="text-xs text-slate-500">{t('{n} item cart me', { n: r.cartItemCount })}</p>
          </>
        )}
        renderBadge={(r) => r.isReturning && (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
            {t('Purana graahak')}
          </span>
        )}
        navigate={navigate}
      />

      <Section
        title={t('Follow-up chahiye')}
        subtitle={t('Pehle order dete the, ab 15+ din se chup hain')}
        icon={Clock}
        tone="amber"
        rows={data.followUp}
        empty={t('Koi follow-up baaki nahi hai')}
        renderMeta={(r) => (
          <>
            <p className="tabular text-sm font-semibold text-amber-700">{t('{n} din se koi order nahi', { n: r.daysSinceOrder })}</p>
            <p className="text-xs text-slate-500">{t('Ab tak {a0} ka business', { a0: formatMoney(r.lifetimeValue) })}</p>
          </>
        )}
        navigate={navigate}
      />

      <Section
        title={t('Dead ho sakte hain')}
        subtitle={t('45+ din se gayab, ya kabhi order kiya hi nahi')}
        icon={Skull}
        tone="red"
        rows={data.dead}
        empty={t('Koi retailer gayab nahi hai — sab sahi hai')}
        renderMeta={(r) => (
          <>
            <p className="tabular text-sm font-semibold text-red-700">
              {r.neverOrdered ? t('Kabhi order nahi diya') : t('{n} din se gayab', { n: r.daysSinceOrder })}
            </p>
            {r.lifetimeValue > 0 && (
              <p className="text-xs text-slate-500">{t('Pehle {a0} ka business tha', { a0: formatMoney(r.lifetimeValue) })}</p>
            )}
          </>
        )}
        navigate={navigate}
        footer={s.deadLifetimeValue > 0 && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-red-700">
            <IndianRupee size={12} />
            {t('In sabse pehle mila kar kareeb {a0} ka business tha — yahi ab daanv pe hai', { a0: formatMoney(s.deadLifetimeValue) })}
          </p>
        )}
      />
    </>
  );
}

function Section({ title, subtitle, icon: Icon, tone, rows, empty, renderMeta, renderBadge, navigate, footer }) {
  const toneClasses = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }[tone];

  return (
    <Card className="mb-4">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneClasses)}>
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{title} <span className="text-slate-400">({rows.length})</span></p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.partyId} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => navigate(`/retailers/${r.partyId}?tab=orders`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {(r.shopName || r.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-slate-900">{r.shopName || r.name}</span>
                    {renderBadge?.(r)}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {r.name}{r.phone ? ` · ${formatPhone(r.phone)}` : ''}
                  </span>
                </span>
              </button>

              <div className="shrink-0 text-right">{renderMeta(r)}</div>

              <button
                type="button"
                onClick={() => navigate(`/chat/${r.partyId}`, { state: { name: r.shopName || r.name } })}
                aria-label={t('Chat karein')}
                title={t('Chat karein')}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-brand-600 focus-ring"
              >
                <MessageCircle size={17} />
              </button>

              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </div>
          ))}
        </div>
      )}

      {footer}
    </Card>
  );
}

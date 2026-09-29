import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight, Globe, Lock } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, Button, useToast } from '@/components/ui';
import InviteCard from '../parties/InviteCard';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

/*
  DUKAAN KAUN DEKH SAKTA HAI — do hi raste, saaf saaf.

  Khuli dukaan me koi bhi jud kar seedha maal aur rate dekh leta hai (aaj
  tak yahi chalta tha, isliye default yahi). "Permission ke baad" me naya
  aadmi request bhejta hai aur malik ke approve karne tak kuch nahi dekhta —
  bina login wala public link bhi maal nahi dikhata.

  Pehle se jude hue logon pe koi asar nahi: jo approve the, wo rehte hain.
*/
const OPTIONS = [
  {
    value: false,
    icon: Globe,
    title: 'Sab dekh sakein',
    hint: 'Koi bhi dukaan se jud kar ya link khol kar seedha maal dekh aur order kar sake',
  },
  {
    value: true,
    icon: Lock,
    title: 'Meri permission ke baad hi',
    hint: 'Naya aadmi request bhejega — aap approve karenge tabhi wo maal aur rate dekh payega',
  },
];

function VisibilityCard() {
  const { business, refresh, isOwner } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(null);
  const current = Boolean(business?.requireApproval);

  async function choose(value) {
    if (value === current || saving !== null) return;
    setSaving(value);
    try {
      const res = await api.put('/business/me', { requireApproval: value });
      toast.success(res.message || t('Setting badal di'));
      await refresh?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('Dukaan kaun dekh sakta hai')}
        subtitle={t('Pehle se jude hue retailers pe iska asar nahi padta')}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((o) => {
          const active = o.value === current;
          return (
            <button
              key={String(o.value)}
              type="button"
              disabled={!isOwner || saving !== null}
              onClick={() => choose(o.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-ring disabled:cursor-not-allowed',
                active ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50',
              )}
            >
              <span className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500',
              )}>
                <o.icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{t(o.title)}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{t(o.hint)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {!isOwner && (
        <p className="mt-2 text-xs text-slate-500">{t('Ise sirf malik badal sakta hai')}</p>
      )}
    </Card>
  );
}

export default function RetailersTab() {
  return (
    <div className="space-y-5">
      <VisibilityCard />

      <InviteCard />

      <Card>
        <CardHeader
          title={t('Retailers ka poora management')}
          subtitle={t('List, approve/block, party-wise rate aur khata — sab Retailers page pe')}
        />
        <Link to="/retailers">
          <Button variant="secondary" icon={Users}>
            {t('Retailers page kholein')} <ArrowRight size={15} />
          </Button>
        </Link>
      </Card>
    </div>
  );
}

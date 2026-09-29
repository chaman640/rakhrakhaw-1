import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, AlertTriangle, Sun, CalendarDays, Plus, Target, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/format';
import { PageHeader, Card, CardHeader, Button, Badge, EmptyState, Spinner } from '@/components/ui';
import { TaskRow, TaskFormModal, STAGE_LABEL, STAGE_TONE } from './crm/CrmParts';
import { t } from '@/lib/i18n';

/**
 * AAJ KA KAAM — staff (aur malik) ka pehla page.
 *
 * Sirf APNA kaam: jo peeche chhoot gaya (laal), aaj ka, aur agle hafte ka.
 * CRM, lead aur malik — jahan se bhi kaam aaya ho, yahi ek jagah dikhta hai.
 * Tick karte hi malik ko "poora" dikh jata hai; koi alag register nahi.
 */
export default function Today() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newOpen, setNewOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery(['crm', 'today'], () => api.get('/crm/today').then((r) => r.data));

  if (loading && !data) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;
  if (error && !data) return <EmptyState icon={CalendarCheck} title={t('Load nahi hua')} message={error.message} />;

  const total = data.overdue.length + data.today.length;
  const Section = ({ title, icon: Icon, rows, tone }) => (rows.length ? (
    <Card>
      <CardHeader title={<span className={`flex items-center gap-2 ${tone || ''}`}><Icon size={16} />{title} ({rows.length})</span>} />
      <ul className="divide-y divide-slate-100">{rows.map((tk) => <TaskRow key={tk._id} task={tk} onChanged={refetch} />)}</ul>
    </Card>
  ) : null);

  return (
    <>
      <PageHeader
        title={t('Aaj ka kaam')}
        subtitle={t('Namaste {naam} — aaj {n} kaam, {d} ho gaye', { naam: user?.name || '', n: total, d: data.doneToday })}
        action={<Button icon={Plus} onClick={() => setNewOpen(true)}>{t('Naya kaam')}</Button>}
      />
      <div className="space-y-4">
        {!total && !data.upcoming.length && !data.noDate.length && !data.leadsToFollow.length && (
          <Card><EmptyState icon={CheckCircle2} title={t('Aaj ke liye koi kaam nahi')} message={t('Naya kaam aate hi yahan dikhega')} /></Card>
        )}
        <Section title={t('Peeche chhoot gaye')} icon={AlertTriangle} rows={data.overdue} tone="text-red-700" />
        <Section title={t('Aaj')} icon={Sun} rows={data.today} />

        {data.leadsToFollow.length > 0 && (
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Target size={16} />{t('Leads jinse aaj baat karni hai')}</span>} />
            <ul className="divide-y divide-slate-100">
              {data.leadsToFollow.map((l) => (
                <li key={l._id}>
                  <button type="button" onClick={() => navigate('/crm')} className="flex w-full items-center justify-between py-2.5 text-left">
                    <span className="text-sm text-slate-900">{l.name}<span className="block text-xs text-slate-500">{l.phone} · {formatDate(l.nextFollowUpAt)}</span></span>
                    <Badge tone={STAGE_TONE[l.stage]}>{t(STAGE_LABEL[l.stage])}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Section title={t('Agle 7 din')} icon={CalendarDays} rows={data.upcoming} />
        <Section title={t('Bina tareekh')} icon={CalendarCheck} rows={data.noDate} />
      </div>
      <TaskFormModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={refetch} />
    </>
  );
}

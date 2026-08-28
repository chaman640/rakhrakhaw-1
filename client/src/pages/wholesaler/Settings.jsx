import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import api from '@/lib/api';
import { PageHeader, Tabs, Spinner, Card, Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import AppTab from './settings/AppTab';
import RetailersTab from './settings/RetailersTab';
import BackupTab from './settings/BackupTab';
import PlanTab from './settings/PlanTab';
import { t } from '@/lib/i18n';

export default function Settings() {
  const { isOwner } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  /*
    Ab Settings me sirf wahi bacha hai jo "app kaise chale" se juda hai —
    bhasha, roshni, akshar ka size, invite link aur backup.

    Dukaan ki pehchan aur apna login PROFILE me chale gaye (upar apne naam pe
    dabao), aur log/login STAFF page pe. Wajah dono me ek hi hai: wo roz ya
    hafte ka kaam hai, aur Settings ke andar tab ban kar dabe rehte the.
  */
  const [tab, setTab] = useState('app');
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const welcome = params.get('welcome') === '1';


  useEffect(() => {
    api.get('/business/me')
      .then((res) => setBusiness(res.data))
      .finally(() => setLoading(false));
    // Ye ginti sirf malik wale "Invite link" tab pe dikhti hai, aur retailer
    // list ab bina `parties` ijazat ke khulti bhi nahi — isliye staff ke liye
    // ye call karne ka koi matlab hi nahi
    if (isOwner) {
      api.get('/business/retailers?status=pending')
        .then((res) => setPendingCount(res.data.summary.pending || 0))
        .catch(() => {});
    }
  }, [isOwner]);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400">
        <Spinner size={28} />
      </div>
    );
  }

  if (!business) return null;

  return (
    <>
      <PageHeader title={t('Settings')} subtitle={t('App, invite link aur backup')} />

      {welcome && (
        <Card className="mb-5 border-brand-200 bg-brand-50">
          <div className="flex items-start gap-3">
            <PartyPopper size={20} className="mt-0.5 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-medium text-brand-900">{t('Account ban gaya!')}</p>
              <p className="mt-0.5 text-sm text-brand-800">
                {t('Ab do kaam: Profile me dukaan ka address, GST aur UPI bhar lein (bill pe yahi chhapega), aur "Invite link" tab se apna link WhatsApp pe bhej dein.')}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => navigate('/profile')}>{t('Profile bharein')}</Button>
                <button
                  onClick={() => { params.delete('welcome'); setParams(params, { replace: true }); }}
                  className="text-xs font-medium text-brand-700 underline"
                >
                  {t('Theek hai, samajh gaya')}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'app', label: t('App') },
          // Dukaan ki detail, invite link, staff aur backup — sab malik ke haath me
          ...(isOwner ? [
            { value: 'retailers', label: t('Invite link'), count: pendingCount },
            // "Log aur login" ab apne Staff page pe chala gaya — wo mahine me
            // kai baar chalne wala kaam hai, Settings saal me do baar khulti hai
            { value: 'backup', label: t('Backup') },
            { value: 'plan', label: t('Plan') },
          ] : []),
        ]}
      />

      {tab === 'app' && <AppTab />}
      {tab === 'retailers' && isOwner && <RetailersTab />}
      {tab === 'backup' && isOwner && <BackupTab />}
      {tab === 'plan' && isOwner && <PlanTab />}
    </>
  );
}

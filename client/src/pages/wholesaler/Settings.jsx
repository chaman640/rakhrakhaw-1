import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import api from '@/lib/api';
import { PageHeader, Tabs, Spinner, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import BusinessTab from './settings/BusinessTab';
import RetailersTab from './settings/RetailersTab';
import AccountTab from './settings/AccountTab';
import StaffTab from './settings/StaffTab';
import BackupTab from './settings/BackupTab';

export default function Settings() {
  const { isOwner } = useAuth();
  const [params, setParams] = useSearchParams();
  // Staff ko dukaan ki settings badalne ki ijazat nahi — unke liye Account hi default
  const [tab, setTab] = useState(() => 'business');
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const welcome = params.get('welcome') === '1';

  // Staff ke liye sirf Account tab bacha hai — wahi khol do
  useEffect(() => { if (!isOwner) setTab('account'); }, [isOwner]);

  useEffect(() => {
    api.get('/business/me')
      .then((res) => setBusiness(res.data))
      .finally(() => setLoading(false));
    api.get('/business/retailers?status=pending')
      .then((res) => setPendingCount(res.data.summary.pending || 0))
      .catch(() => {});
  }, []);

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
      <PageHeader title="Settings" subtitle="Dukaan ki detail, GST, staff aur backup" />

      {welcome && (
        <Card className="mb-5 border-brand-200 bg-brand-50">
          <div className="flex items-start gap-3">
            <PartyPopper size={20} className="mt-0.5 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-medium text-brand-900">Account ban gaya!</p>
              <p className="mt-0.5 text-sm text-brand-800">
                Address aur GST bhar lein — invoice pe yahi chhapega. Phir "Invite link" tab se apna
                link WhatsApp pe bhej dein.
              </p>
              <button
                onClick={() => { params.delete('welcome'); setParams(params, { replace: true }); }}
                className="mt-2 text-xs font-medium text-brand-700 underline"
              >
                Theek hai, samajh gaya
              </button>
            </div>
          </div>
        </Card>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          // Dukaan ki detail, invite link, staff aur backup — sab malik ke haath me
          ...(isOwner ? [
            { value: 'business', label: 'Dukaan' },
            { value: 'retailers', label: 'Invite link', count: pendingCount },
            { value: 'staff', label: 'Log aur login' },
            { value: 'backup', label: 'Backup' },
          ] : []),
          { value: 'account', label: 'Account' },
        ]}
      />

      {tab === 'business' && isOwner && <BusinessTab business={business} onSaved={setBusiness} />}
      {tab === 'retailers' && isOwner && <RetailersTab />}
      {tab === 'staff' && isOwner && <StaffTab />}
      {tab === 'backup' && isOwner && <BackupTab />}
      {tab === 'account' && <AccountTab />}
    </>
  );
}

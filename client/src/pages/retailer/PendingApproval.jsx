import { useEffect } from 'react';
import { t } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { Clock, Ban, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthShell from '@/components/auth/AuthShell';
import { Button } from '@/components/ui';

export default function PendingApproval() {
  const { business, party, partyStatus, refresh, logout } = useAuth();
  const navigate = useNavigate();

  // Har 20 second me khud check karta rahega ki approve hua ya nahi
  useEffect(() => {
    const id = setInterval(refresh, 20000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    // Approve hote hi seedha catalog — abhi to bandaa order hi karna chahta hai.
    // Baad ke logins pe HomeRedirect use /home pe le jata hai.
    if (partyStatus === 'active') navigate('/shop', { replace: true });
  }, [partyStatus, navigate]);

  const blocked = partyStatus === 'blocked';

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <AuthShell brandName={business?.name} logoUrl={business?.logoUrl}>
      <div className="flex flex-col items-center py-4 text-center">
        <div
          className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
          blocked ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`
          }>
          
          {blocked ? <Ban size={24} /> : <Clock size={24} />}
        </div>

        <h2 className="text-base font-semibold text-slate-900">
          {blocked ? 'Aapka access band hai' : 'Approval ka intezaar'}
        </h2>

        <p className="mt-2 max-w-xs text-sm text-slate-500">
          {blocked ?
          `${business?.name || 'Wholesaler'} ne aapka access rok diya hai. Unse baat karein.` :
          `${business?.name || 'Wholesaler'} ne abhi aapki dukaan approve nahi ki. Approve hote hi catalog apne aap khul jayega.`}
        </p>

        {party?.shopName &&
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {party.shopName} · {party.phone}
          </p>
        }

        <div className="mt-6 flex w-full gap-2">
          <Button variant="secondary" className="flex-1" icon={RefreshCw} onClick={refresh}>{t("Check karein")}

          </Button>
          <Button variant="ghost" icon={LogOut} onClick={handleLogout}>{t("Logout")}

          </Button>
        </div>
      </div>
    </AuthShell>);

}

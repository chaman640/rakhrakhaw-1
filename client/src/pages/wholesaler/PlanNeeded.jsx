import { Link } from 'react-router-dom';
import { Store, Lock } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import PlanPicker from '@/components/billing/PlanPicker';
import { t } from '@/lib/i18n';

/**
 * "PLAN LENA PADEGA" WALA PARDA.
 *
 * Ye tab dikhta hai jab server `subscription_required` bhejta hai — yaani
 * bechne ka kaam band hai.
 *
 * MALIK aur STAFF ko ALAG cheez dikhti hai (Part 28):
 *
 *   MALIK — poora parda: plan chunein, payment karein. Wahi paisa de sakta
 *           hai, isliye use hi poora rasta milta hai.
 *
 *   STAFF — sirf itna: "dukaan ka payment ruka hai, malik se kahiye". Koi
 *           payment button nahi — staff paisa de hi nahi sakta, use option
 *           dikhana sirf uljhan badhata.
 *
 * Do cheezein dono ke liye JAAN-BOOJH KAR yahan hain:
 *
 *   1. "KHARIDNA AB BHI FREE HAI" — sabse upar, saaf saaf. Bina iske aadmi
 *      samajhta hai ki poori app band ho gayi, aur wo chala jata hai.
 *
 *   2. USKA DATA SURAKSHIT HAI — "Plan khatam" padhte hi pehla dar yahi hota
 *      hai ki "mera saara hisaab gaya". Wo dar dur karna plan bechne se
 *      pehle aata hai.
 */
export default function PlanNeeded() {
  const { isOwner } = useAuth();
  const { setMode } = useShop() || {};

  return (
    <div className="mx-auto max-w-3xl px-1 py-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <Store size={16} /> {t('Kharidna ab bhi free hai')}
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          {t('Dukaan dhundhna, maal dekhna, order bhejna aur apna khata — ye sab pehle jaisa hi chal raha hai. Sirf apna maal BECHNE wala hissa ruka hai.')}
        </p>
      </div>

      {!isOwner ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Lock size={16} /> {t('Dukaan ka payment ruka hua hai')}
          </p>
          <p className="mt-1.5 text-sm text-amber-800">
            {t('Ye sirf malik theek kar sakte hain. Unse kahiye payment kar dein — hote hi aap dobara kaam kar sakenge.')}
          </p>
        </div>
      ) : (
        <>
          <h1 className="mt-6 text-xl font-semibold text-slate-900">
            {t('Bechne ke liye plan lein')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t('Ginti LOGIN karne wale logon ki hai — aap khud bhi usme gine jate hain. Aapke retailer kitne bhi hon, wo is ginti me nahi aate.')}
          </p>

          <div className="mt-5">
            <PlanPicker onDone={() => window.location.reload()} />
          </div>
        </>
      )}

      {/*
        Data ka dar sabse pehle dur karna hai — malik ho ya staff, dono ko.

        "Plan khatam" padhte hi pehla khyal yahi aata hai — "mera saara hisaab
        gaya". Wo dar dur kiye bina koi plan ki baat sunta hi nahi.
      */}
      <p className="mt-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        {t('Aapka poora data surakshit hai — stock, bill, khata, sab waise ka waisa pada hai. Plan lete hi sab wapas mil jayega. Aur "Backup" se aap use kabhi bhi apne paas nikaal sakte hain.')}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {setMode && (
          <Button variant="secondary" onClick={() => setMode('BUY')}>
            {t('Kharidne wale hisse me jayein')}
          </Button>
        )}
        {isOwner && (
          <Link to="/pricing">
            <Button variant="ghost">{t('Poora daam dekhein')}</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

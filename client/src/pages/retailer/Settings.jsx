import { PageHeader } from '@/components/ui';
import { t } from '@/lib/i18n';
/*
  Yahi wala hissa wholesaler ke Settings me bhi lagta hai.

  Do copy nahi banayi — bhasha, roshni aur akshar ka size dono ke liye bilkul
  ek jaisa kaam karta hai, aur do copy ka matlab hota ki ek me kuch theek karo
  to doosri wahin ki wahin reh jaye. (Retailer ka MyKhata bhi isi tarah
  wholesaler wala LedgerTable seedha istemal karta hai.)
*/
import AppTab from '@/pages/wholesaler/settings/AppTab';

/**
 * RETAILER KI SETTINGS.
 *
 * Pehle retailer ke paas ye page tha hi nahi. Bhasha, raat wala roop aur bade
 * akshar — teenon sirf wholesaler ke Settings me pade the, aur retailer ke
 * menu me Settings ka koi khana hi nahi tha. Yani jo aadmi Hindi me padhta hai
 * ya jiski aankh kamzor hai, uske paas app badalne ka koi rasta hi nahi tha.
 *
 * Profile alag page hai aur alag hi rehna chahiye: wahan dukaan ka naam,
 * password aur logout hai — wo ACCOUNT ki cheezein hain, sabhi phone pe ek
 * jaisi. Yahan wali teen cheezein sirf ISI phone ki hain. Dono ko ek page pe
 * milane se hamesha ye uljhan rehti hai ki "bada akshar" har jagah hoga ya
 * sirf yahan.
 */
export default function RetailerSettings() {
  return (
    <>
      <PageHeader title={t('Settings')} subtitle={t('Bhasha, roshni aur akshar ka size')} />
      <div className="space-y-4">
        <AppTab />
      </div>
    </>
  );
}

import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import StaffTab from './settings/StaffTab';
import Activity from './Activity';
import { t } from '@/lib/i18n';

/**
 * STAFF — log, unki ijazat, aur unka kaam. Ek hi jagah.
 *
 * Pehle ye do jagah baanta hua tha aur dono jagah galat thin:
 *
 *   - **Log aur login** Settings ke andar chautha tab tha. Settings wo jagah
 *     hai jahan aadmi saal me do baar jata hai; naya banda rakhna, uski ijazat
 *     badalna, ya kisi ko band karna mahine me kai baar hota hai. Wo kaam
 *     "app kaise chale" wale dabbe me dabaa hua tha.
 *   - **Kaam ka record** apna alag page tha (`/activity`). Par uska poora
 *     matlab staff ke saath hi hai — koi bhi "kaam ka record" isliye kholta
 *     hai kyunki uske dimaag me kisi AADMI ka sawal hai ("ye bill kisne
 *     mitaya?"). Do click door hone se log usse dekhte hi nahi the.
 *
 * Ab ek page, do tab. Aadmi aur uske kaam ke beech ek tap ka faasla hai.
 *
 * `/activity` abhi bhi chalta hai — wo seedha doosre tab pe khulta hai, taaki
 * purane link aur notification tootein nahi.
 */
export default function Staff() {
  const { isScoped } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'record' ? 'record' : 'log';

  return (
    <>
      <PageHeader
        title={t('Staff')}
        subtitle={isScoped
          ? t('Aapka kiya hua kaam')
          : t('Kaun kaun kaam karta hai, kiske paas kya chaabi hai, aur kisne kya kiya')}
      />

      <Tabs
        value={tab}
        onChange={(v) => {
          // Tab URL me rehta hai — refresh karne pe wahi tab wapas khulta hai
          // aur kisi ko link bhi bheja ja sakta hai
          if (v === 'log') params.delete('tab');
          else params.set('tab', v);
          setParams(params, { replace: true });
        }}
        tabs={[
          { value: 'log', label: 'Log' },
          { value: 'record', label: 'Kaam ka record' },
        ]}
      />

      {tab === 'log' ? <StaffTab /> : <Activity embedded />}
    </>
  );
}

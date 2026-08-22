import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, Tabs } from '@/components/ui';
import Purchases from './Purchases';
import PartyList from './parties/PartyList';
import Expenses from './Expenses';
import { t } from '@/lib/i18n';

/**
 * PAISA BAAHAR JANE KA EK HI PAGE.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ye teen alag page kyun the, aur ab kyun nahi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Purchase, Supplier aur Kharch — teeno ek hi sawal ke hisse hain: "dukaan ka
 * paisa kahan gaya?" Par app me wo teen alag menu the, teen alag URL, aur
 * teeno ke beech jaane ka koi rasta nahi tha. Ek kharid likhne ke baad
 * supplier ka khata dekhna ho to menu kholo, Suppliers dhoondho, us supplier
 * pe jao. Kharch likhna ho to phir menu.
 *
 * Menu me teen jagah lene ka nuksaan bhi tha: jitni lambi list, utna hi
 * mushkil usme kuch dhoondhna.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Tab URL hi hai — `?tab=` nahi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Teeno tab apne PURANE pate pe hi rehte hain: `/purchases`, `/suppliers`,
 * `/expenses`. Ek hi component teeno raaste pe lagta hai aur pata dekh kar tay
 * karta hai ki kaunsa tab khula hai.
 *
 * Iska fayda saaf hai: har purana link jaisa tha waisa hi chalta hai —
 * Dashboard ka "Suppliers ko dena" (`/purchases?tab=dena`), party detail se
 * `/suppliers` pe wapas jana, bill form ka "Suppliers page pe jaayein" — kisi
 * ko chhuna nahi pada. Aur `?tab=` bhi khali rehta hai, jise Purchase page
 * apne andar wale "Dena hai" ke liye pehle se istemal karta hai. Do tab-system
 * ek hi shabd pe ladte, aur us ladai me dono kabhi kabhi galat tab khol dete.
 */

const TABS = [
  { to: '/purchases', value: 'purchases', label: 'Purchase', perm: 'purchases',
    subtitle: 'Maal andar aaya — stock apne aap badhta hai' },
  { to: '/suppliers', value: 'suppliers', label: 'Supplier', perm: 'parties',
    subtitle: 'Jinse aap maal khareedte hain' },
  { to: '/expenses', value: 'expenses', label: 'Kharch', perm: 'expenses',
    subtitle: 'Chai, petrol, kiraya, tankhwah — maal ke alawa ka kharcha' },
];

export default function Buying() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { can } = useAuth();

  const dikhne = TABS.filter((tb) => can(tb.perm));
  const abhi = TABS.find((tb) => pathname.startsWith(tb.to)) || TABS[0];

  /*
    Ek hi tab bacha ho to tab-patti dikhane ka koi matlab nahi.

    Hadd wale staff ke saath yahi hota hai: salesman ko sirf Kharch dikhta hai.
    Uske liye ek akela tab sirf ek aisa button hai jo kuch karta hi nahi.
  */
  const pattiChahiye = dikhne.length > 1;

  return (
    <>
      <PageHeader
        title={t('Kharid')}
        subtitle={t(abhi.subtitle)}
      />

      {pattiChahiye && (
        <Tabs
          className="mb-4"
          tabs={dikhne.map((tb) => ({ value: tb.value, label: tb.label }))}
          value={abhi.value}
          onChange={(v) => {
            const next = TABS.find((tb) => tb.value === v);
            /*
              Purchase tab pe wapas aate waqt `?tab=dena` saath le jate hain —
              taaki Dashboard se "Suppliers ko dena" pe aane ke baad Supplier
              tab dekh kar wapas aaye to wahi jagah mile jahan se gaya tha.
            */
            navigate(next.to + (next.value === 'purchases' ? search : ''));
          }}
        />
      )}

      {abhi.value === 'purchases' && <Purchases embedded />}
      {abhi.value === 'suppliers' && <PartyList type="supplier" embedded />}
      {abhi.value === 'expenses' && <Expenses embedded />}
    </>
  );
}

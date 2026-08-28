import PolicyShell, { Section, Points, COMPANY } from './PolicyShell';
import { t } from '@/lib/i18n';

/**
 * TERMS OF SERVICE.
 *
 * Do baatein jaan-boojh kar bahut saaf likhi hain, kyunki inhi do pe baad me
 * jhagda hota hai:
 *
 *   1. AAPKA DATA AAPKA HAI. Hum uske malik nahi hain, aur wo kabhi bhi
 *      nikala ja sakta hai.
 *   2. HISAAB AAPKA HAI. App jodne ka kaam karta hai; jo aap daalte hain wo
 *      sahi hai ya nahi, ye hum nahi jaante — aur GST/kanoon ka zimma aapka
 *      hi rehta hai.
 */
export default function Terms() {
  return (
    <PolicyShell
      title={t('Terms of Service')}
      subtitle={t('App istemal karne ki shartein')}
    >
      <Section heading={t('Ye kya hai')}>
        <p>
          {t('Rakh Rakhav thok (wholesale) aur khudra (retail) dukaan ke liye ek hisaab-kitaab ki app hai — stock, bill, khata, udhaar aur order ek jagah. Account banate hi ye shartein aap par lagu ho jati hain.')}
        </p>
      </Section>

      <Section heading={t('Kharidna free, bechna nahi')}>
        <Points items={[
          t('Kisi dukaan se maal DEKHNA aur KHARIDNA hamesha free hai — uske paise kabhi nahi lagte.'),
          t('Apna maal BECHNA — apna stock, apna bill, apne graahak — iske liye plan lena padta hai.'),
          t('Free wala aadmi jis din khud bechna chahe, us din use plan lena hoga.'),
        ]} />
      </Section>

      <Section heading={t('Account aur password')}>
        <Points items={[
          t('Ek phone number pe ek hi account banta hai.'),
          t('Ek number ek hi jagah login rehta hai. Naye phone pe login karte hi purana phone apne aap bahar ho jata hai.'),
          t('Apna password apne paas rakhein. Aapke account se jo kuch hota hai uska zimma aapka hai.'),
          t('Staff ko utni hi ijazat dein jitni zaroori hai — app me har aadmi ki alag hadd lagai ja sakti hai.'),
        ]} />
      </Section>

      <Section heading={t('Aapka data aapka hai')}>
        <p>
          {t('Aapki dukaan ka poora hisaab aapka hai. Hum uske malik nahi hain aur use kisi ko bechte nahi. "Backup" se aap use kabhi bhi apne paas nikaal sakte hain — plan chalu ho ya na ho.')}
        </p>
      </Section>

      <Section heading={t('Hisaab ka zimma aapka hai')}>
        <p>
          {t('App wahi jodta hai jo aap daalte hain. Aapne rate, quantity ya GST galat daala to jod bhi wahi aayega. Bill, GST return aur kanoon ke hisaab se jo bhi zaroori hai, uska zimma aapka apna hai — hum aapke CA ki jagah nahi lete.')}
        </p>
      </Section>

      <Section heading={t('Jo nahi karna hai')}>
        <Points items={[
          t('App ka istemal kisi gair-kanooni kaam ke liye.'),
          t('Kisi doosre ke account me ghusne ki koshish.'),
          t('App ko jaan-boojh kar bhari request bhej kar dheema karna ya todna.'),
          t('App ka code copy karna, bech dena, ya usse apni sewa banana.'),
        ]} />
        <p>{t('Aisa hone par account bina bataye band kiya ja sakta hai.')}</p>
      </Section>

      <Section heading={t('App band ho jaye to')}>
        <p>
          {t('Hum poori koshish karte hain ki app hamesha chale, par internet, bank ya server ki wajah se kabhi kabhi ruk sakti hai. Aisi rukawat se hone wale kisi bhi nuksan ka zimma hum nahi le sakte. Iske alawa hamari kul zimmedari zyada se zyada utni hi hai jitna paisa aapne pichhle 3 mahine me diya hai.')}
        </p>
      </Section>

      <Section heading={t('Account band karna')}>
        <Points items={[
          t('Aap kabhi bhi band kar sakte hain — band karne se pehle apna backup nikaal lijiye.'),
          t('Hum tabhi band karte hain jab upar likhi shartein tooti hon, ya bahut samay tak paisa na aaya ho.'),
          t('Band hone ke baad bhi kanoon ke hisaab se zaroori record utne samay tak rakhe jate hain jitna rakhna zaroori hai.'),
        ]} />
      </Section>

      <Section heading={t('Shartein badal sakti hain')}>
        <p>
          {t('Kuch bada badla to app me pehle bata denge. Uske baad app chalate rehne ka matlab hoga ki nayi shartein aapko manzoor hain.')}
        </p>
      </Section>

      <Section heading={t('Kanoon aur adalat')}>
        <p>
          {t('In shartein par Bharat ka kanoon lagu hoga. Koi jhagda ho to pehle {a} pe likhein — hum use aapas me hi suljhane ki koshish karenge.', { a: COMPANY.email })}
        </p>
      </Section>
    </PolicyShell>
  );
}

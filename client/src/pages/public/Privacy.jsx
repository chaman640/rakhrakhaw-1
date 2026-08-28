import PolicyShell, { Section, Points, COMPANY } from './PolicyShell';
import { t } from '@/lib/i18n';

/**
 * PRIVACY POLICY.
 *
 * Ye kagaz do logon ke liye hai aur dono ki zarurat alag hai: payment gateway
 * ko ye chahiye ki likha kya hai, aur dukaandaar ko ye ki uska data bikta to
 * nahi. Isliye bhasha seedhi rakhi hai — jo kagaz padha hi na jaye, wo bharosa
 * nahi banata.
 *
 * Jo yahan likha hai wo SACH ME app me waisa hi hai. Kanooni khaana bharne ke
 * liye jhoothi baat likh dena us din bahut mehnga padta hai jis din koi milaa
 * kar dekhta hai.
 */
export default function Privacy() {
  return (
    <PolicyShell
      title={t('Privacy Policy')}
      subtitle={t('Aapka data hum kya lete hain, kyun lete hain, aur uska karte kya hain')}
    >
      <Section heading={t('Chhoti si baat, shuru me hi')}>
        <p>
          {t('Hum aapka data kisi ko bechte nahi hain. Na kisi advertisement wale ko, na kisi aur company ko. Aapki dukaan ka hisaab aapka hai — hum use sirf app chalane ke liye rakhte hain.')}
        </p>
      </Section>

      <Section heading={t('Hum kya kya lete hain')}>
        <Points items={[
          t('Aapka naam, phone number aur dukaan ka naam — account banane ke liye.'),
          t('Aapki dukaan ka kaam — item, stock, bill, khata, payment, order. Ye sab aapka apna hisaab hai.'),
          t('Aapke graahak (retailer/supplier) ka naam, number aur pata — kyunki bill pe wo chhapta hai.'),
          t('Paise wala lena-den — kaunsa plan, kab liya, kitna diya. Card ya UPI ki detail hamare paas kabhi nahi aati (neeche dekhein).'),
          t('App chalate waqt banne wale zaroori nishaan — jaise galti ka record, taaki bug theek kiya ja sake.'),
        ]} />
      </Section>

      <Section heading={t('Card aur UPI ki detail hamare paas AATI HI NAHI')}>
        <p>
          {t('Paisa dene ka poora kaam payment gateway (Razorpay) ke apne surakshit page pe hota hai. Aapka card number, CVV, UPI PIN ya bank ka password hamare server tak pahunchta hi nahi. Humein sirf itna pata chalta hai ki payment hui ya nahi, kitne ki hui, aur uska ek reference number.')}
        </p>
      </Section>

      <Section heading={t('Hum ye data karte kya hain')}>
        <Points items={[
          t('App chalane ke liye — aapka hisaab dikhane, bill banane, khata jodne.'),
          t('OTP aur zaroori sandesh bhejne ke liye (SMS ya phone ki notification).'),
          t('Plan ka paisa lene aur uski rasid dene ke liye.'),
          t('Aapki madad karne ke liye jab aap khud humse sampark karein.'),
          t('Kanoon ke hisaab se jo record rakhna zaroori hai, wo rakhne ke liye.'),
        ]} />
      </Section>

      <Section heading={t('Kis kis ke saath baantte hain')}>
        <p>{t('Sirf unke saath jinke bina app chal hi nahi sakti, aur unhe bhi utna hi jitna zaroori hai:')}</p>
        <Points items={[
          t('Payment gateway — plan ka paisa lene ke liye.'),
          t('SMS aur notification bhejne wali sewa — OTP aur alert ke liye.'),
          t('Server aur database rakhne wali sewa — jahan aapka data rehta hai.'),
        ]} />
        <p>{t('Iske alawa kisi ko nahi — kanoon ya adalat ke aadesh ko chhod kar.')}</p>
      </Section>

      <Section heading={t('Aapki dukaan ka data sirf aapka hai')}>
        <p>
          {t('Har dukaan ka data alag rehta hai. Koi doosra wholesaler aapka stock, rate, khata ya graahak nahi dekh sakta. Aapka staff bhi utna hi dekh paata hai jitni aap ijazat dete hain.')}
        </p>
        <p>
          {t('Jab aap kisi dukaan se maal lete hain, to us dukaan ko utna hi dikhta hai jitna us lena-den se juda hai — aapka apna andaruni hisaab use nahi dikhta.')}
        </p>
      </Section>

      <Section heading={t('Kitne din rakhte hain')}>
        <p>
          {t('Jab tak aapka account chalu hai. Account band karne ke baad kanoon ke hisaab se zaroori record (jaise bill aur payment) utne saal rakhe jate hain jitne rakhna zaroori hai — baaki data hata diya jata hai.')}
        </p>
      </Section>

      <Section heading={t('Aapke haq')}>
        <Points items={[
          t('Apna poora data kabhi bhi nikaal sakte hain — app me hi "Backup" ka rasta hai.'),
          t('Galat detail theek karwa sakte hain.'),
          t('Account aur data hataane ke liye keh sakte hain.'),
          t('Zaroori sandesh chhod kar baaki notification band kar sakte hain.'),
        ]} />
        <p>{t('Inme se kuch bhi karna ho to {a} pe likh dijiye.', { a: COMPANY.email })}</p>
      </Section>

      <Section heading={t('Bachche')}>
        <p>{t('Ye app dhanda karne walon ke liye hai. 18 saal se kam umar walon se hum jaan-boojh kar koi data nahi lete.')}</p>
      </Section>

      <Section heading={t('Ye policy badalti rahegi')}>
        <p>
          {t('Kuch bada badla to app me bata denge. Upar likhi tareekh se pata chal jayega ki aakhri baar kab badla tha.')}
        </p>
      </Section>
    </PolicyShell>
  );
}

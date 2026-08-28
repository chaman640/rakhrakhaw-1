import PolicyShell, { Section, Points, COMPANY } from './PolicyShell';
import { t } from '@/lib/i18n';

/**
 * REFUND AUR CANCELLATION POLICY.
 *
 * Payment gateway is kagaz ko sabse dhyan se padhta hai, aur uski ek hi shart
 * hai: SAAF LIKHA HO. "Case by case dekha jayega" jaisi baat likhne se
 * application ruk jati hai — aur graahak ka bharosa bhi.
 *
 * Isliye yahan har haalat ka ek saaf jawab hai, aur wahi jawab code me bhi
 * waisa hi lagta hai. Do jagah do baat likhna wo galti hai jo pehle jhagde
 * me pakdi jati hai.
 */
export default function Refund() {
  return (
    <PolicyShell
      title={t('Refund aur Cancellation Policy')}
      subtitle={t('Paisa kab wapas milta hai, kab nahi, aur kitne din me')}
    >
      <Section heading={t('Sabse pehle — pehle chala kar dekh lijiye')}>
        <p>
          {t('Kharidne wala poora hissa hamesha free hai — usme paisa lagta hi nahi. Bechne wale hisse ka bhi poora kaam aap plan lene se pehle dekh sakte hain. Isliye paisa dene se pehle hi aapko pata hota hai ki aap kya le rahe hain.')}
        </p>
      </Section>

      <Section heading={t('7 din ki poori wapasi')}>
        <p>
          {t('Pehli baar plan lene ke 7 din ke andar agar aapko lage ki ye app aapke kaam ka nahi hai, to poora paisa wapas. Koi wajah batane ki zarurat nahi.')}
        </p>
        <p>{t('Bas {a} pe likh dijiye — jis number se account bana hai wo saath me likh dein.', { a: COMPANY.email })}</p>
      </Section>

      <Section heading={t('7 din ke baad')}>
        <Points items={[
          t('Jo mahina chalu hai uska paisa wapas nahi hota — wo sewa aap istemal kar chuke hain.'),
          t('Renew band kar dein to aage ka paisa katega hi nahi. Jitni mohlat baaki hai, utne din sab chalta rahega.'),
          t('Galti se do baar paisa kat gaya, ya paisa kat gaya aur plan chalu nahi hua — to poora paisa wapas, chahe kitne bhi din ho gaye hon.'),
        ]} />
      </Section>

      <Section heading={t('Renew band karna')}>
        <p>
          {t('App me Settings → Plan me jaakar kabhi bhi band kar sakte hain. Turant band ho jata hai aur aage se paisa nahi katta. Jo mahina aap de chuke hain wo poora chalta rahega — beech me kuch band nahi hota.')}
        </p>
      </Section>

      <Section heading={t('Paisa kitne din me wapas aayega')}>
        <Points items={[
          t('Hum 3 kaam ke din ke andar wapasi chala dete hain.'),
          t('Bank tak pahunchne me aam taur pe 5 se 7 kaam ke din aur lagte hain — ye bank ka apna waqt hai, hamare haath me nahi.'),
          t('Paisa usi jagah wapas jata hai jahan se aaya tha — usi card ya usi UPI par.'),
        ]} />
      </Section>

      <Section heading={t('Plan chhota ya bada karna')}>
        <Points items={[
          t('Bada plan lene par bacha hua paisa nayе plan me jud jata hai — jo din aapne de rakhe hain wo marte nahi.'),
          t('Chhota plan lena ho to wo agle mahine se lagta hai. Chalu mahine ka paisa wapas nahi hota.'),
        ]} />
      </Section>

      <Section heading={t('Ek baat saaf saaf')}>
        <p>
          {t('Aapka data kabhi delete nahi hota, chahe plan khatam ho jaye. Mohlat khatam hone par bechne ka kaam ruk jata hai, par aapka stock, bill aur khata sab waise ka waisa rehta hai — plan dobara lete hi sab wapas mil jata hai. Aur "Backup" se aap apna poora data kabhi bhi nikaal sakte hain.')}
        </p>
      </Section>
    </PolicyShell>
  );
}

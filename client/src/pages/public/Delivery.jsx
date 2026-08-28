import PolicyShell, { Section, Points } from './PolicyShell';
import { t } from '@/lib/i18n';

/**
 * DELIVERY / SHIPPING POLICY.
 *
 * Payment gateway ye kagaz HAR merchant se maangta hai — chahe wo koi cheez
 * bhejta hi na ho. Software wale ke liye ye ajeeb lagta hai, par uska form
 * bina iske aage nahi badhta.
 *
 * Isliye yahan wahi likha hai jo sach hai: koi saamaan nahi jata, sewa turant
 * chalu ho jati hai. Ye jhoothi "shipping" wali baatein likhne se behtar hai —
 * aur padhne wale ko bhi turant samajh aa jata hai.
 */
export default function Delivery() {
  return (
    <PolicyShell
      title={t('Delivery Policy')}
      subtitle={t('Paisa dene ke baad sewa kab aur kaise chalu hoti hai')}
    >
      <Section heading={t('Koi saamaan nahi bhejа jata')}>
        <p>
          {t('Rakh Rakhav ek software sewa hai. Isme koi cheez daak ya courier se nahi aati — sab kuch app ke andar hi hota hai.')}
        </p>
      </Section>

      <Section heading={t('Sewa kab chalu hoti hai')}>
        <Points items={[
          t('Payment poori hote hi — TURANT. Kuch second me hi aapka plan chalu ho jata hai.'),
          t('Bank ki taraf se der ho jaye to zyada se zyada 30 minute. Utne me bhi na ho to hum khud dekh lete hain.'),
          t('Rasid (receipt) usi waqt app me dikh jati hai aur email pe bhi chali jati hai.'),
        ]} />
      </Section>

      <Section heading={t('Sewa kahan tak chalti hai')}>
        <p>
          {t('Poore Bharat me, jahan bhi internet chal raha ho. App phone, tablet aur computer — teeno pe chalti hai.')}
        </p>
      </Section>

      <Section heading={t('Paisa kat gaya par plan chalu nahi hua')}>
        <p>
          {t('Aisa bahut kam hota hai, par ho sakta hai — bank ya network ki wajah se. Aise me humse sampark kijiye. Ya to plan turant chalu kar diya jayega, ya poora paisa wapas — aur uske liye 7 din wali koi shart nahi lagti.')}
        </p>
      </Section>
    </PolicyShell>
  );
}

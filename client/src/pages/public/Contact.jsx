import PolicyShell, { Section, COMPANY } from './PolicyShell';
import { t } from '@/lib/i18n';

/**
 * SAMPARK (Contact Us).
 *
 * Payment gateway is page ko alag se maangta hai, aur ek khaas cheez dekhta
 * hai: sampark ka rasta SAAF dikhe, kisi form ke peeche chhupa na ho. Isliye
 * yahan email seedha likha hua hai aur dabate hi khul jata hai.
 */
export default function Contact() {
  return (
    <PolicyShell
      title={t('Sampark')}
      subtitle={t('Koi dikkat, koi sawal, ya paise se juda kuch — seedha likh dijiye')}
    >
      <Section heading={t('Email')}>
        <p>
          <a className="text-brand-700 hover:underline" href={`mailto:${COMPANY.email}`}>
            {COMPANY.email}
          </a>
        </p>
        <p className="text-slate-600">
          {t('Hum aam taur pe ek kaam ke din ke andar jawab dete hain.')}
        </p>
      </Section>

      <Section heading={t('Likhte waqt ye zaroor batayein')}>
        <p className="text-slate-600">
          {t('Jis number se account bana hai, aur dikkat kya aa rahi hai. Paise se juda mamla ho to payment ka reference number bhi — usse hum turant dhoondh lete hain.')}
        </p>
      </Section>

      <Section heading={t('Website')}>
        <p>{`https://${COMPANY.site}`}</p>
      </Section>
    </PolicyShell>
  );
}

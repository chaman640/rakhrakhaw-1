import { Link } from 'react-router-dom';
import { Clock, TriangleAlert } from 'lucide-react';
import { useBilling } from '@/hooks/useBilling';
import { t } from '@/lib/i18n';

/**
 * TRIAL KI PATTI — 7, 3, 1 din pehle, aur khatam hone pe.
 *
 * Pehle 8 din kuch nahi dikhta — naya aadmi app seekh raha hai, use har page
 * pe "paisa do" nahi chahiye. Aakhri hafte me patti aati hai, aakhri din laal.
 */
export default function TrialBanner() {
  const b = useBilling();
  if (!b?.chargingNow || !b.trial) return null;

  if (b.trial.expired) {
    return (
      <Link to="/autopay"
        className="flex items-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white">
        <TriangleAlert size={15} className="shrink-0" />
        <span className="flex-1">{t('Free trial khatam ho gaya — bechna chalu rakhne ke liye plan lein')}</span>
        <span className="underline">{t('Plan lein')}</span>
      </Link>
    );
  }

  const d = b.trial.daysLeft;
  if (!b.trial.on || d > 7) return null;
  const urgent = d <= 1;
  return (
    <Link to="/autopay"
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${urgent ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
      <Clock size={15} className="shrink-0" />
      <span className="flex-1">
        {d <= 0 ? t('Free trial aaj khatam ho raha hai') : t('Free trial ke {n} din baaki', { n: d })}
      </span>
      <span className="underline">{t('Plan lein')}</span>
    </Link>
  );
}

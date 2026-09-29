import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { useFeature } from '@/hooks/useBilling';
import { Card, Button } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * PLAN KE BAHAR WALA FEATURE — chhupate nahi, samjhate hain.
 *
 * Button gayab kar dena aadmi ko ye bhi nahi batata ki aisa kuch hai. Isliye
 * page khulta hai, par uski jagah saaf likha hota hai: "Ye ₹500 wale plan me
 * hai" aur plan dekhne ka button. Yahi bade plan ki keemat samjhata hai.
 */
export function UpgradeCard({ info, compact = false }) {
  if (!info) return null;
  return (
    <Card className={compact ? '' : 'mx-auto max-w-lg'}>
      <div className="flex flex-col items-center py-6 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Lock size={22} />
        </span>
        <p className="text-base font-semibold text-slate-900">{t(info.name)}</p>
        <p className="mt-1 text-sm text-slate-600">
          {info.plan
            ? t('Ye {plan} (₹{amt}/mahina) ya usse upar ke plan me hai.', { plan: info.plan.name, amt: info.plan.priceRupees })
            : t('Ye abhi band hai.')}
        </p>
        {info.plan && (
          <Link to="/profile?tab=plan" className="mt-4">
            <Button icon={Sparkles}>{t('Plan dekhein')}</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

export default function FeatureGate({ feature, children }) {
  const { allowed, lockedInfo } = useFeature(feature);
  if (allowed) return children;
  return <UpgradeCard info={lockedInfo} />;
}

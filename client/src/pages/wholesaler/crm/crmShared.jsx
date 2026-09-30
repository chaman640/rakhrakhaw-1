import { Flame } from 'lucide-react';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export const SEGMENT = {
  vip: ['VIP', 'amber'],
  high_value: ['High value', 'green'],
  regular: ['Regular', 'blue'],
  new: ['New', 'brand'],
  at_risk: ['Going quiet', 'amber'],
  inactive: ['Inactive', 'red'],
  declining: ['Buying less', 'red'],
};

export const SegmentBadges = ({ list = [] }) => list.map((s) => <Badge key={s} tone={SEGMENT[s]?.[1]}>{t(SEGMENT[s]?.[0] || s)}</Badge>);

export function ScorePill({ score, className }) {
  if (score === null || score === undefined) return null;
  const tone = score >= 75 ? 'bg-emerald-100 text-emerald-800' : score >= 50 ? 'bg-sky-100 text-sky-800' : score >= 25 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', tone, className)} title={t('Customer score')}>
      {score >= 75 && <Flame size={11} />}{score}
    </span>
  );
}

export const COMPLAINT_STATUS = {
  new: ['New', 'slate'], assigned: ['Assigned', 'blue'], processing: ['Processing', 'amber'], resolved: ['Resolved', 'green'], closed: ['Closed', 'slate'],
};
export const COMPLAINT_PRIORITY = { urgent: ['Urgent', 'red'], medium: ['Medium', 'amber'], normal: ['Normal', 'green'] };
export const COMPLAINT_CATEGORY = [
  ['damaged', 'Damaged goods'], ['short_supply', 'Short supply'], ['wrong_item', 'Wrong item'], ['quality', 'Quality issue'],
  ['late_delivery', 'Late delivery'], ['billing', 'Billing issue'], ['other', 'Other'],
];

export const daysText = (n) => (n === null || n === undefined ? t('Never') : n === 0 ? t('Today') : t('{n} days ago', { n }));

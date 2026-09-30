import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { Select } from '@/components/ui';
import { t } from '@/lib/i18n';

/** Which bank account non-cash money went through; hidden when there is only one */
export default function BankSelect({ value, onChange, label = 'Bank account' }) {
  const { data } = useQuery(['bank-options'], () => api.get('/accounts/bank-options').then((r) => r.data), { poll: false });
  if (!data || data.length < 2) return null;
  const def = data.find((b) => b.isDefault);
  return (
    <Select label={t(label)} value={value || ''} onChange={(e) => onChange(e.target.value || null)}
      options={[{ value: '', label: def ? `${def.name} (${t('default')})` : t('Default account') }, ...data.filter((b) => !b.isDefault).map((b) => ({ value: b._id, label: b.name }))]} />
  );
}

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useShop } from '@/context/ShopContext';
import { Card, Switch, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * Hafte/mahine ka hisaab (fayda-nuksan + udhaar) — malik ko hamesha jata hai;
 * yahan se manager/admin staff ko bhi bhejna chalu kar sakte hain.
 */
export default function DigestSetting() {
  const { user, business, can, refresh } = useAuth();
  const { buying } = useShop();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  if (buying || user?.role !== 'wholesaler' || !business || !can('settings:edit')) return null;

  async function toggle(value) {
    setSaving(true);
    try {
      await api.put('/business/me', { digestToManagers: value });
      await refresh();
      toast.success(t('Setting saved'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><BarChart3 size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{t('Hafte aur mahine ka hisaab')}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('Har somvaar pichhle hafte ka aur har mahine ki 1 tareekh ko pichhle mahine ka fayda-nuksan aur udhaar — malik ko hamesha aata hai.')}
          </p>
          <div className="mt-3">
            <Switch
              id="digest-managers"
              checked={Boolean(business.digestToManagers)}
              onChange={toggle}
              disabled={saving}
              label={t('Managers ko bhi bhejein')}
              description={t('Manager aur admin staff jinhe fayda-nuksan dekhne ki ijazat hai, unhe bhi ye notification jayega.')}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

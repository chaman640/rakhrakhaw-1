import { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { enablePush, disablePush, isPushOn, pushSupported, pushState } from '@/lib/push';
import { t } from '@/lib/i18n';

export default function PushToggle({ compact = false }) {
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    isPushOn().then(setOn).catch(() => {});
  }, []);

  if (!pushSupported()) return null;

  const denied = pushState() === 'denied';

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        toast.success(t('Is phone pe notification band'));
        return;
      }
      const res = await enablePush();
      if (res === 'on') { setOn(true); toast.success(t('Ab is phone pe notification aayenge')); }
      else if (res === 'denied') toast.error(t('Phone ne mana kar diya — browser ki setting me is site ke liye notification chalu karein'));
      else if (res === 'off') { setReady(false); toast.error(t('Notification ki setting abhi lagi nahi hai')); }
    } catch (err) {
      toast.error(err.message);
    } finally { setBusy(false); }
  }

  if (!ready) return null;

  if (compact) {
    return (
      <Button size="sm" variant={on ? 'secondary' : 'primary'} icon={on ? BellRing : Bell}
        loading={busy} disabled={denied} onClick={toggle}>
        {on ? t('Notification chalu hai') : t('Phone pe notification chalu karein')}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {on ? <BellRing size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          : <BellOff size={18} className="mt-0.5 shrink-0 text-slate-400" />}
        <div>
          <p className="text-sm font-medium text-slate-900">
            {on ? t('Phone pe notification chalu hai') : t('Phone pe notification')}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {denied
              ? t('Browser ne is site ke liye notification band kar rakhe hain. Address bar ke taale wale nishaan se chalu karein.')
              : t('Naya order, paisa aaya, stock khatam — sab ka alert seedha phone pe, jaise baaki app ke aate hain. Iske paise nahi lagte.')}
          </p>
        </div>
      </div>
      <Button size="sm" variant={on ? 'secondary' : 'primary'} loading={busy} disabled={denied}
        onClick={toggle} className="shrink-0">
        {on ? t('Band karein') : t('Chalu karein')}
      </Button>
    </div>
  );
}

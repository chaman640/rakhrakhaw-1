import { useState } from 'react';
import { Copy, Check, RefreshCw, MessageCircle, Link2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, Button, Switch, ConfirmModal, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

/** Retailers page aur Settings dono me yahi card use hota hai */
export default function InviteCard({ compact = false }) {
  const { business, refresh, isOwner } = useAuth();
  const toast = useToast();

  const [local, setLocal] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const biz = local || business || {};
  const inviteLink = biz.inviteLink || (biz.inviteCode ? `${window.location.origin}/s/${biz.inviteCode}` : '');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy nahi hua — link select karke khud copy kar lein');
    }
  }

  function shareOnWhatsapp() {
    const text = `Namaste! ${biz.name} ka poora maal aur daam yahan dekhein — order karne ke liye account bana lijiye:\n${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  async function regenerate() {
    setBusy(true);
    try {
      const res = await api.post('/business/invite/regenerate');
      setLocal({ ...biz, ...res.data });
      await refresh();
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  async function toggleSetting(key, value) {
    try {
      const res = await api.put('/business/me', { [key]: value });
      setLocal(res.data);
      await refresh();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Invite link sirf malik ke paas rehta hai — server ab staff ko bhejta hi nahi.
  // (Jiske paas link hai wo retailer ban kar ghus sakta hai, aur naya link sirf
  // malik bana sakte hain — isliye leak hone par pata bhi nahi chalta.)
  if (!isOwner) {
    return (
      <Card>
        <CardHeader
          title={t('Retailer invite link')}
          subtitle={t('Naye retailer jodne ka link')}
        />
        <p className="text-sm text-slate-500">
          {t('Ye link sirf dukaan ke malik ke paas rehta hai. Kisi naye retailer ko jodna ho to unse link mangwa lijiye.')}
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title={t('Retailer invite link')}
          subtitle={t('Yahi ek link apne saare retailers ko WhatsApp pe bhej dein')}
        />

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <Link2 size={16} className="shrink-0 text-slate-400" />
          <span className="flex-1 truncate font-mono text-sm text-slate-700">{inviteLink || '—'}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon={copied ? Check : Copy} onClick={copyLink} variant={copied ? 'success' : 'primary'}>
            {copied ? 'Copy ho gaya' : 'Copy karein'}
          </Button>
          <Button size="sm" variant="secondary" icon={MessageCircle} onClick={shareOnWhatsapp}>
            {t('WhatsApp pe bhejein')}
          </Button>
          <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => setConfirm(true)}>
            {t('Naya link banayein')}
          </Button>
        </div>

        {!compact && (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
            <Switch
              id="invite-enabled"
              checked={biz.inviteEnabled !== false}
              onChange={(v) => toggleSetting('inviteEnabled', v)}
              label={t('Link chalu rakhein')}
              description={t('Band karne par koi naya retailer register nahi kar payega')}
            />
            <Switch
              id="auto-approve"
              checked={Boolean(biz.autoApproveRetailers)}
              onChange={(v) => toggleSetting('autoApproveRetailers', v)}
              label={t('Apne aap approve kar do')}
              description={t('On karne par link se aane wala har retailer turant catalog dekh sakega')}
            />
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={regenerate}
        loading={busy}
        title={t('Naya link banayein?')}
        message={t('Purana link turant band ho jayega. Jinko purana link bheja tha wo register nahi kar payenge — unhe naya link dobara bhejna padega. Jo retailers pehle se jud chuke hain unpe koi asar nahi hoga.')}
        confirmLabel={t("Haan, naya banayein")}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import { Share2, Link2, MessageCircle, Check, Search, Package } from 'lucide-react';
import api from '@/lib/api';
import { waLink } from '@/lib/share';
import { formatMoney } from '@/lib/format';
import { useDebounce } from '@/hooks/useDebounce';
import { Modal, Button, Spinner, useToast } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * ITEM BHEJNA — teen raste, ek jagah.
 *
 *   WhatsApp / Share  — phone ka apna share parda (WhatsApp, Telegram, SMS
 *                       — jo bhi ho). Computer pe seedha WhatsApp Web.
 *   Link copy         — kahin bhi chipkaane ke liye.
 *   App chat          — apne kisi retailer ki chat me item ka card (photo,
 *                       naam, rate) jata hai; wo tap kare to seedha item khule.
 *
 * Link wahi public page hai jo bina login ke khulta hai (`/s/CODE/item/ID`) —
 * jiske paas app nahi, wo bhi dekh sakta hai aur wahin se order kar sakta hai.
 *
 * `inviteCode` na ho (ya chat ka rasta na ho, jaise buyer ki taraf) to wo
 * button dikhte hi nahi.
 */
export default function ShareItemModal({ open, onClose, item, inviteCode, rate, withChat = false }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const [parties, setParties] = useState(null);
  const [sentTo, setSentTo] = useState({});

  useEffect(() => {
    if (!open) { setChatOpen(false); setQ(''); setSentTo({}); setCopied(false); }
  }, [open]);

  useEffect(() => {
    if (!chatOpen) return undefined;
    let alive = true;
    setParties(null);
    api.get('/chat/search', { params: { q: debouncedQ } })
      .then((r) => { if (alive) setParties(r.data || []); })
      .catch(() => { if (alive) setParties([]); });
    return () => { alive = false; };
  }, [chatOpen, debouncedQ]);

  if (!item) return null;

  const link = inviteCode ? `${window.location.origin}/s/${inviteCode}/item/${item._id}` : '';
  const price = rate ?? item.wholesalePrice ?? item.salePrice ?? item.rate;
  const text = [
    item.name,
    price ? `${formatMoney(price)} / ${item.unit || 'PCS'}` : '',
    link,
  ].filter(Boolean).join('\n');

  async function shareOut() {
    if (navigator.share) {
      try {
        await navigator.share({ title: item.name, text, url: link || undefined });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }
    window.open(waLink(text), '_blank', 'noopener');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('Copy nahi hua — link khud select karke copy karein'));
    }
  }

  async function sendInChat(p) {
    setSentTo((s) => ({ ...s, [p.partyId]: 'sending' }));
    try {
      await api.post(`/chat/${p.partyId}/messages`, { type: 'item', refId: item._id });
      setSentTo((s) => ({ ...s, [p.partyId]: 'sent' }));
    } catch (err) {
      setSentTo((s) => ({ ...s, [p.partyId]: undefined }));
      toast.error(err.message);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('Item bhejein')} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Package size={18} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">{item.name}</p>
            {price ? <p className="text-sm text-slate-500">{formatMoney(price)} / {item.unit || 'PCS'}</p> : null}
          </div>
        </div>

        <div className="grid gap-2">
          <Button icon={Share2} onClick={shareOut}>{t('WhatsApp / share karein')}</Button>
          {link && (
            <Button variant="secondary" icon={copied ? Check : Link2} onClick={copyLink}>
              {copied ? t('Link copy ho gaya') : t('Link copy karein')}
            </Button>
          )}
          {withChat && (
            <Button variant="secondary" icon={MessageCircle} onClick={() => setChatOpen((v) => !v)}>
              {t('App chat me bhejein')}
            </Button>
          )}
        </div>

        {withChat && chatOpen && (
          <div className="rounded-lg border border-slate-200">
            <div className="relative border-b border-slate-200">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('Retailer ka naam ya phone')}
                className="w-full rounded-t-lg py-2.5 pl-9 pr-3 text-sm outline-none"
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {parties === null ? (
                <div className="flex justify-center py-6 text-slate-400"><Spinner size={20} /></div>
              ) : !parties.length ? (
                <p className="py-6 text-center text-sm text-slate-500">{t('Koi retailer nahi mila')}</p>
              ) : parties.map((p) => (
                <div key={p.partyId} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    {p.phone && <p className="text-xs text-slate-500">{p.phone}</p>}
                  </div>
                  {sentTo[p.partyId] === 'sent' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Check size={14} /> {t('Bhej diya')}
                    </span>
                  ) : (
                    <Button size="sm" variant="secondary" loading={sentTo[p.partyId] === 'sending'}
                      onClick={() => sendInChat(p)}>
                      {t('Bhejein')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

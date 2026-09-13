import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Image as ImageIcon, Store, Package, FileText, ChevronRight } from 'lucide-react';
import { Spinner, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

const POLL_MS = 4000;

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * EK CHAT KI POORI SCREEN — wholesaler aur retailer dono isi ko istemal karte
 * hain, bas `myRole` aur do function (padhna/bhejna) badal jate hain.
 *
 * Naya WebSocket nahi laga — poore app me kahin bhi nahi hai (jaan-boojh kar,
 * "polling kaafi hai" — dekho jahan pehle se hai). Isliye yahan bhi हर
 * {POLL_MS} par turant poochh lete hain "kuch naya aaya?" — chat khuli ho tabhi.
 */
export default function ChatThreadView({
  myRole, contactName, contactAvatar, onBack, fetchMessages, postMessage, onOpenRef,
}) {
  const toast = useToast();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  async function load() {
    try {
      const list = await fetchMessages();
      setMessages(list);
    } catch (err) {
      if (messages === null) toast.error(err.message); // pehli baar hi bata do, baar-baar nahi
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  async function sendText() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText('');
    try {
      const fd = new FormData();
      fd.append('type', 'text');
      fd.append('text', value);
      await postMessage(fd);
      await load();
    } catch (err) {
      toast.error(err.message);
      setText(value); // wapas daal do, gum na ho
    } finally {
      setSending(false);
    }
  }

  async function sendPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || sending) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('type', 'photo');
      fd.append('photo', file);
      await postMessage(fd);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50">
      {/* ── header ── */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <button type="button" onClick={onBack} aria-label={t('Wapas')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-ring">
          <ArrowLeft size={20} />
        </button>
        {contactAvatar ? (
          <img src={contactAvatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Store size={17} />
          </div>
        )}
        <p className="truncate text-sm font-semibold text-slate-900">{contactName}</p>
      </div>

      {/* ── messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages === null ? (
          <div className="flex justify-center py-10"><Spinner size={22} className="text-slate-400" /></div>
        ) : !messages.length ? (
          <p className="mt-10 text-center text-sm text-slate-400">{t('Yahan koi message nahi hai — kuch likh kar shuru karein')}</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const mine = m.senderRole === myRole;
              const isShare = m.type === 'item' || m.type === 'order';
              return (
                <div key={m._id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[78%] rounded-2xl text-sm shadow-sm',
                    isShare ? 'overflow-hidden p-0' : 'px-3 py-2',
                    mine ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-white text-slate-900',
                  )}>
                    {m.type === 'photo' && m.imageUrl && (
                      <img src={m.imageUrl} alt="" className="mb-1 max-h-64 w-full rounded-lg object-cover" />
                    )}

                    {isShare && (
                      <button
                        type="button"
                        onClick={() => onOpenRef?.(m.type, m.refId)}
                        className={cn(
                          'flex w-full items-center gap-2.5 p-2.5 text-left focus-ring',
                          mine ? 'hover:bg-white/10' : 'hover:bg-slate-50',
                        )}
                      >
                        {m.type === 'item' && m.imageUrl ? (
                          <img src={m.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
                            mine ? 'bg-white/15' : 'bg-slate-100',
                          )}>
                            {m.type === 'order' ? <FileText size={18} /> : <Package size={18} />}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{m.title}</p>
                          <p className={cn('truncate text-xs', mine ? 'text-white/75' : 'text-slate-500')}>{m.subtitle}</p>
                        </div>
                        <ChevronRight size={16} className={mine ? 'text-white/60' : 'text-slate-400'} />
                      </button>
                    )}

                    <div className={isShare ? 'px-2.5 pb-2' : ''}>
                      {m.text && <p className="whitespace-pre-line">{m.text}</p>}
                      <p className={cn('mt-1 text-right text-[10px]', mine ? 'text-white/70' : 'text-slate-400')}>
                        {timeLabel(m.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── composer ── */}
      <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-2.5">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={sendPhoto} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={sending}
          aria-label={t('Photo bhejein')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-ring disabled:opacity-50">
          <ImageIcon size={20} />
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendText(); }}
          placeholder={t('Message likhein')}
          className="h-10 flex-1 rounded-full border border-slate-300 px-4 text-sm focus-ring"
        />
        <button type="button" onClick={sendText} disabled={sending || !text.trim()} aria-label={t('Bhejein')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white disabled:opacity-40">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

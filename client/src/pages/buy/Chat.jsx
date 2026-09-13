import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Store } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { useDebounce } from '@/hooks/useDebounce';
import { PageHeader, Card, SearchInput, Spinner, EmptyState } from '@/components/ui';
import { t } from '@/lib/i18n';

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t('abhi');
  if (mins < 60) return t('{n} min', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('{n} ghante', { n: hrs });
  return t('{n} din', { n: Math.floor(hrs / 24) });
}

/**
 * Retailer ki chat list — apni saari juri hui dukaanon me se, jinse baat ho
 * chuki hai. Naya shuru karne ke liye search sirf JUDI HUI dukaano me hota
 * hai — koi bhi anjaan dukaan se seedha chat nahi ho sakti.
 */
export default function Chat() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounce(q);
  const searching = debouncedQ.trim().length > 0;

  const { data: conversations, loading } = useQuery(
    ['my-chat-conversations'],
    () => api.get('/my/chat/conversations').then((r) => r.data),
  );

  const { data: searchResults, loading: searchLoading } = useQuery(
    ['my-chat-search', debouncedQ],
    () => api.get('/my/chat/search', { params: { q: debouncedQ } }).then((r) => r.data),
    { enabled: searching },
  );

  const list = searching ? searchResults : conversations;
  const busy = searching ? searchLoading : loading;

  return (
    <>
      <PageHeader title={t('Chat')} subtitle={t('Dukaandaar se seedha baat')} />

      <SearchInput value={q} onChange={setQ} placeholder={t('Apni dukaanon me dhundhein')} className="mb-3" />

      {busy && !list ? (
        <div className="flex justify-center py-16"><Spinner size={24} className="text-slate-400" /></div>
      ) : !list?.length ? (
        <Card>
          <EmptyState
            icon={MessageCircle}
            title={searching ? t('Koi nahi mila') : t('Abhi koi chat nahi')}
            message={searching ? '' : t('Upar search karke kisi judi hui dukaan se baat shuru karein')}
          />
        </Card>
      ) : (
        <Card padding={false}>
          {list.map((c) => (
            <button
              key={c.businessId}
              type="button"
              onClick={() => navigate(`/buy/chat/${c.businessId}`, { state: { name: c.name, logoUrl: c.logoUrl } })}
              className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-0 hover:bg-slate-50 focus-ring"
            >
              {c.logoUrl ? (
                <img src={c.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Store size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                  {c.lastMessageAt && <span className="shrink-0 text-xs text-slate-400">{timeAgo(c.lastMessageAt)}</span>}
                </div>
                <p className="truncate text-xs text-slate-500">
                  {c.lastMessageSnippet !== undefined
                    ? (c.lastMessageSnippet || t('Baat shuru karein'))
                    : t('Naya chat shuru karein')}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold text-white">
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </Card>
      )}
    </>
  );
}

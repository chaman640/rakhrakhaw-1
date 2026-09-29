import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, X } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { t } from '@/lib/i18n';

/**
 * PLATFORM KI SOOCHNA — Admin Panel → Soochna se aati hai.
 *
 * Ek baar me ek (sabse nayi). "X" dabaya to is phone pe dobara nahi dikhti
 * (localStorage me id) — agli nayi soochna phir dikhegi.
 */
const KEY = 'rr_ann_seen';
const readSeen = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };

const TONE = {
  info: 'bg-sky-50 text-sky-900 border-sky-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
};

export default function AnnouncementBar() {
  const { data } = useQuery(['announcements'], () => api.get('/announcements').then((r) => r.data), { poll: 300_000, staleTime: 120_000 });
  const [seen, setSeen] = useState(readSeen);

  const a = (data || []).find((x) => !seen.includes(String(x._id)));
  if (!a) return null;

  const hide = () => {
    const next = [...seen, String(a._id)].slice(-50);
    setSeen(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ }
  };

  const body = (
    <span className="min-w-0 flex-1">
      <span className="font-semibold">{a.title}</span>
      {a.body && <span className="ml-1 opacity-90">{a.body}</span>}
    </span>
  );

  return (
    <div className={`flex items-start gap-2 border-b px-4 py-2 text-sm ${TONE[a.tone] || TONE.info}`}>
      <Megaphone size={15} className="mt-0.5 shrink-0" />
      {a.link?.startsWith('/') ? <Link to={a.link} className="min-w-0 flex-1 hover:underline">{body}</Link>
        : a.link ? <a href={a.link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 hover:underline">{body}</a>
          : body}
      <button type="button" onClick={hide} aria-label={t('Band karein')} className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100">
        <X size={15} />
      </button>
    </div>
  );
}

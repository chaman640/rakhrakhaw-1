import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PlayCircle, ChevronLeft } from 'lucide-react';
import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { Modal } from '@/components/ui';
import { getLang } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/cn';

// Kis page pe kaunsi jagah — admin isi naam se video lagata hai
const ROUTE_PLACEMENT = [
  ['/home', 'dashboard'], ['/dashboard', 'dashboard'], ['/menu', 'dashboard'],
  ['/items', 'module:items'], ['/sales', 'module:sales'], ['/invoices', 'module:sales'], ['/sale/new', 'module:sales'],
  ['/purchases', 'module:purchase'], ['/expenses', 'module:purchase'], ['/suppliers', 'module:purchase'],
  ['/orders', 'module:orders'], ['/khata', 'module:khata'], ['/payments', 'module:khata'], ['/crm', 'module:crm'],
  ['/today', 'module:crm'], ['/hr', 'module:hr'], ['/accounts', 'module:accounts'], ['/reports', 'module:reports'],
  ['/staff', 'module:staff'], ['/buy', 'module:buy'], ['/shop', 'module:buy'], ['/emp', 'employee_app'], ['/help', 'help'],
];
export const placementFor = (path) => ROUTE_PLACEMENT.find(([p]) => path === p || path.startsWith(`${p}/`))?.[1] || '';

export const contentLang = () => (getLang() === 'en' ? 'en' : 'hi');
export const platformNow = () => (/Android/i.test(navigator.userAgent) ? 'android' : 'web');
function viewerKey() {
  try {
    let k = localStorage.getItem('rr_viewer');
    if (!k) { k = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('rr_viewer', k); }
    return k;
  } catch { return 'anon'; }
}

export function embedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}?rel=0`;
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v') || u.pathname.split('/').pop();
      return `https://www.youtube.com/embed/${v}?rel=0`;
    }
    return '';
  } catch { return ''; }
}

export function useHelpContent(placement, kind = '') {
  const lang = contentLang();
  return useQuery(['content', placement, lang, kind], () => api.get('/content', { params: { placement, lang, platform: platformNow(), kind } }).then((r) => r.data), { enabled: Boolean(placement), poll: false, staleTime: 5 * 60 * 1000 });
}

/** Video chalata hai aur band hone par "kitna dekha" server ko batata hai */
export function VideoPlayer({ item }) {
  const started = useRef(Date.now());
  const ended = useRef(false);
  useEffect(() => {
    started.current = Date.now();
    ended.current = false;
    return () => {
      api.post(`/content/${item._id}/view`, {
        viewerKey: viewerKey(), lang: item.lang, platform: platformNow(),
        seconds: Math.round((Date.now() - started.current) / 1000), completed: ended.current,
      }).catch(() => {});
    };
  }, [item._id, item.lang]);
  const yt = embedUrl(item.url);
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
      {yt
        ? <iframe title={item.title} src={yt} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        : <video src={item.url} poster={item.thumbnailUrl || undefined} controls className="h-full w-full" onEnded={() => { ended.current = true; }} />}
    </div>
  );
}

export function VideoList({ items, onPick }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((v) => (
        <li key={v._id}>
          <button type="button" onClick={() => onPick(v)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50">
            {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" /> : <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-slate-100 text-brand-700"><PlayCircle size={22} /></span>}
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{v.title}</span>
              {v.description && <span className="block truncate text-xs text-slate-500">{v.description}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "Kaise karein" button — sirf tab dikhta hai jab is page ke liye video ho */
export default function HelpVideos({ placement, variant = 'icon', className }) {
  const { pathname } = useLocation();
  const where = placement || placementFor(pathname);
  const { data } = useHelpContent(where, 'video');
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(null);
  const videos = data || [];
  if (!videos.length) return null;
  const show = () => { setOpen(true); setPlaying(videos.length === 1 ? videos[0] : null); };
  return (
    <>
      {variant === 'icon' ? (
        <button type="button" onClick={show} title={t('How to use this page')} aria-label={t('How to use this page')}
          className={cn('rounded-lg p-2 text-brand-700 hover:bg-brand-50 focus-ring', className)}>
          <PlayCircle size={20} />
        </button>
      ) : (
        <button type="button" onClick={show} className={cn('inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-100 focus-ring', className)}>
          <PlayCircle size={17} />{videos.length === 1 ? videos[0].title : t('Watch how it works ({n})', { n: videos.length })}
        </button>
      )}
      <Modal open={open} onClose={() => { setOpen(false); setPlaying(null); }} size="lg" title={playing ? playing.title : t('How it works')}>
        {playing ? (
          <div className="space-y-3">
            <VideoPlayer item={playing} />
            {playing.description && <p className="text-sm text-slate-600">{playing.description}</p>}
            {videos.length > 1 && <button type="button" onClick={() => setPlaying(null)} className="inline-flex items-center gap-1 text-sm text-brand-700"><ChevronLeft size={15} />{t('All videos')}</button>}
          </div>
        ) : <VideoList items={videos} onPick={setPlaying} />}
      </Modal>
    </>
  );
}

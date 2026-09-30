import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LifeBuoy, PlayCircle, BookOpen } from 'lucide-react';
import {
  Card, CardHeader, PageHeader, SearchInput, Spinner, Button, Modal,
} from '@/components/ui';
import { t } from '@/lib/i18n';
import { useHelpContent, VideoList, VideoPlayer } from '@/components/help/HelpVideos';

function Faq({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-3 text-left">
        <span className="text-sm font-medium text-slate-900">{item.title}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="whitespace-pre-wrap pb-3 text-sm text-slate-600">{item.body}</p>}
    </li>
  );
}

export default function Help() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [playing, setPlaying] = useState(null);
  const [reading, setReading] = useState(null);
  const { data, loading } = useHelpContent('help');
  const rx = q.trim().toLowerCase();
  const match = (x) => !rx || `${x.title} ${x.description} ${x.body}`.toLowerCase().includes(rx);
  const groups = useMemo(() => {
    const all = (data || []).filter(match);
    return { video: all.filter((x) => x.kind === 'video'), article: all.filter((x) => x.kind === 'article'), faq: all.filter((x) => x.kind === 'faq') };
  }, [data, rx]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title={t('Help centre')} subtitle={t('Videos, guides and answers to common questions')}
        action={<Button icon={LifeBuoy} onClick={() => navigate('/support?new=1')}>{t('Contact support')}</Button>} />
      <SearchInput value={q} onChange={setQ} placeholder={t('Search help')} className="mb-4" />
      {loading && !data ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="space-y-4">
          {groups.video.length > 0 && <Card><CardHeader title={t('Videos')} /><VideoList items={groups.video} onPick={setPlaying} /></Card>}
          {groups.article.length > 0 && (
            <Card>
              <CardHeader title={t('Guides')} />
              <ul className="divide-y divide-slate-100">
                {groups.article.map((a) => (
                  <li key={a._id}>
                    <button type="button" onClick={() => setReading(a)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50">
                      <BookOpen size={17} className="shrink-0 text-brand-700" />
                      <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{a.title}</span>{a.description && <span className="block truncate text-xs text-slate-500">{a.description}</span>}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {groups.faq.length > 0 && <Card><CardHeader title={t('Frequently asked questions')} /><ul className="divide-y divide-slate-100">{groups.faq.map((f) => <Faq key={f._id} item={f} />)}</ul></Card>}
          {!groups.video.length && !groups.article.length && !groups.faq.length && (
            <Card className="text-center">
              <PlayCircle size={28} className="mx-auto text-slate-300" />
              <p className="mt-2 text-sm text-slate-600">{rx ? t('Nothing matches your search.') : t('Help content will appear here soon.')}</p>
              <Button className="mt-3" variant="secondary" onClick={() => navigate('/support?new=1')}>{t('Ask our support team')}</Button>
            </Card>
          )}
        </div>
      )}
      <Modal open={Boolean(playing)} onClose={() => setPlaying(null)} size="lg" title={playing?.title}>{playing && <VideoPlayer item={playing} />}</Modal>
      <Modal open={Boolean(reading)} onClose={() => setReading(null)} size="lg" title={reading?.title}>{reading && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{reading.body}</p>}</Modal>
    </>
  );
}

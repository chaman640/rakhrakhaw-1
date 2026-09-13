import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';
import { Spinner } from '@/components/ui';
import { t } from '@/lib/i18n';

const DURATION_MS = 5000;

/**
 * STORY VIEWER — WhatsApp Status jaisa (Part 25).
 *
 * Upar segmented progress bar, khud-ba-khud agli story pe badhta hai. Screen
 * ka bayan hissa "pichli", dayan hissa "agli" — tap karne se turant udhar
 * chala jata hai, WhatsApp/Instagram jaisa hi.
 */
export default function StoryViewer({ businessId, onClose }) {
  const [stories, setStories] = useState(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    api.get(`/my/stories/${businessId}`).then((r) => {
      if (!cancelled) setStories(r.data);
    }).catch(() => { if (!cancelled) onClose(); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (!stories) return;
    const current = stories[index];
    if (!current) { onClose(); return; }

    // Dekh li — mark kar do (chup-chaap, jawab ka intezaar nahi)
    api.post(`/my/stories/view/${current._id}`).catch(() => {});

    startRef.current = Date.now();
    setProgress(0);

    function tick() {
      const pct = Math.min(100, ((Date.now() - startRef.current) / DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        if (index < stories.length - 1) setIndex((i) => i + 1);
        else onClose();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, index]);

  function goNext() {
    if (!stories) return;
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }
  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  if (!stories) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <Spinner size={28} className="text-white" />
      </div>
    );
  }

  const current = stories[index];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute inset-x-2 top-2 z-10 flex gap-1">
        {stories.map((s, i) => (
          <div key={s._id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white"
              style={{ width: `${i < index ? 100 : i === index ? progress : 0}%` }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('Band karein')}
        className="absolute right-3 top-6 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white focus-ring"
      >
        <X size={20} />
      </button>

      <img src={current.imageUrl} alt="" className="h-full w-full object-contain" />

      {current.caption && (
        <p className="absolute inset-x-4 bottom-6 text-center text-sm text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          {current.caption}
        </p>
      )}

      <button type="button" onClick={goPrev} aria-label={t('Pichli story')} className="absolute inset-y-0 left-0 w-1/3 focus-ring" />
      <button type="button" onClick={goNext} aria-label={t('Agli story')} className="absolute inset-y-0 right-0 w-1/3 focus-ring" />
    </div>
  );
}

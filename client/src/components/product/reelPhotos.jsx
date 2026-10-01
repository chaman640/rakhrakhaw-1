import { useEffect, useRef, useState } from 'react';

export const AUTO_SLIDE_MS = 3000;

/** Whole photo visible (no crop); the empty space is filled with a soft blur of the same photo */
export function ReelPhoto({ src }) {
  return (
    <div className="relative h-full w-full flex-shrink-0 overflow-hidden">
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
      <img src={src} alt="" className="relative h-full w-full object-contain" />
    </div>
  );
}

/**
 * Moves to the next photo every 3 seconds (wrapping to the first), only while the panel is on
 * screen, the tab is visible and the user isn't touching it. Any slide change restarts the wait.
 */
export function useAutoSlide({ count, slide, setSlide, setAnimating, paused, ref }) {
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const animTimer = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.intersectionRatio >= 0.6), { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    const on = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || !onScreen || !tabVisible) return undefined;
    const id = setTimeout(() => {
      setAnimating(true);
      setSlide((s) => (s + 1) % count);
      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(() => setAnimating(false), 320);
    }, AUTO_SLIDE_MS);
    return () => clearTimeout(id);
  }, [count, slide, paused, onScreen, tabVisible, setSlide, setAnimating]);

  useEffect(() => () => clearTimeout(animTimer.current), []);
}

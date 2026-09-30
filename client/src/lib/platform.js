import { useEffect, useState } from 'react';
import api from '@/lib/api';

let cache = null;
let inflight = null;
const subs = new Set();

export function loadPlatform(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api.get('/public/platform').then((r) => { cache = r.data; subs.forEach((f) => f(cache)); return cache; })
      .catch(() => cache).finally(() => { inflight = null; });
  }
  return inflight;
}

/** Branding, support contact, default language and maintenance state */
export function usePlatform() {
  const [p, setP] = useState(cache);
  useEffect(() => {
    subs.add(setP);
    loadPlatform();
    return () => subs.delete(setP);
  }, []);
  return p;
}

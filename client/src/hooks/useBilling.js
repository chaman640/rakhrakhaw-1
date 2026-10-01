import api from '@/lib/api';
import { useQuery } from '@/hooks/useQuery';
import { useAuth } from '@/context/AuthContext';

/**
 * Dukaan ka plan, trial aur feature — ek hi cache se (`['billing', 'me']`).
 *
 * Trial ki patti, upgrade screen, "ye button chalega ya nahi" — sab isi ek
 * jawab se chalte hain; har jagah alag request nahi. Plan badalte hi
 * `bust('billing')` (PlanPicker) ise taaza kar deta hai.
 */
export function useBilling() {
  const { user } = useAuth();
  const seller = user?.role === 'wholesaler';
  const { data } = useQuery(
    ['billing', 'me'],
    () => api.get('/billing/me').then((r) => r.data),
    { enabled: seller, poll: false, staleTime: 60_000 },
  );
  return data || null;
}

/**
 * `const { allowed, lockedInfo } = useFeature('crm_leads')`
 *
 * Jab tak jawab na aaye, `allowed: true` — pehle hi pal me "upgrade karein"
 * chamka dena galat hai; asli rok backend pe hai (middleware/feature.js).
 */
/**
 * `const has = useFeatures(); has('crm_leads')` — plan me band cheez dikhani hi nahi.
 * Jawab aane tak sab dikhta hai (asli rok backend pe hai).
 */
export function useFeatures() {
  const billing = useBilling();
  return (key) => !key || !billing || (billing.features || []).includes(key);
}

export function useFeature(key) {
  const { user } = useAuth();
  const billing = useBilling();
  // Bechne wale ka jawab abhi aa raha hai — `pending` se page apni request rok sakta hai
  if (!billing) return { allowed: true, ready: false, pending: user?.role === 'wholesaler', lockedInfo: null };
  const allowed = (billing.features || []).includes(key);
  return { allowed, ready: true, lockedInfo: allowed ? null : (billing.locked?.[key] || null) };
}

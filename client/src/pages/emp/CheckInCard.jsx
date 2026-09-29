import { useRef, useState, useEffect } from 'react';
import { LogIn, LogOut, MapPin, Camera, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { bust } from '@/hooks/useQuery';
import { Card, Button, useToast } from '@/components/ui';
import { shrinkImage } from '@/lib/shrinkImage';
import { t } from '@/lib/i18n';
import { AttBadge, timeOf, hoursOf } from '@/pages/wholesaler/hr/hrShared';

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(id); }, []);
  return now;
}

export default function CheckInCard({ today, rules }) {
  const toast = useToast();
  const now = useClock();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const action = !today?.checkIn ? 'in' : !today?.checkOut ? 'out' : null;

  async function punch(photo) {
    setBusy(true);
    try {
      const loc = await getLocation();
      if (rules?.requireLocation && !loc) throw new Error(t('Location is required. Please allow location access and try again.'));
      const fd = new FormData();
      if (loc) { fd.append('lat', loc.lat); fd.append('lng', loc.lng); }
      if (photo) fd.append('photo', await shrinkImage(photo));
      const res = await api.post(`/hr/me/check-${action}`, fd);
      toast.success(res.message);
      bust('emp');
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  }
  function start() {
    if (rules?.requirePhoto) fileRef.current?.click();
    else punch(null);
  }

  return (
    <Card className="text-center">
      <p className="text-3xl font-semibold tabular text-slate-900">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</p>
      <p className="text-sm text-slate-500">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}</p>
      {today?.status && <div className="mt-2"><AttBadge status={today.status} /></div>}

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">{t('Check-in')}</p><p className="font-semibold text-slate-900">{timeOf(today?.checkIn)}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">{t('Check-out')}</p><p className="font-semibold text-slate-900">{timeOf(today?.checkOut)}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-slate-500">{t('Worked')}</p><p className="font-semibold text-slate-900">{hoursOf(today?.workMinutes)}</p></div>
      </div>

      {action ? (
        <>
          <Button size="lg" className="mt-4 h-12 w-full text-base" variant={action === 'in' ? 'primary' : 'secondary'}
            icon={action === 'in' ? LogIn : LogOut} loading={busy} onClick={start}>
            {action === 'in' ? t('Check in') : t('Check out')}
          </Button>
          <p className="mt-2 flex items-center justify-center gap-3 text-[11px] text-slate-500">
            {rules?.workStart && <span>{t('Work starts at {x}', { x: rules.workStart })}</span>}
            {rules?.requireLocation && <span className="inline-flex items-center gap-1"><MapPin size={11} />{t('Location needed')}</span>}
            {rules?.requirePhoto && <span className="inline-flex items-center gap-1"><Camera size={11} />{t('Selfie needed')}</span>}
          </p>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) punch(f); }} />
        </>
      ) : (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} />{t('Done for today')}</p>
      )}
    </Card>
  );
}

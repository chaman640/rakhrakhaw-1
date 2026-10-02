import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { t } from '@/lib/i18n';

/**
 * Ghanti — seedha Notifications page kholti hai (wahan poori list, filter,
 * padha/na-padha aur phone notification ki setting ek jagah hai).
 */
export default function NotificationBell() {
  const { count, refresh } = useNotifications();

  return (
    <Link
      to="/notifications"
      onClick={() => refresh()}
      className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-ring"
      aria-label={count > 0 ? t('{a0} nayi notification', { a0: count }) : t('Notifications')}
    >
      <Bell size={19} />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}

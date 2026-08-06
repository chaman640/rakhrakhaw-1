import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext({ count: 0, refresh: () => {} });

/**
 * Unread count + list. Har 45 second me khud check karta hai —
 * websocket Part 10 me dekhenge, abhi polling kaafi hai.
 */
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) { setCount(0); return; }
    try {
      const res = await api.get('/notifications/unread-count');
      setCount(res.data.count || 0);
    } catch { /* chup-chaap */ }
  }, [user]);

  useEffect(() => {
    refresh();
    if (!user) return undefined;
    const id = setInterval(refresh, 45000);
    return () => clearInterval(id);
  }, [refresh, user]);

  return (
    <NotificationContext.Provider value={{ count, refresh, setCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);

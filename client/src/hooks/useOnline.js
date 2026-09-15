import { useEffect, useState } from 'react';

/**
 * Abhi internet hai ya nahi — sirf itna. `navigator.onLine` kabhi-kabhi
 * jhooth bhi bolta hai (WiFi se juda hai par internet nahi chal raha), par
 * ek chhote dukaandaar ke liye "signal hai ki nahi" jitna sahi hona kaafi hai
 * — perfect hona zaroori nahi.
 */
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

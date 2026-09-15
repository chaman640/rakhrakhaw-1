import React from 'react';
import ReactDOM from 'react-dom/client';
// Sabse pehle — React ke chalne se bhi pehle. Isi line se pehla page seedha
// user ki chuni hui bhasha, roshni aur text size me khulta hai (bina jhilmilahat).
import '@/lib/prefs';
import App from './App';
import './index.css';

/*
  SERVICE WORKER — OFFLINE KE LIYE (Part 48).

  Pehle ye sirf push notification chalu karte waqt register hota tha
  (`lib/push.js` me) — matlab jisne notification on nahi kiya, uske liye
  offline caching bhi kabhi shuru hi nahi hoti thi. Ab app khulte hi
  register ho jata hai, chahe push chalu ho ya na ho.
*/
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Offline caching na mile to bhi app chalti rahe — ye sirf ek "aur behtar" hai
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
// Sabse pehle — React ke chalne se bhi pehle. Isi line se pehla page seedha
// user ki chuni hui bhasha, roshni aur text size me khulta hai (bina jhilmilahat).
import '@/lib/prefs';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

const ToastContext = createContext(null);

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
const styles = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-slate-200 bg-white text-slate-900',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 3500) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        /*
          Toast ab UPAR aata hai, neeche nahi.

          Neeche wali jagah phone pe teen cheezon se ladti thi: nav bar,
          keyboard, aur "Save karein" jaisa neeche chipka hua button. Sabse
          bura keyboard tha — bill banate waqt "stock kam hai" wala sandesh
          keyboard ke PEECHHE chhup jata tha, yani wahi pal jab wo sabse
          zaroori hota hai.

          Upar-beech me wo har halat me dikhta hai, aur aankh waise bhi upar
          hi hoti hai (sirnaam, back button — sab wahin hain).
        */
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex w-full max-w-sm flex-col items-center gap-2 px-4">
          {toasts.map((t) => {
            const Icon = icons[t.type];
            return (
              <div
                key={t.id}
                /* `pointer-events-auto` — bahar wala dabba `none` hai taaki
                    toast ke aas-paas ka click page tak pahunche; toast khud
                    band ho sake, isliye uspe wapas `auto` */
                className={cn(
                  'pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
                  styles[t.type]
                )}
              >
                <Icon size={18} className="mt-0.5 shrink-0" />
                <p className="flex-1">{t.message}</p>
                <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast ko ToastProvider ke andar hi use karein');
  return ctx;
}

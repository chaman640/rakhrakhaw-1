import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';

export default function Tabs({ tabs, value, onChange, className }) {
  return (
    /*
      Kaun sa tab chuna hua hai, ye pehle SIRF rang aur neeche ki lakeer se
      pata chalta tha. Aankh se dekhne wale ko chalta tha; screen reader
      wale ko paanch ek jaise button sunai dete the, aur kaun sa khula hai
      ye kahin bola hi nahi jata tha.

      Wahi khamoshi test me bhi thi — "pehla tab History hai" wali jaanch us
      waqt bhi pass ho gayi jab default badal kar "Lena hai" kar diya gaya,
      kyunki naam to apni jagah hi khade the. Ab chunav khud bolta hai.
    */
    <div className={cn('mb-5 flex gap-1 overflow-x-auto border-b border-slate-200', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          /*
            `aria-pressed`, `role="tab"` nahi.

            Pehli koshish me `role="tab"` likha tha. Wo do wajah se galat tha.
            Ek, `role` DAL dene se button ka apna role HAT jata hai — aur app
            ke apne teen purane test, jo `getByRole('button', { name:
            'History' })` se tab dabate hain, wahin toot gaye. Do, poora
            tablist ka niyam nibhane ke liye neeche wale hisse pe
            `role="tabpanel"` aur `aria-controls` bhi chahiye, jo yahan hai
            nahi — aadha niyam nibhana screen reader ko sach se zyada
            bhatkata hai.

            `aria-pressed` button ke saath poori tarah theek hai, kuch todta
            nahi, aur wahi baat kehta hai: ye wala dabaya hua hai.
          */
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            // px-3 phone pe: chaar tab (Dukaan · Paisa lena · Bill · Mera
            // account) 390px me tabhi aate hain. px-4 pe aakhri tab kinare se
            // bahar chala jata tha — scroll to hota hai, par dikhta nahi ki
            // aage kuch hai, aur log use dhoondhte hi nahi.
            'relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors focus-ring sm:px-4',
            value === tab.value
              ? 'text-brand-700'
              : 'text-slate-500 hover:text-slate-800'
          )}
        >
          <span className="flex items-center gap-2">
            {t(tab.label)}
            {tab.count > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {tab.count}
              </span>
            )}
          </span>
          {value === tab.value && (
            <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />
          )}
        </button>
      ))}
    </div>
  );
}

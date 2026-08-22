import { useId, useState } from 'react';
import { formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';

/**
 * 14 din ki SALE aur KHARCH — do line.
 *
 * Pehle yahan khadi patti (bar) thi aur sirf sale dikhti thi. Do cheezein
 * badlin, dono wajah se:
 *
 *  1. Ab kharch ka hisaab bhi app me hai. Sale akeli aadhi baat hai — ₹50,000
 *     bikna achha ya bura, ye tabhi pata chalta hai jab saath me ye dikhe ki
 *     us hafte kharch kitna gaya. Do line ke beech ka faasla hi asli jawab hai.
 *  2. Line, patti se behtar hai jab do cheezein SAATH dikhani hon — patti me
 *     doosri series ya to peeche chhup jati hai ya har din ki jagah aadhi kar
 *     deti hai. Line upar-neeche saaf dikhti hai aur ek dusre ko dhakti nahi.
 *
 * Koi chart library nahi — bundle chhota rehta hai aur itna hi chahiye.
 *
 * Kuch niyam jo jaan-boojh kar follow kiye hain:
 *  - Dono line ka paimana EK hi hai (dono paisa hai). Alag paimane pe do line
 *    dikhana aankh ko jhooth bolta hai: chhota kharch badi line ban jata hai.
 *  - Sale ke neeche halka rang bhara hai, kharch ke neeche nahi — taaki
 *    "kitna aaya" bhaari lage aur "kitna gaya" uske upar patli line ho.
 *  - Phone pe hover hota hi nahi, isliye har din ka ek pardarshi khaana hai
 *    jise CHHUNE par uska din khul jata hai.
 *  - Line ki motai chart ke saath nahi khinchti (`vector-effect`), warna
 *    chaudi screen pe line moti aur phone pe patli dikhti.
 */

const SALE = '#0d9488';       // brand-600
const KHARCH = '#d97706';     // amber-600

/** Y-axis ke liye seedhe-saade number: 0 / 500 / 1,000 */
function niceMax(value) {
  if (value <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

const shortMoney = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

export default function TrendChart({
  data = [],
  /*
    Default me "Pichhle 14 din" likha tha — do galtiyan ek saath. Ek, Step 4
    me arsa chunne wale chip aa gaye, to 7 din ya 1 saal chunne par bhi sar pe
    "14 din" hi likha rehta tha. Do, ye default parameter me pada tha isliye
    anuvaad ki jaanch ise dekh hi nahi pati thi — English chunne par yahi
    ek line Hinglish me chhapti reh gayi thi.

    Ab bulane wala apna asli arsa khud bhejta hai.
  */
  title = 'Bikri ka chart',
  height = 168,
  emptyText = 'Abhi tak koi bill nahi bana',
}) {
  const tableId = useId();
  const [hover, setHover] = useState(null);

  const sale = data.map((d) => Number(d.amount) || 0);
  /*
    Kharch ki line tabhi banti hai jab server ne kharch bheja ho.

    `undefined` aur `0` me farak hai aur wo farak yahan zaroori hai: jis staff
    ko kharch dekhne ki ijazat nahi, uske jawab me `expense` hota hi nahi.
    Agar hum use 0 maan lete to uske chart me neeche ek seedhi ₹0 wali line
    khinch jati — jo jhooth hai ("kharch kuch nahi hua"), aur legend me
    "Kharch" likha bhi aa jata.
  */
  const hasKharch = data.some((d) => d.expense !== undefined && d.expense !== null);
  const kharch = hasKharch ? data.map((d) => Number(d.expense) || 0) : [];

  const peak = Math.max(0, ...sale, ...kharch);
  const max = niceMax(peak);
  const hasData = peak > 0;

  const ticks = [max, max / 2, 0];
  const n = data.length;
  // Ek hi din ka data ho to line ban hi nahi sakti — us akele bindu ko beech me
  const xAt = (i) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (v) => 100 - (max > 0 ? (v / max) * 100 : 0);
  const pointsOf = (arr) => arr.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ');

  const hovered = hover !== null ? data[hover] : null;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-slate-900">{t(title)}</h3>
        {hasData && (
          <div className="flex items-center gap-3 text-xs">
            <Key color={SALE} label={t('Sale')} value={sale.reduce((s, v) => s + v, 0)} />
            {hasKharch && (
              <Key color={KHARCH} label={t('Kharch')} value={kharch.reduce((s, v) => s + v, 0)} />
            )}
          </div>
        )}
      </figcaption>

      {!hasData ? (
        <div style={{ height }} className="flex items-center justify-center rounded-lg bg-slate-50">
          <p className="text-sm text-slate-400">{t(emptyText)}</p>
        </div>
      ) : (
        <div className="relative pl-10" style={{ height }}>
          {/* gridline + y ke number */}
          {/* naam `tick` — `t` nahi. `t` ab anuvaad ka function hai, use dhak dena
              yahan aage chal kar bahut mushkil bug banata */}
          {ticks.map((tick, i) => (
            <div key={tick} className="absolute inset-x-0 flex items-center"
              style={{ left: 0, top: `${(i / (ticks.length - 1)) * 100}%` }}>
              <span className="tabular w-9 shrink-0 pr-2 text-right text-[10px] leading-none text-slate-400">
                {shortMoney(tick)}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          ))}

          <div className="absolute inset-y-0 left-10 right-0">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              {/* sale ke neeche halka bharav */}
              <polygon points={`0,100 ${pointsOf(sale)} 100,100`} fill={SALE} opacity="0.10" />
              <polyline points={pointsOf(sale)} fill="none" stroke={SALE} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {hasKharch && (
                <polyline points={pointsOf(kharch)} fill="none" stroke={KHARCH} strokeWidth="2"
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              )}
            </svg>

            {/* chune hue din ki seedhi lakeer + bindu */}
            {hovered && (
              <>
                <span className="pointer-events-none absolute top-0 bottom-0 w-px bg-slate-300"
                  style={{ left: `${xAt(hover)}%` }} />
                <Dot x={xAt(hover)} y={yAt(sale[hover])} color={SALE} />
                {hasKharch && <Dot x={xAt(hover)} y={yAt(kharch[hover])} color={KHARCH} />}
              </>
            )}

            {/* har din ka pardarshi khaana — phone pe chhune se khulta hai */}
            <div className="absolute inset-0 flex" onPointerLeave={() => setHover(null)}>
              {data.map((d, i) => (
                <button key={d.date || i} type="button"
                  className="h-full flex-1 cursor-default focus:outline-none"
                  aria-label={`${d.label}: ${formatMoney(d.amount)}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              ))}
            </div>

            {hovered && (
              <div className="tip pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 shadow-lg"
                style={{
                  left: `${Math.min(88, Math.max(12, xAt(hover)))}%`,
                  bottom: `calc(${100 - Math.min(yAt(sale[hover]), hasKharch ? yAt(kharch[hover]) : 100)}% + 10px)`,
                }}>
                <p className="text-[10px] text-slate-300">{hovered.label} · {hovered.bills} {t('bill')}</p>
                <p className="text-[11px] font-medium text-white">
                  <span style={{ color: '#5eead4' }}>●</span> {formatMoney(hovered.amount)}
                </p>
                {hasKharch && (
                  <p className="text-[11px] font-medium text-white">
                    <span style={{ color: '#fcd34d' }}>●</span> {formatMoney(hovered.expense || 0)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* x ke naam — bheed na ho isliye har teesra */}
      {hasData && (
        <div className="mt-2 flex pl-10">
          {data.map((d, i) => (
            <span key={d.date || i}
              className="flex-1 text-center text-[10px] leading-tight text-slate-400">
              {i % 3 === 0 || i === data.length - 1 ? d.label.split(' ')[0] : ''}
            </span>
          ))}
        </div>
      )}

      {/* Screen reader aur "number chahiye" wale ke liye — chart ka data table me */}
      {hasData && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">
            {t('Number me dekhein')}
          </summary>
          <table id={tableId} className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 text-left font-medium">{t('Date')}</th>
                <th className="py-1 text-right font-medium">{t('Bill')}</th>
                <th className="py-1 text-right font-medium">{t('Sale')}</th>
                {hasKharch && <th className="py-1 text-right font-medium">{t('Kharch')}</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-slate-100">
                  <td className="py-1 text-slate-600">{d.label}</td>
                  <td className="tabular py-1 text-right text-slate-600">{d.bills}</td>
                  <td className="tabular py-1 text-right text-slate-900">{formatMoney(d.amount)}</td>
                  {hasKharch && (
                    <td className="tabular py-1 text-right text-amber-700">{formatMoney(d.expense || 0)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}

function Key({ color, label, value }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-500">
      <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      {label} <span className="tabular font-medium text-slate-700">{formatMoney(value)}</span>
    </span>
  );
}

function Dot({ x, y, color }) {
  return (
    <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
      style={{ left: `${x}%`, top: `${y}%`, background: color }} />
  );
}

import { useId, useState } from 'react';
import { formatMoney } from '@/lib/format';

/**
 * 14 din ka sale — ek hi series, isliye ek hi rang aur koi legend nahi
 * (heading hi bata deta hai ki kya dikh raha hai).
 *
 * Koi chart library nahi — bundle chhota rehta hai aur ye itna hi chahiye.
 *
 * Design ke niyam jo jaan-boojh kar follow kiye hain:
 *  - bar zyada se zyada 24px moti, upar 4px gol, neeche seedhi
 *  - do bar ke beech safed gap (border nahi)
 *  - gridline patli, solid, halki — data hi bhaari dikhna chahiye
 *  - number sirf sabse oonchi bar pe (har bar pe likho to koi nahi padhta)
 *  - baaki value hover pe, aur screen reader ke liye poori table neeche
 */

const BAR_COLOR = '#0d9488';        // brand-600
const BAR_HOVER = '#0f766e';        // brand-700

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
  title = 'Pichhle 14 din ki sale',
  height = 168,
  emptyText = 'Abhi tak koi bill nahi bana',
}) {
  const tableId = useId();
  const [hover, setHover] = useState(null);

  const values = data.map((d) => Number(d.amount) || 0);
  const peak = Math.max(0, ...values);
  const max = niceMax(peak);
  const hasData = peak > 0;

  const ticks = [max, max / 2, 0];
  const peakIndex = values.indexOf(peak);

  return (
    <figure className="m-0">
      <figcaption className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hasData && (
          <span className="text-xs text-slate-500">
            Kul {formatMoney(values.reduce((s, v) => s + v, 0))}
          </span>
        )}
      </figcaption>

      {!hasData ? (
        <div style={{ height }} className="flex items-center justify-center rounded-lg bg-slate-50">
          <p className="text-sm text-slate-400">{emptyText}</p>
        </div>
      ) : (
        <div className="relative pl-10" style={{ height }}>
          {/* gridlines + y ticks */}
          {ticks.map((t, i) => (
            <div key={t} className="absolute inset-x-0 flex items-center"
              style={{ left: 0, top: `${(i / (ticks.length - 1)) * 100}%` }}>
              <span className="tabular w-9 shrink-0 pr-2 text-right text-[10px] leading-none text-slate-400">
                {shortMoney(t)}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          ))}

          {/* bars */}
          <div className="absolute inset-y-0 left-10 right-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const pct = max > 0 ? (Number(d.amount) || 0) / max : 0;
              const isHover = hover === i;
              const showLabel = i === peakIndex && peak > 0;

              return (
                <div
                  key={d.date || i}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  role="presentation"
                >
                  {showLabel && !isHover && (
                    <span
                      className="tabular pointer-events-none absolute z-10 whitespace-nowrap text-[10px] font-medium text-slate-500"
                      style={{ bottom: `calc(${Math.max(pct * 100, 2)}% + 4px)` }}
                    >
                      {shortMoney(d.amount)}
                    </span>
                  )}

                  <div
                    className="w-full max-w-6 rounded-t transition-colors"
                    style={{
                      height: `${Math.max(pct * 100, d.amount > 0 ? 2 : 0)}%`,
                      minHeight: d.amount > 0 ? 3 : 0,
                      background: isHover ? BAR_HOVER : BAR_COLOR,
                    }}
                  />

                  {isHover && (
                    <div className="pointer-events-none absolute bottom-full z-20 mb-1 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-center shadow-lg">
                      <p className="text-[11px] font-medium text-white">{formatMoney(d.amount)}</p>
                      <p className="text-[10px] text-slate-300">{d.label} · {d.bills} bill</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* x labels — bheed na ho isliye har teesra */}
      {hasData && (
        <div className="mt-2 flex gap-[2px] pl-10">
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
            Number me dekhein
          </summary>
          <table id={tableId} className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="py-1 text-left font-medium">Date</th>
                <th className="py-1 text-right font-medium">Bill</th>
                <th className="py-1 text-right font-medium">Sale</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-t border-slate-100">
                  <td className="py-1 text-slate-600">{d.label}</td>
                  <td className="tabular py-1 text-right text-slate-600">{d.bills}</td>
                  <td className="tabular py-1 text-right text-slate-900">{formatMoney(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}

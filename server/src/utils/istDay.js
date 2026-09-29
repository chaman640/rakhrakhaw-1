// Dukaan ka din IST me — server kisi bhi time zone me chale
const OFF = 330 * 60000;

export const istDay = (d = new Date()) => new Date(new Date(d).getTime() + OFF).toISOString().slice(0, 10);

export function istMinutes(d = new Date()) {
  const x = new Date(new Date(d).getTime() + OFF);
  return x.getUTCHours() * 60 + x.getUTCMinutes();
}

export const istStart = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - OFF);
export const weekdayOf = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();

export function daysBetween(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), end = Date.parse(`${to}T00:00:00Z`); t <= end && out.length < 400; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export const currentPeriod = () => istDay().slice(0, 7);

/** 'YYYY-MM' → uske saare din + IST shuru/ant */
export function monthOf(period) {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${period}-01`;
  const to = `${period}-${String(last).padStart(2, '0')}`;
  return { from, to, days: daysBetween(from, to), start: istStart(from), end: new Date(istStart(to).getTime() + 86400000) };
}

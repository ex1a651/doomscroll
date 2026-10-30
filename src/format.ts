const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export const todayKey = () => toKey(new Date());

/** 'Oct 30' */
export function shortDate(key: string): string {
  const d = fromKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** 'Fri' */
export function weekday(key: string): string {
  return DAYS[fromKey(key).getDay()];
}

/** 1234 → '1,234' */
export function num(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** ms → '1h 12m' / '12m' / '45s' */
export function dur(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (ms > 0 && totalMin === 0) return `${Math.max(1, Math.round(ms / 1000))}s`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** 0-23 → '11 PM' */
export function hourLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${ampm}`;
}

/** -0.23 → '−23%' */
export function pct(fraction: number): string {
  const v = Math.round(Math.abs(fraction) * 100);
  return `${fraction < 0 ? '−' : '+'}${v}%`;
}

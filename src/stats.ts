import type { AppId, DailyRow, HourlyRow } from '../modules/doomscroll';
import { APPS } from './theme';
import { addDays, dur, num, pct, shortDate, todayKey, weekday } from './format';

export type Totals = { reels: number; swipes: number; opens: number; fgMs: number; sessions: number };
export type DayStats = Totals & { day: string; perApp: Record<AppId, Totals> };
export type Win = { icon: string; title: string; detail: string };

export type Model = {
  hasData: boolean;
  firstDay: string | null;
  today: DayStats;
  yesterday: DayStats | null;
  /** firstDay … today, gaps filled with zeros (max ~90 days) */
  days: DayStats[];
  /** same, excluding today */
  completed: DayStats[];
  avg7: Totals | null;
  avg30: Totals | null;
  avgAll: Totals | null;
  /** reels you usually have by this time of day (avg of last 7 completed days) */
  usualByNow: number | null;
  streak: number;
  week: { cur: Totals; prev: Totals | null; curDays: number; prevDays: number };
  best: DayStats | null;
  worst: DayStats | null;
  hourlyAvg: number[];
  peakHour: number | null;
  wins: Win[];
};

const zero = (): Totals => ({ reels: 0, swipes: 0, opens: 0, fgMs: 0, sessions: 0 });

function add(a: Totals, b: Totals) {
  a.reels += b.reels;
  a.swipes += b.swipes;
  a.opens += b.opens;
  a.fgMs += b.fgMs;
  a.sessions += b.sessions;
}

export function mean(days: Totals[]): Totals | null {
  if (!days.length) return null;
  const t = zero();
  days.forEach((d) => add(t, d));
  return {
    reels: t.reels / days.length,
    swipes: t.swipes / days.length,
    opens: t.opens / days.length,
    fgMs: t.fgMs / days.length,
    sessions: t.sessions / days.length,
  };
}

export function sum(days: Totals[]): Totals {
  const t = zero();
  days.forEach((d) => add(t, d));
  return t;
}

/** Sum per-app totals over a list of days. */
export function perAppSum(days: DayStats[]): Record<AppId, Totals> {
  const out = { instagram: zero(), youtube: zero(), facebook: zero() } as Record<AppId, Totals>;
  days.forEach((d) => APPS.forEach((a) => add(out[a], d.perApp[a])));
  return out;
}

function emptyDay(day: string): DayStats {
  return { day, ...zero(), perApp: { instagram: zero(), youtube: zero(), facebook: zero() } };
}

export function buildModel(rows: DailyRow[], hourly: HourlyRow[], now = new Date()): Model {
  const today = todayKey();
  const byDay = new Map<string, DayStats>();
  for (const r of rows) {
    if (!APPS.includes(r.app)) continue;
    const d = byDay.get(r.day) ?? emptyDay(r.day);
    const t: Totals = { reels: r.reels, swipes: r.swipes, opens: r.opens, fgMs: r.fgMs, sessions: r.sessions };
    add(d.perApp[r.app], t);
    add(d, t);
    byDay.set(r.day, d);
  }

  const keys = [...byDay.keys()].sort();
  const firstDay = keys.length ? (keys[0] < today ? keys[0] : today) : null;

  const days: DayStats[] = [];
  if (firstDay) {
    for (let k = firstDay; k <= today; k = addDays(k, 1)) days.push(byDay.get(k) ?? emptyDay(k));
  } else {
    days.push(emptyDay(today));
  }
  const todayStats = days[days.length - 1];
  const completed = days.slice(0, -1);
  const yesterday = completed.length ? completed[completed.length - 1] : null;

  const last = (n: number) => completed.slice(-n);
  const avg7 = mean(last(7));
  const avg30 = mean(last(30));
  const avgAll = mean(completed);

  // Pace: reels usually logged by this time of day.
  const hourNow = now.getHours();
  const frac = now.getMinutes() / 60;
  const hourlyByDay = new Map<string, number[]>();
  for (const h of hourly) {
    const arr = hourlyByDay.get(h.day) ?? new Array(24).fill(0);
    arr[h.hour] += h.reels;
    hourlyByDay.set(h.day, arr);
  }
  const paceDays = last(7);
  const usualByNow = paceDays.length
    ? paceDays.reduce((s, d) => {
        const arr = hourlyByDay.get(d.day);
        if (!arr) return s;
        let v = 0;
        for (let i = 0; i < hourNow; i++) v += arr[i];
        return s + v + arr[hourNow] * frac;
      }, 0) / paceDays.length
    : null;

  // Streak: consecutive completed days at or below the average of the 7 days before each.
  let streak = 0;
  for (let i = completed.length - 1; i >= 1; i--) {
    const base = mean(completed.slice(Math.max(0, i - 7), i));
    if (!base) break;
    if (completed[i].reels <= base.reels) streak++;
    else break;
  }

  // Week vs previous week, as daily averages over completed days.
  const curWin = last(7);
  const prevWin = completed.slice(-14, -7);
  const week = {
    cur: mean(curWin) ?? zero(),
    prev: mean(prevWin),
    curDays: curWin.length,
    prevDays: prevWin.length,
  };

  // Best / worst of the last 30 completed days.
  const recent = last(30);
  const best = recent.length ? recent.reduce((a, b) => (b.reels < a.reels ? b : a)) : null;
  const worst = recent.length ? recent.reduce((a, b) => (b.reels > a.reels ? b : a)) : null;

  // Hourly profile over the last 14 completed days that have hourly data.
  const hourlyAvg = new Array(24).fill(0);
  const hDays = last(14).filter((d) => hourlyByDay.has(d.day));
  hDays.forEach((d) => hourlyByDay.get(d.day)!.forEach((v, i) => (hourlyAvg[i] += v / hDays.length)));
  const maxH = Math.max(...hourlyAvg);
  const peakHour = maxH > 0 ? hourlyAvg.indexOf(maxH) : null;

  // Wins — the rewarding bit.
  const wins: Win[] = [];
  if (usualByNow !== null && usualByNow >= 5 && todayStats.reels < usualByNow * 0.9) {
    wins.push({
      icon: '🟢',
      title: 'Ahead of pace',
      detail: `${num(usualByNow - todayStats.reels)} fewer reels than you usually have by now`,
    });
  }
  if (streak >= 2) {
    wins.push({ icon: '🔥', title: `${streak}-day streak`, detail: 'Each day at or under your 7-day average' });
  }
  if (yesterday && completed.length >= 3) {
    const wk = last(7);
    const min = Math.min(...wk.map((d) => d.reels));
    if (yesterday.reels === 0) {
      wins.push({ icon: '🧘', title: 'Zero reels yesterday', detail: 'A completely scroll-free day' });
    } else if (yesterday.reels === min) {
      wins.push({ icon: '🏅', title: 'Lowest day this week', detail: `Yesterday: ${num(yesterday.reels)} reels` });
    }
  }
  if (week.prev && week.prev.reels > 0 && week.cur.reels < week.prev.reels) {
    wins.push({
      icon: '📉',
      title: `${pct((week.cur.reels - week.prev.reels) / week.prev.reels)} reels`,
      detail: 'Daily average, last 7 days vs the 7 before',
    });
  }
  if (week.prev && week.prev.fgMs - week.cur.fgMs >= 5 * 60000) {
    wins.push({
      icon: '⏳',
      title: `${dur(week.prev.fgMs - week.cur.fgMs)} / day reclaimed`,
      detail: 'Less time on social than the week before',
    });
  }
  if (best && best.reels > 0 && completed.length >= 7 && best.day === yesterday?.day && !wins.some((w) => w.icon === '🏅')) {
    wins.push({ icon: '🏆', title: 'Best day in 30 days', detail: `${weekday(best.day)} ${shortDate(best.day)}` });
  }

  return {
    hasData: keys.length > 0,
    firstDay,
    today: todayStats,
    yesterday,
    days,
    completed,
    avg7,
    avg30,
    avgAll,
    usualByNow,
    streak,
    week,
    best,
    worst,
    hourlyAvg,
    peakHour,
    wins: wins.slice(0, 4),
  };
}

/** Colour for a value where lower is better, relative to a baseline. */
export function levelColor(value: number, baseline: number | null | undefined, c: { good: string; warn: string; bad: string }) {
  if (!baseline || baseline <= 0) return value === 0 ? c.good : c.warn;
  const r = value / baseline;
  if (r <= 0.9) return c.good;
  if (r <= 1.15) return c.warn;
  return c.bad;
}

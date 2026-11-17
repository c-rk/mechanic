import type { OdoReading } from './types';

const DAY = 86400000;

export interface OdoEstimate {
  /** Distance per day from recent readings, or null with too little history. */
  perDay: number | null;
  /** Last recorded reading. */
  last?: OdoReading;
  /** Projected current reading (last + perDay × days since). */
  estimate: number;
  daysSinceReading: number;
}

/**
 * Least-squares slope of odometer against time over the last 120 days.
 * Needs at least two readings at least three days apart.
 */
export function estimateOdometer(readings: OdoReading[], current: number, now = Date.now()): OdoEstimate {
  const sorted = [...readings].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted[sorted.length - 1];
  const daysSinceReading = last ? Math.max(0, (now - Date.parse(last.at)) / DAY) : Infinity;
  const recent = sorted.filter((r) => now - Date.parse(r.at) < 120 * DAY);
  let perDay: number | null = null;
  if (recent.length >= 2) {
    const t0 = Date.parse(recent[0].at);
    const xs = recent.map((r) => (Date.parse(r.at) - t0) / DAY);
    const span = xs[xs.length - 1] - xs[0];
    if (span >= 3) {
      const ys = recent.map((r) => r.odometer);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      let num = 0;
      let den = 0;
      xs.forEach((x, i) => {
        num += (x - mx) * (ys[i] - my);
        den += (x - mx) ** 2;
      });
      perDay = den > 0 ? Math.max(0, num / den) : null;
    }
  }
  const base = Math.max(current, last?.odometer ?? 0);
  return {
    perDay,
    last,
    daysSinceReading,
    estimate: perDay !== null && Number.isFinite(daysSinceReading) ? Math.round(base + perDay * daysSinceReading) : base,
  };
}

export const METERS_PER = { km: 1000, mi: 1609.344 } as const;

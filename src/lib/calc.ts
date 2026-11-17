import type { FuelEntry, MaintenanceItem, Settings } from './types';

export interface FuelStats {
  /** L/100km when volume unit is L and distance km; otherwise distance per volume unit (e.g. mpg). */
  economy: number | null;
  economyLabel: string;
  totalCost: number;
  totalVolume: number;
  distanceTracked: number;
  costPerDistance: number | null;
  /** Per-fill economy for full-to-full segments, oldest first. */
  series: { id: string; date: string; value: number }[];
}

export function economyLabel(s: Settings) {
  if (s.volumeUnit === 'L' && s.distanceUnit === 'km') return 'L/100km';
  return `${s.distanceUnit}/${s.volumeUnit === 'L' ? 'L' : 'gal'}`;
}

/**
 * Full-to-full method: consumption for a segment is the fuel added since the
 * previous full fill divided by the distance between the two full fills.
 * Partial fills are accumulated into the next full fill.
 */
export function fuelStats(entries: FuelEntry[], s: Settings): FuelStats {
  const sorted = [...entries].sort((a, b) => a.odometer - b.odometer);
  const metric = s.volumeUnit === 'L' && s.distanceUnit === 'km';
  const series: FuelStats['series'] = [];
  let segVolume = 0;
  let lastFullOdo: number | null = null;
  let usedVolume = 0;
  let usedDistance = 0;

  for (const e of sorted) {
    if (lastFullOdo === null) {
      if (e.full) lastFullOdo = e.odometer;
      continue;
    }
    segVolume += e.volume;
    if (e.full) {
      const dist = e.odometer - lastFullOdo;
      if (dist > 0 && segVolume > 0) {
        series.push({ id: e.id, date: e.date, value: metric ? (segVolume / dist) * 100 : dist / segVolume });
        usedVolume += segVolume;
        usedDistance += dist;
      }
      segVolume = 0;
      lastFullOdo = e.odometer;
    }
  }

  const totalCost = sorted.reduce((a, e) => a + e.totalCost, 0);
  const totalVolume = sorted.reduce((a, e) => a + e.volume, 0);
  const distanceTracked = sorted.length > 1 ? sorted[sorted.length - 1].odometer - sorted[0].odometer : 0;
  // The first fill's fuel was burned before tracking began, so exclude its cost.
  const costAfterFirst = sorted.slice(1).reduce((a, e) => a + e.totalCost, 0);

  return {
    economy: usedDistance > 0 ? (metric ? (usedVolume / usedDistance) * 100 : usedDistance / usedVolume) : null,
    economyLabel: economyLabel(s),
    totalCost,
    totalVolume,
    distanceTracked,
    costPerDistance: distanceTracked > 0 ? costAfterFirst / distanceTracked : null,
    series,
  };
}

export type DueState = 'overdue' | 'soon' | 'ok' | 'unknown';

export interface DueInfo {
  state: DueState;
  dueOdometer?: number;
  dueDate?: string;
  distanceLeft?: number;
  daysLeft?: number;
}

const DAY = 86400000;

export function addMonths(date: string, months: number) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function dueInfo(item: MaintenanceItem, odometer: number, now = new Date()): DueInfo {
  const info: DueInfo = { state: 'unknown' };
  if (item.intervalDistance && item.lastDoneOdometer !== undefined) {
    info.dueOdometer = item.lastDoneOdometer + item.intervalDistance;
    info.distanceLeft = info.dueOdometer - odometer;
  }
  if (item.intervalMonths && item.lastDoneDate) {
    info.dueDate = addMonths(item.lastDoneDate, item.intervalMonths);
    info.daysLeft = Math.round((new Date(info.dueDate + 'T00:00:00Z').getTime() - now.getTime()) / DAY);
  }
  if (info.distanceLeft === undefined && info.daysLeft === undefined) return info;

  const overdue = (info.distanceLeft ?? 1) < 0 || (info.daysLeft ?? 1) < 0;
  const distSoon =
    info.distanceLeft !== undefined && info.distanceLeft <= Math.min(1500, (item.intervalDistance ?? 0) * 0.15);
  const dateSoon = info.daysLeft !== undefined && info.daysLeft <= Math.min(30, (item.intervalMonths ?? 0) * 30 * 0.25);
  info.state = overdue ? 'overdue' : distSoon || dateSoon ? 'soon' : 'ok';
  return info;
}

const ORDER: Record<DueState, number> = { overdue: 0, soon: 1, unknown: 2, ok: 3 };

export function sortByDue<T extends { due: DueInfo }>(xs: T[]) {
  return [...xs].sort(
    (a, b) =>
      ORDER[a.due.state] - ORDER[b.due.state] ||
      (a.due.distanceLeft ?? Infinity) - (b.due.distanceLeft ?? Infinity) ||
      (a.due.daysLeft ?? Infinity) - (b.due.daysLeft ?? Infinity),
  );
}

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtMoney = (n: number, currency: string) => `${currency}${fmtNum(n, 2)}`;

export function describeDue(d: DueInfo, distanceUnit: string) {
  if (d.state === 'unknown') return 'No service logged';
  const parts: string[] = [];
  if (d.distanceLeft !== undefined)
    parts.push(
      d.distanceLeft < 0
        ? `${fmtNum(-d.distanceLeft)} ${distanceUnit} over`
        : `in ${fmtNum(d.distanceLeft)} ${distanceUnit}`,
    );
  if (d.daysLeft !== undefined) parts.push(d.daysLeft < 0 ? `${-d.daysLeft} d over` : `in ${d.daysLeft} d`);
  return parts.join(' / ');
}

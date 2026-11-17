import { describeDue, dueInfo, sortByDue } from './calc';
import { estimateOdometer } from './odometer';
import type { Data } from './store';
import type { Vehicle } from './types';

export type AlertLevel = 'critical' | 'warn' | 'info';

export interface VehicleAlert {
  id: string;
  level: AlertLevel;
  icon: string;
  title: string;
  detail: string;
  /** Vehicle screen tab that resolves it. */
  tab: 'service' | 'intel' | 'overview' | 'fuel';
}

/** Everything that needs the owner's attention, most urgent first. */
export function vehicleAlerts(v: Vehicle, d: Pick<Data, 'maintenance' | 'odoLog' | 'recalls' | 'settings'>): VehicleAlert[] {
  const u = d.settings.distanceUnit;
  const odo = estimateOdometer(d.odoLog.filter((r) => r.vehicleId === v.id), v.odometer);
  const due = sortByDue(d.maintenance.filter((m) => m.vehicleId === v.id).map((m) => ({ m, due: dueInfo(m, odo.estimate, odo.perDay) })));
  const out: VehicleAlert[] = [];

  for (const { m, due: x } of due) {
    if (x.state === 'overdue') out.push({ id: m.id, level: 'critical', icon: 'wrench-clock', title: `${m.name} overdue`, detail: describeDue(x, u), tab: 'service' });
    else if (x.state === 'soon') out.push({ id: m.id, level: 'warn', icon: 'wrench-clock', title: `${m.name} due soon`, detail: describeDue(x, u), tab: 'service' });
  }
  const recalls = d.recalls[v.id]?.items.length ?? 0;
  if (recalls) {
    out.push({
      id: 'recalls',
      level: 'warn',
      icon: 'alert-octagon-outline',
      title: `${recalls} recall campaign${recalls === 1 ? '' : 's'}`,
      detail: 'Check with a dealer whether they apply to your VIN',
      tab: 'intel',
    });
  }
  const days = d.settings.odoReminderDays;
  if (days > 0 && odo.daysSinceReading >= days && Number.isFinite(odo.daysSinceReading)) {
    out.push({
      id: 'odo',
      level: 'info',
      icon: 'counter',
      title: 'Odometer reading is stale',
      detail: `Last logged ${Math.floor(odo.daysSinceReading)} days ago`,
      tab: 'overview',
    });
  }
  const rank = { critical: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

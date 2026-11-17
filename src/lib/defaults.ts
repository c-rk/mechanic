import type { BodyType, FuelType, MaintenanceItem } from './types';

interface Template {
  name: string;
  km?: number;
  months?: number;
  skipFor?: FuelType[];
  only?: BodyType[];
  notFor?: BodyType[];
}

/**
 * Generic starting intervals. They are conservative industry-typical values, not
 * manufacturer data: the user is expected to adjust them to the owner's manual.
 */
const TEMPLATES: Template[] = [
  { name: 'Engine oil & filter', km: 10000, months: 12, skipFor: ['electric'] },
  { name: 'Engine air filter', km: 30000, months: 24, skipFor: ['electric'] },
  { name: 'Cabin air filter', km: 20000, months: 12, notFor: ['motorcycle'] },
  { name: 'Brake fluid', months: 24 },
  { name: 'Brake pads & discs inspection', km: 20000, months: 12 },
  { name: 'Coolant', km: 100000, months: 60 },
  { name: 'Spark plugs', km: 60000, skipFor: ['diesel', 'electric'] },
  { name: 'Transmission fluid', km: 80000, skipFor: ['electric'], notFor: ['motorcycle'] },
  { name: 'Tyre rotation', km: 10000, notFor: ['motorcycle'] },
  { name: 'Tyre condition & pressure', months: 1 },
  { name: 'Drive chain clean & lube', km: 800, only: ['motorcycle'] },
  { name: '12 V battery test', months: 12 },
];

export function defaultMaintenance(vehicleId: string, fuel: FuelType, body: BodyType): MaintenanceItem[] {
  return TEMPLATES.filter(
    (t) => !t.skipFor?.includes(fuel) && (!t.only || t.only.includes(body)) && !t.notFor?.includes(body),
  ).map((t, i) => ({
    id: `${vehicleId}-m${i}`,
    vehicleId,
    name: t.name,
    intervalDistance: t.km,
    intervalMonths: t.months,
    notes: '',
  }));
}

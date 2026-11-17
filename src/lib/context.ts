import { describeDue, dueInfo, fuelStats, sortByDue } from './calc';
import type { Data } from './store';
import { mergeSheets, sheetFromVin } from './specFill';
import { ALL_FIELDS } from './specSchema';
import type { Vehicle } from './types';

/** Builds the assistant's system prompt from the on-device record of one vehicle. */
export function buildSystemPrompt(v: Vehicle, d: Data): string {
  const s = d.settings;
  const mine = <T extends { vehicleId: string }>(xs: T[]) => xs.filter((x) => x.vehicleId === v.id);
  const fuel = fuelStats(mine(d.fuel), s);
  const due = sortByDue(mine(d.maintenance).map((m) => ({ m, due: dueInfo(m, v.odometer) })));
  const services = mine(d.services)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 25);
  const parts = mine(d.parts);
  const recalls = d.recalls[v.id]?.items ?? [];
  const sheet = mergeSheets(sheetFromVin(v.specs, s.distanceUnit === 'km'), v.specSheet);
  const specs = ALL_FIELDS.filter((x) => sheet[x.key])
    .map((x) => `${x.label}: ${sheet[x.key].value}${sheet[x.key].source === 'ai' ? ' (AI estimate)' : ''}`)
    .join('; ');

  const lines = [
    'You are the mechanic assistant inside Bay One, a personal garage app. The owner asks about the vehicle described below.',
    'Give accurate, specific technical guidance: likely causes ranked by probability, how to confirm each, the fix, required parts and tools, and difficulty.',
    'State torque values, fluid specifications, capacities and part numbers only when you are confident they apply to this exact vehicle; otherwise say the figure must be confirmed in the service manual.',
    'Flag anything that makes the vehicle unsafe to drive, and say when a job needs a professional workshop.',
    `Units: distance in ${s.distanceUnit}, volume in ${s.volumeUnit}, currency ${s.currency}. Today is ${new Date().toISOString().slice(0, 10)}.`,
    '',
    '## Vehicle',
    `${v.year} ${v.make} ${v.model} ${v.trim}`.trim(),
    `Body: ${v.bodyType}. Engine: ${v.engine || 'unknown'}. Fuel: ${v.fuelType}. Transmission: ${v.transmission || 'unknown'}.`,
    `VIN: ${v.vin || 'not recorded'}. Odometer: ${v.odometer} ${s.distanceUnit}.`,
    v.notes ? `Owner notes: ${v.notes}` : '',
    specs ? `Specifications: ${specs}` : '',
    '',
    '## Fuel',
    fuel.economy !== null
      ? `Average consumption ${fuel.economy.toFixed(1)} ${fuel.economyLabel} over ${fuel.distanceTracked} ${s.distanceUnit}; recent fills: ${fuel.series
          .slice(-5)
          .map((p) => p.value.toFixed(1))
          .join(', ')}.`
      : 'Not enough fill-ups logged to compute consumption.',
    '',
    '## Maintenance schedule (generic intervals unless the owner edited them)',
    ...due.map(({ m, due: x }) => `- ${m.name}: ${x.state}; ${describeDue(x, s.distanceUnit)}`),
    '',
    '## Service history (newest first)',
    ...(services.length
      ? services.map((r) => `- ${r.date} @ ${r.odometer} ${s.distanceUnit}: ${r.title}${r.notes ? ` (${r.notes})` : ''}`)
      : ['None logged.']),
    '',
    '## Parts on file',
    ...(parts.length
      ? parts.map((p) => `- ${p.name} [${p.status}] ${p.brand} ${p.partNumber}`.trim())
      : ['None.']),
    '',
    '## Open recall campaigns for this model (NHTSA)',
    ...(recalls.length ? recalls.map((r) => `- ${r.campaign}: ${r.component}. ${r.summary}`) : ['None cached.']),
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

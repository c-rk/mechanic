import { askAssistant } from './ai';
import { ALL_FIELDS, SPEC_CATEGORIES, type SpecSheet } from './specSchema';
import type { Settings, Vehicle } from './types';

const num = (s?: string) => {
  const n = Number(String(s ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });

/** Maps NHTSA vPIC decoder fields (as stored in Vehicle.specs) onto the spec sheet. */
export function sheetFromVin(raw: Record<string, string>, metric: boolean): SpecSheet {
  const out: SpecSheet = {};
  const put = (key: string, value: string | null | undefined) => {
    if (value) out[key] = { value, source: 'vin' };
  };
  const inch = (v?: string) => {
    const n = num(v);
    return n === null ? null : metric ? `${fmt(n * 25.4)} mm` : `${fmt(n, 1)} in`;
  };
  const lb = (v?: string) => {
    const n = num(v);
    return n === null ? null : metric ? `${fmt(n * 0.4536)} kg` : `${fmt(n)} lb`;
  };

  const litres = num(raw['Displacement L']);
  const cc = num(raw['Displacement CC']);
  put('displacement', cc ? `${fmt(cc)} cc${litres ? ` (${litres.toFixed(1)} L)` : ''}` : litres ? `${litres.toFixed(1)} L` : null);
  put('cylinders', [raw['Engine Cylinders'], raw['Engine Configuration']].filter(Boolean).join(', '));
  put('engineCode', raw['Engine Model']);
  put('valvetrain', [raw['Valve Train Design'], raw['Engine Manufacturer']].filter(Boolean).join(', '));
  put('aspiration', raw['Turbo'] === 'Yes' ? 'Turbocharged' : null);
  put('fuelSystem', raw['Fuel Injection Type']);
  const hp = num(raw['Engine HP']);
  const kw = num(raw['Engine KW']) ?? (hp ? hp * 0.7457 : null);
  put('power', kw ? `${fmt(kw)} kW${hp ? ` (${fmt(hp)} hp)` : ''}` : null);
  const mph = num(raw['Top Speed MPH']);
  put('topSpeed', mph ? `${fmt(mph * 1.609)} km/h (${fmt(mph)} mph)` : null);
  put('transmission', [raw['Transmission Speeds'] && `${raw['Transmission Speeds']}-speed`, raw['Transmission Style']].filter(Boolean).join(' '));
  put('drive', raw['Drive Type']);
  put('fuelType', [raw['Fuel Type Primary'], raw['Fuel Type Secondary']].filter(Boolean).join(' / '));
  put('battery', num(raw['Battery KWh']) ? `${raw['Battery KWh']} kWh` : null);
  put('wheelbase', inch(raw['Wheel Base Short']));
  put('trackFront', inch(raw['Track Width']));
  put('kerbWeight', lb(raw['Curb Weight LB']));
  put('gvw', raw['GVWR'] ? raw['GVWR'].replace(/^Class \d+[A-Z]?:\s*/, '') : null);
  put('seats', raw['Seats']);
  put('doors', raw['Doors']);
  const wf = num(raw['Wheel Size Front']);
  const wr = num(raw['Wheel Size Rear']);
  put('rimFront', wf ? `${wf}″ diameter` : null);
  put('rimRear', wr ? `${wr}″ diameter` : null);
  put('brakesFront', raw['Brake System Type'] ? `${raw['Brake System Type']} brake system` : null);
  put('abs', [raw['ABS'] === 'Standard' && 'ABS', raw['ESC'] === 'Standard' && 'ESC', raw['Traction Control'] === 'Standard' && 'traction control'].filter(Boolean).join(', '));
  return out;
}

/** Combines sheets: values the owner entered always win, then VIN data, then AI estimates. */
export function mergeSheets(...sheets: (SpecSheet | undefined)[]): SpecSheet {
  const rank = { user: 3, vin: 2, ai: 1 } as const;
  const out: SpecSheet = {};
  for (const s of sheets) {
    for (const [k, v] of Object.entries(s ?? {})) {
      if (!v?.value) continue;
      if (!out[k] || rank[v.source] >= rank[out[k].source]) out[k] = v;
    }
  }
  return out;
}

/**
 * Asks the configured AI provider for the full sheet as JSON. Only make, model, year, trim, engine
 * and transmission are sent. Unknown values must come back as null rather than guesses.
 */
export async function fillWithAi(v: Vehicle, settings: Settings, apiKey: string, known: SpecSheet): Promise<SpecSheet> {
  const metric = settings.distanceUnit === 'km';
  const fields = SPEC_CATEGORIES.map((c) => `# ${c.title}\n${c.fields.map((x) => `"${x.key}": ${x.label} — ${x.hint}`).join('\n')}`).join('\n\n');
  const vehicle = [v.year, v.make, v.model, v.trim, v.engine && `engine ${v.engine}`, v.transmission && `transmission ${v.transmission}`, v.fuelType]
    .filter(Boolean)
    .join(', ');
  const knownLines = Object.entries(known)
    .map(([k, x]) => `${k}: ${x.value}`)
    .join('\n');
  const system = [
    'You are an automotive specification database. Reply with one JSON object and nothing else: no prose, no code fences.',
    'Keys are exactly the field keys listed. Each value is a short string with units, or null when you do not know the figure for this exact vehicle and market.',
    'Never guess: a wrong torque figure, capacity or tyre pressure can damage a car. Prefer null over an approximation.',
    metric
      ? 'Use metric units (mm, kg, L, km/h, Nm, kW with hp in parentheses, bar with psi in parentheses).'
      : 'Use US units first with metric in parentheses (in, lb, gal, mph, lb-ft, hp, psi).',
  ].join('\n');
  const prompt = `Vehicle: ${vehicle}\n\nAlready confirmed (keep consistent with these):\n${knownLines || 'none'}\n\nFields:\n${fields}`;

  const text = await askAssistant({ settings, apiKey, system, turns: [{ role: 'user', content: prompt }] });
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI reply did not contain a specification table.');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The AI reply could not be read as a specification table. Try again.');
  }
  const allowed = new Set(ALL_FIELDS.map((x) => x.key));
  const out: SpecSheet = {};
  for (const [k, val] of Object.entries(parsed)) {
    if (!allowed.has(k) || val === null || val === undefined) continue;
    const s = String(val).trim();
    if (s && !/^(n\/?a|unknown|null|-+)$/i.test(s)) out[k] = { value: s.slice(0, 120), source: 'ai' };
  }
  return out;
}

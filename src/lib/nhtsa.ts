import type { BodyType, FuelType, Recall, Vehicle } from './types';

/** Public NHTSA endpoints (US market data). Both send CORS headers, so they work from the web build. */
const VPIC = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVehicle';

function bodyFrom(text: string): BodyType {
  const t = text.toLowerCase();
  if (t.includes('motorcycle')) return 'motorcycle';
  if (t.includes('pickup') || t.includes('truck')) return 'pickup';
  if (t.includes('van')) return 'van';
  if (t.includes('sport utility') || t.includes('suv') || t.includes('crossover')) return 'suv';
  if (t.includes('hatchback') || t.includes('wagon')) return 'hatchback';
  if (t.includes('coupe') || t.includes('convertible') || t.includes('roadster')) return 'coupe';
  return 'sedan';
}

function fuelFrom(primary: string, electrification: string): FuelType {
  const p = primary.toLowerCase();
  const e = electrification.toLowerCase();
  if (e.includes('bev') || p === 'electric') return 'electric';
  if (e.includes('hev') || e.includes('hybrid')) return 'hybrid';
  if (p.includes('diesel')) return 'diesel';
  if (p.includes('gasoline') || p.includes('petrol')) return 'petrol';
  return 'other';
}

const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export async function decodeVin(vin: string): Promise<Partial<Omit<Vehicle, 'odometer'>>> {
  const res = await fetch(`${VPIC}/DecodeVinValues/${encodeURIComponent(vin.trim())}?format=json`);
  if (!res.ok) throw new Error(`VIN decoder returned HTTP ${res.status}`);
  const row: Record<string, string> = (await res.json()).Results?.[0] ?? {};
  if (!row.Make) throw new Error(row.ErrorText || 'VIN could not be decoded');

  const specs: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'string' && !/^(Error|VIN$|SuggestedVIN|PossibleValues|AdditionalErrorText)/.test(k)) {
      specs[k.replace(/([a-z])([A-Z])/g, '$1 $2')] = v;
    }
  }
  const litres = row.DisplacementL ? `${Number(row.DisplacementL).toFixed(1)} L` : '';
  const cyl = row.EngineCylinders ? `${row.EngineCylinders}-cyl` : '';
  const hp = row.EngineHP ? `${Math.round(Number(row.EngineHP))} hp` : '';

  return {
    vin: vin.trim().toUpperCase(),
    year: row.ModelYear ?? '',
    make: title(row.Make),
    model: row.Model ?? '',
    trim: row.Trim ?? row.Series ?? '',
    bodyType: bodyFrom(`${row.BodyClass ?? ''} ${row.VehicleType ?? ''}`),
    fuelType: fuelFrom(row.FuelTypePrimary ?? '', row.ElectrificationLevel ?? ''),
    engine: [litres, cyl, row.EngineModel, hp].filter(Boolean).join(' '),
    transmission: [row.TransmissionSpeeds && `${row.TransmissionSpeeds}-speed`, row.TransmissionStyle]
      .filter(Boolean)
      .join(' '),
    specs,
  };
}

export async function fetchRecalls(v: Pick<Vehicle, 'make' | 'model' | 'year'>): Promise<Recall[]> {
  const q = `make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&modelYear=${encodeURIComponent(v.year)}`;
  const res = await fetch(`${RECALLS}?${q}`);
  if (!res.ok) throw new Error(`Recall lookup returned HTTP ${res.status}`);
  const rows: Record<string, string>[] = (await res.json()).results ?? [];
  return rows.map((r) => ({
    campaign: r.NHTSACampaignNumber ?? '',
    component: r.Component ?? '',
    summary: r.Summary ?? '',
    consequence: r.Consequence ?? '',
    remedy: r.Remedy ?? '',
    date: r.ReportReceivedDate ?? '',
  }));
}

/** Pre-built searches for the sources the app cannot fetch directly from a browser. */
export function researchLinks(v: Pick<Vehicle, 'make' | 'model' | 'year' | 'engine'>) {
  const name = `${v.year} ${v.make} ${v.model}`.trim();
  const q = encodeURIComponent(name);
  return [
    { title: 'YouTube: repair & maintenance videos', url: `https://www.youtube.com/results?search_query=${q}+repair+maintenance` },
    { title: 'Reddit: owner threads', url: `https://www.reddit.com/search/?q=${q}` },
    { title: 'Forums: common problems', url: `https://www.google.com/search?q=${q}+forum+common+problems` },
    { title: 'Owner / service manual (PDF search)', url: `https://www.google.com/search?q=${q}+service+manual+filetype%3Apdf` },
    { title: 'Wiring diagrams & technical drawings', url: `https://www.google.com/search?q=${q}+wiring+diagram&tbm=isch` },
    { title: 'Parts catalogue & OEM part numbers', url: `https://www.google.com/search?q=${q}+OEM+parts+catalog` },
    { title: 'NHTSA: complaints & investigations', url: `https://www.nhtsa.gov/vehicle/${encodeURIComponent(v.year)}/${encodeURIComponent(v.make)}/${encodeURIComponent(v.model)}` },
  ];
}

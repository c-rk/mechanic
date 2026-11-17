export type BodyType = 'sedan' | 'coupe' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'motorcycle';

export const BODY_TYPES: BodyType[] = ['sedan', 'coupe', 'hatchback', 'suv', 'pickup', 'van', 'motorcycle'];

export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other';

export type Pt = [number, number];

/** One photo used for the photo wrap, with the two alignment taps in full-resolution pixels. */
export interface WrapView {
  ref: string;
  width: number;
  height: number;
  /** Side: rear wheel centre. Front/rear: one tyre's ground contact. */
  p1: Pt;
  /** Side: front wheel centre. Front/rear: the other tyre's ground contact. */
  p2: Pt;
  /** Side only: wheel radius in pixels. */
  radiusPx?: number;
}

/** Body outline fitted to the side photo (metres, car coordinates). */
export interface WrapShape {
  profile: Pt[];
  xRear: number;
  xFront: number;
  clearance: number;
  wheelR: number;
}

export interface Wrap {
  side?: WrapView;
  front?: WrapView;
  rear?: WrapView;
  /** Present when the 3D body follows the photo's silhouette. */
  shape?: WrapShape;
}

export interface Vehicle {
  id: string;
  nickname: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  plate: string;
  bodyType: BodyType;
  color: string;
  engine: string;
  fuelType: FuelType;
  transmission: string;
  odometer: number;
  /** File reference of a user-supplied GLB model, if any. */
  modelRef?: string;
  /** Photo wrap for the built-in body. */
  wrap?: Wrap;
  /** Raw decoded specification fields (e.g. from the NHTSA VIN decoder). */
  specs: Record<string, string>;
  notes: string;
  createdAt: string;
}

export interface FuelEntry {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  volume: number;
  totalCost: number;
  /** True when the tank was filled completely; required to compute consumption. */
  full: boolean;
  station: string;
}

export interface MaintenanceItem {
  id: string;
  vehicleId: string;
  name: string;
  intervalDistance?: number;
  intervalMonths?: number;
  lastDoneOdometer?: number;
  lastDoneDate?: string;
  notes: string;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  title: string;
  cost: number;
  shop: string;
  notes: string;
}

export type PartStatus = 'wishlist' | 'ordered' | 'installed';

export interface PricePoint {
  date: string;
  price: number;
  vendor: string;
}

export interface Part {
  id: string;
  vehicleId: string;
  name: string;
  brand: string;
  partNumber: string;
  category: string;
  url: string;
  status: PartStatus;
  prices: PricePoint[];
  notes: string;
}

export type DocCategory = 'registration' | 'insurance' | 'service' | 'manual' | 'receipt' | 'other';

export interface Doc {
  id: string;
  vehicleId: string;
  name: string;
  category: DocCategory;
  mimeType: string;
  size: number;
  fileRef: string;
  addedAt: string;
}

export type LinkKind = 'manual' | 'forum' | 'video' | 'reddit' | 'blog' | 'other';

export interface SavedLink {
  id: string;
  vehicleId: string;
  title: string;
  url: string;
  kind: LinkKind;
  notes: string;
}

export interface Recall {
  campaign: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  date: string;
}

export interface ChatMessage {
  id: string;
  vehicleId: string;
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

export type OdoSource = 'manual' | 'fuel' | 'service' | 'gps';

export interface OdoReading {
  id: string;
  vehicleId: string;
  /** ISO timestamp. */
  at: string;
  odometer: number;
  source: OdoSource;
}

export interface Trip {
  id: string;
  vehicleId: string;
  start: string;
  end: string;
  /** Metres travelled, as measured by GPS. */
  meters: number;
}

export type AiProvider = 'anthropic' | 'openai' | 'custom';

export interface Settings {
  distanceUnit: 'km' | 'mi';
  volumeUnit: 'L' | 'gal';
  currency: string;
  aiProvider: AiProvider;
  aiModel: string;
  /** Base URL for an OpenAI-compatible endpoint (provider "custom"). */
  aiBaseUrl: string;
  /** Days between odometer reminders; 0 disables them. */
  odoReminderDays: number;
  /** Cloudflare Worker that relays public web data (see /worker). Empty disables online collection. */
  proxyUrl: string;
  proxyToken: string;
}

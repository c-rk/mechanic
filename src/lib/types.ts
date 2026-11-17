export type BodyType = 'sedan' | 'coupe' | 'hatchback' | 'suv' | 'pickup' | 'van' | 'motorcycle';

export const BODY_TYPES: BodyType[] = ['sedan', 'coupe', 'hatchback', 'suv', 'pickup', 'van', 'motorcycle'];

export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other';

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

export type AiProvider = 'anthropic' | 'openai' | 'custom';

export interface Settings {
  distanceUnit: 'km' | 'mi';
  volumeUnit: 'L' | 'gal';
  currency: string;
  aiProvider: AiProvider;
  aiModel: string;
  /** Base URL for an OpenAI-compatible endpoint (provider "custom"). */
  aiBaseUrl: string;
}

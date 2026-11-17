import { useStore } from './store';
import type { Vehicle } from './types';

/** Mirrors worker/src/parse.ts. */
export type ResearchKind = 'video' | 'reddit' | 'web' | 'complaint';

export interface ResearchItem {
  kind: ResearchKind;
  title: string;
  url: string;
  source: string;
  snippet?: string;
  date?: string;
  score?: number;
  thumbnail?: string;
}

export interface ProductInfo {
  title?: string;
  price?: number;
  currency?: string;
  availability?: string;
  url?: string;
}

export const proxyConfigured = () => Boolean(useStore.getState().settings.proxyUrl.trim());

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const { proxyUrl, proxyToken } = useStore.getState().settings;
  const base = proxyUrl.trim().replace(/\/+$/, '');
  if (!base) throw new Error('No data proxy configured. Add its URL in Setup.');
  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`${base}${path}?${qs}`, { headers: proxyToken ? { 'x-bayone-token': proxyToken } : {} });
  } catch {
    throw new Error('Could not reach the data proxy. Check the network connection and the proxy URL.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ? `Proxy: ${body.error}` : `Proxy returned HTTP ${res.status}`);
  return body as T;
}

/** Only make, model, year and an optional topic leave the device. */
export async function collectResearch(v: Pick<Vehicle, 'make' | 'model' | 'year'>, topic = '') {
  return get<{ items: ResearchItem[]; errors: Record<string, string> }>('/research', {
    make: v.make,
    model: v.model,
    year: v.year,
    ...(topic ? { topic } : {}),
  });
}

export async function checkPrice(url: string) {
  return get<ProductInfo>('/product', { url });
}

export async function proxyHealth() {
  return get<{ ok: boolean; features: Record<string, boolean> }>('/health', {});
}

import { useStore } from './store';
import type { Vehicle } from './types';

/** Mirrors worker/src/parse.ts. */
export type ResearchKind = 'manual' | 'video' | 'reddit' | 'forum' | 'web' | 'wiki' | 'complaint';

export interface ResearchItem {
  kind: ResearchKind;
  title: string;
  url: string;
  source: string;
  snippet?: string;
  date?: string;
  score?: number;
  thumbnail?: string;
  /** Readable text saved for offline reading (forum threads and articles). */
  offlineText?: string;
}

export interface ProductInfo {
  title?: string;
  price?: number;
  currency?: string;
  availability?: string;
  url?: string;
}

/** The Bay One relay deployed for this app; Setup can point at another one. */
export const DEFAULT_PROXY = 'https://bay-one-proxy.tiny-violet-c3ae.workers.dev';

export const proxyBase = () => (useStore.getState().settings.proxyUrl.trim() || DEFAULT_PROXY).replace(/\/+$/, '');

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const { proxyToken } = useStore.getState().settings;
  const base = proxyBase();
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

export async function readPage(url: string) {
  return get<{ title?: string; text: string; url: string }>('/page', { url });
}

/** Downloads a PDF through the relay (shops and manufacturers rarely allow cross-origin downloads). */
export async function fetchPdf(url: string): Promise<{ blob: Blob; name: string }> {
  const { proxyToken } = useStore.getState().settings;
  const res = await fetch(`${proxyBase()}/file?${new URLSearchParams({ url })}`, { headers: proxyToken ? { 'x-bayone-token': proxyToken } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `Download failed (HTTP ${res.status})`);
  }
  return { blob: await res.blob(), name: res.headers.get('x-bayone-filename') || 'manual.pdf' };
}

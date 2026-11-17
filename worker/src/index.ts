/**
 * Bay One data relay. Stateless: it stores nothing and logs nothing beyond Cloudflare's defaults.
 * It exists because browsers block cross-origin requests to Reddit, YouTube, search APIs and shops,
 * and because API keys for those services must not ship inside the app.
 */
import { extractProduct, mapBrave, mapComplaints, mapReddit, mapYoutube, safeTarget, type ResearchItem } from './parse.ts';

export interface Env {
  ALLOWED_ORIGINS?: string;
  APP_TOKEN?: string;
  YOUTUBE_API_KEY?: string;
  BRAVE_API_KEY?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
}

const UA = 'BayOne/1.0 (personal garage app relay)';
const MAX_HTML = 1_500_000;

function cors(req: Request, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
  const origin = req.headers.get('Origin') ?? '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'x-bayone-token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store', ...headers },
  });

async function fetchJson(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${res.status}`);
  return res.json();
}

let redditToken: { value: string; expires: number } | null = null;

async function reddit(q: string, env: Env): Promise<ResearchItem[]> {
  const params = `q=${encodeURIComponent(q)}&limit=25&sort=relevance&t=all&type=link`;
  if (env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET) {
    if (!redditToken || redditToken.expires < Date.now()) {
      const t = await fetchJson('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      redditToken = { value: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 };
    }
    return mapReddit(await fetchJson(`https://oauth.reddit.com/search?${params}`, { headers: { Authorization: `Bearer ${redditToken.value}` } }));
  }
  return mapReddit(await fetchJson(`https://www.reddit.com/search.json?${params}`));
}

async function youtube(q: string, env: Env): Promise<ResearchItem[]> {
  if (!env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY is not configured');
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&relevanceLanguage=en&q=${encodeURIComponent(q)}&key=${env.YOUTUBE_API_KEY}`;
  return mapYoutube(await fetchJson(url));
}

async function web(q: string, env: Env): Promise<ResearchItem[]> {
  if (!env.BRAVE_API_KEY) throw new Error('BRAVE_API_KEY is not configured');
  const url = `https://api.search.brave.com/res/v1/web/search?count=20&q=${encodeURIComponent(q)}`;
  return mapBrave(await fetchJson(url, { headers: { 'X-Subscription-Token': env.BRAVE_API_KEY } }));
}

async function complaints(make: string, model: string, year: string): Promise<ResearchItem[]> {
  const url = `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
  return mapComplaints(await fetchJson(url), make, model, year);
}

async function readCapped(res: Response, cap: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < cap) {
    const { value, done } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(size, cap));
  let o = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, all.length - o));
    all.set(part, o);
    o += part.length;
  }
  return new TextDecoder().decode(all);
}

async function handle(req: Request, env: Env): Promise<Response> {
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, h);

  const url = new URL(req.url);
  if (url.pathname === '/health') {
    return json(
      { ok: true, features: { reddit: Boolean(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET), youtube: Boolean(env.YOUTUBE_API_KEY), web: Boolean(env.BRAVE_API_KEY), complaints: true, product: true } },
      200,
      h,
    );
  }
  if (env.APP_TOKEN && req.headers.get('x-bayone-token') !== env.APP_TOKEN) return json({ error: 'Invalid or missing token' }, 401, h);

  if (url.pathname === '/research') {
    const make = url.searchParams.get('make')?.trim() ?? '';
    const model = url.searchParams.get('model')?.trim() ?? '';
    const year = url.searchParams.get('year')?.trim() ?? '';
    const topic = url.searchParams.get('topic')?.trim() ?? '';
    if (!make || !model) return json({ error: 'make and model are required' }, 400, h);
    const name = [year, make, model].filter(Boolean).join(' ');
    const jobs: Record<string, Promise<ResearchItem[]>> = {
      reddit: reddit(`${name} ${topic}`.trim(), env),
      youtube: youtube(`${name} ${topic || 'maintenance repair'}`, env),
      web: web(`${name} ${topic || 'forum common problems'}`, env),
    };
    if (year && !topic) jobs.complaints = complaints(make, model, year);
    const names = Object.keys(jobs);
    const settled = await Promise.allSettled(Object.values(jobs));
    const items: ResearchItem[] = [];
    const errors: Record<string, string> = {};
    settled.forEach((r, i) => (r.status === 'fulfilled' ? items.push(...r.value) : (errors[names[i]] = String(r.reason?.message ?? r.reason))));
    return json({ items, errors }, 200, h, 6 * 3600);
  }

  if (url.pathname === '/product') {
    const target = safeTarget(url.searchParams.get('url') ?? '');
    if (!target) return json({ error: 'A public http(s) URL is required' }, 400, h);
    const res = await fetch(target.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BayOne price check)', Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return json({ error: `Shop returned HTTP ${res.status}` }, 502, h);
    if (!safeTarget(res.url)) return json({ error: 'Redirected to a disallowed address' }, 502, h);
    const info = extractProduct(await readCapped(res, MAX_HTML));
    return json({ ...info, url: res.url }, 200, h, 3600);
  }

  return json({ error: 'Not found' }, 404, h);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Edge cache keyed on the full URL; the token is a header, so cached answers are only served
    // to requests that passed the token check when they were first computed.
    const cache = caches.default;
    const cacheable = req.method === 'GET' && !new URL(req.url).pathname.startsWith('/health');
    if (cacheable && (!env.APP_TOKEN || req.headers.get('x-bayone-token') === env.APP_TOKEN)) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    let res: Response;
    try {
      res = await handle(req, env);
    } catch (e) {
      res = json({ error: (e as Error).message }, 502, cors(req, env));
    }
    if (cacheable && res.status === 200) ctx.waitUntil(cache.put(req, res.clone()));
    return res;
  },
};

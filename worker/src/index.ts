/**
 * Bay One data relay. Stateless: it stores nothing and logs nothing beyond Cloudflare's defaults.
 * It exists because browsers block cross-origin requests to Reddit, YouTube, search APIs, shops and
 * PDF hosts, and because API keys for those services must not ship inside the app.
 */
import {
  classify,
  extractProduct,
  extractReadable,
  mapBrave,
  mapComplaints,
  mapReddit,
  mapYoutube,
  parseYoutubeHtml,
  safeTarget,
  type ResearchItem,
} from './parse.ts';

export interface Env {
  /** Comma-separated browser origins allowed to call the relay; "*" allows any. */
  ALLOWED_ORIGINS?: string;
  APP_TOKEN?: string;
  YOUTUBE_API_KEY?: string;
  BRAVE_API_KEY?: string;
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const MAX_HTML = 1_500_000;
const MAX_FILE = 60 * 1024 * 1024;

const origins = (env: Env) => (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());

function cors(req: Request, env: Env): Record<string, string> {
  const allowed = origins(env);
  const origin = req.headers.get('Origin') ?? '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'x-bayone-token',
    'Access-Control-Expose-Headers': 'content-disposition, x-bayone-filename',
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

// --- Sources -----------------------------------------------------------------------------------

let redditToken: { value: string; expires: number } | null = null;

async function reddit(q: string, env: Env): Promise<ResearchItem[]> {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) throw new Error('Reddit needs REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET');
  if (!redditToken || redditToken.expires < Date.now()) {
    const t = await fetchJson('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'BayOne/1.0 (personal garage app relay)',
      },
      body: 'grant_type=client_credentials',
    });
    redditToken = { value: t.access_token, expires: Date.now() + (t.expires_in - 60) * 1000 };
  }
  const params = `q=${encodeURIComponent(q)}&limit=25&sort=relevance&t=all&type=link`;
  return mapReddit(
    await fetchJson(`https://oauth.reddit.com/search?${params}`, {
      headers: { Authorization: `Bearer ${redditToken.value}`, 'User-Agent': 'BayOne/1.0 (personal garage app relay)' },
    }),
  );
}

/** YouTube Data API when a key is configured, otherwise the public results page. */
async function youtube(q: string, env: Env): Promise<ResearchItem[]> {
  if (env.YOUTUBE_API_KEY) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&relevanceLanguage=en&q=${encodeURIComponent(q)}&key=${env.YOUTUBE_API_KEY}`;
    return mapYoutube(await fetchJson(url));
  }
  const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en&gl=US`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI' },
  });
  if (!res.ok) throw new Error(`YouTube returned HTTP ${res.status}`);
  const items = parseYoutubeHtml(await readCapped(res, 4_000_000));
  if (!items.length) throw new Error('YouTube returned no parsable results');
  return items.slice(0, 20);
}

/** Brave Search, several focused queries; results sorted into manuals, forums and articles. */
async function web(name: string, topic: string, env: Env): Promise<ResearchItem[]> {
  if (!env.BRAVE_API_KEY) throw new Error('Web search needs BRAVE_API_KEY');
  const queries = topic
    ? [`${name} ${topic}`, `${name} ${topic} forum`]
    : [`${name} owner's manual pdf`, `${name} service repair manual`, `${name} forum common problems`, `${name} maintenance schedule`];
  const all = await Promise.all(
    queries.map((q) =>
      fetchJson(`https://api.search.brave.com/res/v1/web/search?count=12&q=${encodeURIComponent(q)}`, {
        headers: { 'X-Subscription-Token': env.BRAVE_API_KEY! },
      }).then(mapBrave, () => [] as ResearchItem[]),
    ),
  );
  const seen = new Set<string>();
  return all.flat().filter((x) => !seen.has(x.url) && seen.add(x.url)).map(classify);
}

async function complaints(make: string, model: string, year: string): Promise<ResearchItem[]> {
  const url = `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
  return mapComplaints(await fetchJson(url), make, model, year);
}

/** Wikipedia article for the model (or generation), with its lead summary. */
async function wikipedia(name: string): Promise<ResearchItem[]> {
  const s = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=${encodeURIComponent(name + ' car')}`);
  const hits: any[] = s?.query?.search ?? [];
  const out: ResearchItem[] = [];
  for (const h of hits.slice(0, 2)) {
    const sum = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(h.title.replace(/ /g, '_'))}`).catch(() => null);
    if (!sum?.extract) continue;
    out.push({
      kind: 'wiki',
      title: sum.title,
      url: sum.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(h.title)}`,
      source: 'Wikipedia',
      snippet: String(sum.extract).slice(0, 600),
      thumbnail: sum.thumbnail?.source,
    });
  }
  return out;
}

// --- Handler ------------------------------------------------------------------------------------

async function handle(req: Request, env: Env): Promise<Response> {
  const h = cors(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, h);

  // Browsers always send Origin on cross-origin requests; refuse sites that are not the app.
  const origin = req.headers.get('Origin');
  const allowed = origins(env);
  if (origin && !allowed.includes('*') && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, h);

  const url = new URL(req.url);
  if (url.pathname === '/health') {
    return json(
      {
        ok: true,
        features: {
          youtube: true,
          reddit: Boolean(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET),
          web: Boolean(env.BRAVE_API_KEY),
          complaints: true,
          wikipedia: true,
          product: true,
          files: true,
        },
      },
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
      youtube: youtube(`${name} ${topic || 'maintenance repair how to'}`, env),
      web: web(name, topic, env),
      reddit: reddit(`${name} ${topic}`.trim(), env),
    };
    if (!topic) jobs.wikipedia = wikipedia(`${make} ${model}`);
    if (year && !topic) jobs.complaints = complaints(make, model, year);
    const names = Object.keys(jobs);
    const settled = await Promise.allSettled(Object.values(jobs));
    const items: ResearchItem[] = [];
    const errors: Record<string, string> = {};
    settled.forEach((r, i) => (r.status === 'fulfilled' ? items.push(...r.value) : (errors[names[i]] = String(r.reason?.message ?? r.reason))));
    return json({ items, errors }, 200, h, 6 * 3600);
  }

  if (url.pathname === '/product' || url.pathname === '/page' || url.pathname === '/file') {
    const target = safeTarget(url.searchParams.get('url') ?? '');
    if (!target) return json({ error: 'A public http(s) URL is required' }, 400, h);
    const res = await fetch(target.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: url.pathname === '/file' ? 'application/pdf,*/*' : 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(url.pathname === '/file' ? 45000 : 15000),
    });
    if (!res.ok) return json({ error: `Site returned HTTP ${res.status}` }, 502, h);
    if (!safeTarget(res.url)) return json({ error: 'Redirected to a disallowed address' }, 502, h);

    if (url.pathname === '/file') {
      const type = res.headers.get('content-type') ?? '';
      const isPdf = type.includes('pdf') || /\.pdf($|\?)/i.test(res.url);
      if (!isPdf) return json({ error: 'Only PDF documents can be saved' }, 415, h);
      const size = Number(res.headers.get('content-length') ?? 0);
      if (size > MAX_FILE) return json({ error: `File is larger than ${MAX_FILE / 1048576} MB` }, 413, h);
      const name = decodeURIComponent(new URL(res.url).pathname.split('/').pop() || 'manual.pdf').replace(/[^\w.\- ]+/g, '_');
      return new Response(res.body, {
        status: 200,
        headers: { ...h, 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400', 'x-bayone-filename': name },
      });
    }
    const html = await readCapped(res, MAX_HTML);
    if (url.pathname === '/page') return json({ ...extractReadable(html), url: res.url }, 200, h, 86400);
    return json({ ...extractProduct(html), url: res.url }, 200, h, 3600);
  }

  return json({ error: 'Not found' }, 404, h);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Edge cache keyed on the full URL. PDFs are streamed and not cached here.
    const cache = caches.default;
    const path = new URL(req.url).pathname;
    const cacheable = req.method === 'GET' && path !== '/health' && path !== '/file';
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

/** Pure response mappers and HTML extraction; no Workers APIs, so they run under Node tests. */

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
  image?: string;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const clip = (s: string | undefined, n = 280) => {
  if (!s) return undefined;
  const t = decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

export function mapReddit(json: any): ResearchItem[] {
  const children: any[] = json?.data?.children ?? [];
  return children
    .map((c) => c?.data)
    .filter((d) => d && d.permalink && !d.over_18)
    .map((d) => ({
      kind: 'reddit' as const,
      title: clip(d.title, 200) ?? '',
      url: `https://www.reddit.com${d.permalink}`,
      source: `r/${d.subreddit}`,
      snippet: clip(d.selftext),
      date: d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : undefined,
      score: typeof d.num_comments === 'number' ? d.num_comments : undefined,
    }));
}

export function mapYoutube(json: any): ResearchItem[] {
  const items: any[] = json?.items ?? [];
  return items
    .filter((i) => i?.id?.videoId)
    .map((i) => ({
      kind: 'video' as const,
      title: clip(i.snippet?.title, 200) ?? '',
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      source: clip(i.snippet?.channelTitle, 80) ?? 'YouTube',
      snippet: clip(i.snippet?.description),
      date: i.snippet?.publishedAt?.slice(0, 10),
      thumbnail: i.snippet?.thumbnails?.medium?.url ?? i.snippet?.thumbnails?.default?.url,
    }));
}

export function mapBrave(json: any): ResearchItem[] {
  const results: any[] = json?.web?.results ?? [];
  return results
    .filter((r) => r?.url)
    .map((r) => {
      let host = '';
      try {
        host = new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        host = 'web';
      }
      return {
        kind: 'web' as const,
        title: clip(r.title, 200) ?? r.url,
        url: r.url,
        source: host,
        snippet: clip(r.description),
        date: r.page_age?.slice(0, 10),
      };
    });
}

export function mapComplaints(json: any, make: string, model: string, year: string): ResearchItem[] {
  const rows: any[] = json?.results ?? [];
  return rows.slice(0, 60).map((r) => ({
    kind: 'complaint' as const,
    title: String(r.components ?? 'Complaint').split(',').slice(0, 2).join(', '),
    url: `https://www.nhtsa.gov/vehicle/${encodeURIComponent(year)}/${encodeURIComponent(make)}/${encodeURIComponent(model)}`,
    source: `NHTSA #${r.odiNumber ?? ''}`.trim(),
    snippet: clip(r.summary, 400),
    date: r.dateComplaintFiled ? toIso(r.dateComplaintFiled) : undefined,
  }));
}

const toIso = (d: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(d);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : d.slice(0, 10);
};

// ---------------------------------------------------------------------------------------------
// Product pages

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return undefined;
  // Accept "1,234.56", "1.234,56" and "34.99".
  const s = v.replace(/[^\d.,]/g, '');
  if (!s) return undefined;
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  const decimals = lastSep >= 0 && s.length - lastSep - 1 <= 2;
  const n = decimals
    ? Number(s.slice(0, lastSep).replace(/[.,]/g, '') + '.' + s.slice(lastSep + 1))
    : Number(s.replace(/[.,]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

function* walk(node: any): Generator<any> {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walk(n);
    return;
  }
  yield node;
  for (const v of Object.values(node)) if (v && typeof v === 'object') yield* walk(v);
}

const isType = (n: any, t: string) => {
  const ty = n?.['@type'];
  return Array.isArray(ty) ? ty.includes(t) : ty === t;
};

function meta(html: string, key: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name|itemprop)=["']${key.replace(/[:.]/g, '\\$&')}["'][^>]*>`,
    'i',
  );
  const tag = re.exec(html)?.[0];
  return tag ? decodeEntities(/content=["']([^"']*)["']/i.exec(tag)?.[1] ?? '') || undefined : undefined;
}

/** Extracts price data from schema.org JSON-LD, then Open Graph / product meta tags, then microdata. */
export function extractProduct(html: string): ProductInfo {
  const info: ProductInfo = {};
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    for (const n of walk(data)) {
      if (isType(n, 'Product')) {
        info.title ??= clip(n.name, 200);
        const img = Array.isArray(n.image) ? n.image[0] : n.image;
        info.image ??= typeof img === 'string' ? img : img?.url;
      }
      if (isType(n, 'Offer') || isType(n, 'AggregateOffer')) {
        const price = num(n.price ?? n.lowPrice ?? n.priceSpecification?.price);
        if (price !== undefined && info.price === undefined) {
          info.price = price;
          info.currency = n.priceCurrency ?? n.priceSpecification?.priceCurrency;
          info.availability = typeof n.availability === 'string' ? n.availability.replace(/^https?:\/\/schema\.org\//, '') : undefined;
        }
      }
    }
  }
  info.title ??= clip(meta(html, 'og:title'), 200) ?? clip(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1], 200);
  info.image ??= meta(html, 'og:image');
  if (info.price === undefined) {
    info.price = num(meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount') ?? meta(html, 'price'));
    info.currency ??= meta(html, 'product:price:currency') ?? meta(html, 'og:price:currency') ?? meta(html, 'priceCurrency');
  }
  if (info.price === undefined) {
    const micro = /itemprop=["']price["'][^>]*?(?:content=["']([^"']+)["'][^>]*>|>([^<]+)<)/i.exec(html);
    info.price = num(micro?.[1] ?? micro?.[2]);
  }
  return info;
}

/** Rejects URLs that could reach private infrastructure or are not plain web pages. */
export function safeTarget(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || /\.(local|internal|localhost|lan|home|corp)$/.test(h)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.startsWith('[') || h.includes(':')) return null;
  return u;
}

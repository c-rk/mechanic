import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFileSync } from 'node:fs';

import { classify, extractProduct, extractReadable, mapReddit, mapYoutube, parseYoutubeHtml, safeTarget } from '../src/parse.ts';

test('JSON-LD offer price wins over meta tags', () => {
  const html = `<html><head><title>Ignored</title>
    <meta property="og:title" content="OG title">
    <meta property="product:price:amount" content="99.00">
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Brembo P 28 030 Front Pads","image":["https://x/img.jpg"],
      "offers":{"@type":"Offer","price":"34.99","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}]}</script></head></html>`;
  assert.deepEqual(extractProduct(html), {
    title: 'Brembo P 28 030 Front Pads',
    image: 'https://x/img.jpg',
    price: 34.99,
    currency: 'EUR',
    availability: 'InStock',
  });
});

test('falls back to product meta tags and parses European decimals', () => {
  const html = `<meta content="1.234,50" property="product:price:amount"><meta property="product:price:currency" content="EUR"><meta property="og:title" content="Oil &amp; filter kit">`;
  const p = extractProduct(html);
  assert.equal(p.price, 1234.5);
  assert.equal(p.currency, 'EUR');
  assert.equal(p.title, 'Oil & filter kit');
});

test('microdata price', () => {
  assert.equal(extractProduct('<span itemprop="price">$1,049.00</span>').price, 1049);
});

test('reddit mapping skips NSFW and builds permalinks', () => {
  const items = mapReddit({ data: { children: [
    { data: { title: 'Civic grinding noise', permalink: '/r/Honda/comments/abc/', subreddit: 'Honda', num_comments: 12, created_utc: 1700000000 } },
    { data: { title: 'x', permalink: '/r/x/', subreddit: 'x', over_18: true } },
  ] } });
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://www.reddit.com/r/Honda/comments/abc/');
  assert.equal(items[0].date, '2023-11-14');
});

test('youtube mapping', () => {
  const [v] = mapYoutube({ items: [{ id: { videoId: 'v1' }, snippet: { title: 'Pads &amp; rotors', channelTitle: 'Shop', publishedAt: '2024-02-03T00:00:00Z' } }] });
  assert.equal(v.url, 'https://www.youtube.com/watch?v=v1');
  assert.equal(v.title, 'Pads & rotors');
});

test('safeTarget blocks private and odd targets', () => {
  for (const bad of ['http://localhost/', 'http://10.0.0.1/', 'http://[::1]/', 'file:///etc/passwd', 'http://printer.local/', 'http://u:p@shop.com/', 'http://shop.com:8080/', 'http://intranet/']) {
    assert.equal(safeTarget(bad), null, bad);
  }
  assert.ok(safeTarget('https://www.rockauto.com/en/parts'));
});

test('youtube results page without an API key', () => {
  const path = process.env.YT_FIXTURE;
  if (!path) return;
  const items = parseYoutubeHtml(readFileSync(path, 'utf8'));
  assert.ok(items.length >= 10, `only ${items.length} videos`);
  assert.match(items[0].url, /^https:\/\/www\.youtube\.com\/watch\?v=/);
  assert.ok(items[0].title.length > 5);
});

test('readable text keeps the article and drops navigation', () => {
  const html = `<html><head><title>Fix: grinding brakes</title><script>x()</script></head><body><nav>Home | Forums</nav>
    <article><h1>Grinding brakes</h1><p>Check the pads first.</p><ul><li>Remove wheel</li><li>Measure pad</li></ul>${'<p>filler text.</p>'.repeat(120)}</article><footer>© site</footer></body></html>`;
  const r = extractReadable(html);
  assert.equal(r.title, 'Fix: grinding brakes');
  assert.ok(r.text.startsWith('Grinding brakes\nCheck the pads first.\n• Remove wheel'));
  assert.ok(!r.text.includes('Forums') && !r.text.includes('© site'));
});

test('classify sorts manuals, forums and reddit', () => {
  const k = (url: string, title = '') => classify({ kind: 'web', title, url, source: '' }).kind;
  assert.equal(k('https://example.com/2018-civic.pdf'), 'manual');
  assert.equal(k('https://www.manualslib.com/manual/1/Honda-Civic.html', 'Honda Civic owners manual'), 'manual');
  assert.equal(k('https://www.civicx.com/threads/oil.123/'), 'forum');
  assert.equal(k('https://www.reddit.com/r/civic/comments/x/'), 'reddit');
  assert.equal(k('https://www.caranddriver.com/honda/civic-2018'), 'web');
});

test('readable text survives attributes that contain >', () => {
  const html = `<title>T</title><main><p data-mw='{"a":"<br />x"}'>Real text here that is long enough.</p>${'<p>More body text.</p>'.repeat(150)}<table><tr><td>infobox</td></tr></table></main>`;
  const r = extractReadable(html);
  assert.ok(r.text.startsWith('Real text here'), r.text.slice(0, 80));
  assert.ok(!r.text.includes('data-mw') && !r.text.includes('infobox'));
});

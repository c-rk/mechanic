import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractProduct, mapReddit, mapYoutube, safeTarget } from '../src/parse.ts';

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

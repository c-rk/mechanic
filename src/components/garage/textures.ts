import * as THREE from 'three';

/** Small generated textures for the garage. Pixel buffers only, so they work on every platform. */

function make(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number], repeat = false) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  const t = new THREE.DataTexture(data, w, h);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.DataTexture>();
const once = (key: string, f: () => THREE.DataTexture) => {
  let t = cache.get(key);
  if (!t) {
    t = f();
    cache.set(key, t);
  }
  return t;
};

/** Corrugated steel cladding: soft vertical ribs, tileable horizontally. */
export const corrugated = () =>
  once('corrugated', () =>
    make(
      32,
      4,
      (x) => {
        const v = 20 + Math.round(10 * (0.5 + 0.5 * Math.cos((x / 32) * Math.PI * 2)));
        return [v, v + 1, v + 3, 255];
      },
      true,
    ),
  );

// Seven-segment glyphs: a b c d e f g.
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
};

/** Two-digit bay number in a stencil seven-segment style; white with alpha, tint via material colour. */
export const bayNumber = (n: number) =>
  once(`bay-${n}`, () => {
    const text = String(n).padStart(2, '0');
    const W = 64;
    const H = 96;
    const t = 9; // stroke
    const gap = 3; // stencil gaps between segments
    const seg = (s: string, x: number, y: number) => {
      const top = y >= gap && y < t + gap;
      const mid = Math.abs(y - H / 2) < t / 2;
      const bot = y >= H - t - gap && y < H - gap;
      const left = x >= gap && x < t + gap;
      const right = x >= W - t - gap && x < W - gap;
      const inX = x >= t + gap * 2 && x < W - t - gap * 2;
      const upper = y >= t + gap * 2 && y < H / 2 - t / 2 - gap;
      const lower = y > H / 2 + t / 2 + gap && y < H - t - gap * 2;
      switch (s) {
        case 'a': return top && inX;
        case 'g': return mid && inX;
        case 'd': return bot && inX;
        case 'f': return left && upper;
        case 'b': return right && upper;
        case 'e': return left && lower;
        case 'c': return right && lower;
      }
      return false;
    };
    const total = W * 2 + 16;
    return make(total, H, (x, y) => {
      const digit = x < W ? 0 : x >= W + 16 ? 1 : -1;
      if (digit < 0) return [255, 255, 255, 0];
      const lx = digit ? x - W - 16 : x;
      const on = [...SEGMENTS[text[digit]]].some((s) => seg(s, lx, H - 1 - y));
      return [255, 255, 255, on ? 255 : 0];
    });
  });

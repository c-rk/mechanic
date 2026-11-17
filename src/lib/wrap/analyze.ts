/**
 * Offline photo analysis for the photo wrap. Pure TypeScript, no platform APIs:
 * - maps between car coordinates (metres) and photo pixels from two user taps,
 * - separates the vehicle from the background (border flood fill),
 * - fits the side silhouette (roofline, overhangs, sill height),
 * - samples the paint colour,
 * - builds the RGBA texture whose alpha marks vehicle pixels.
 *
 * Car coordinates: x forward, y up, z to the car's left; origin on the ground midway between the axles.
 */
import { SPECS, type CarBody } from '../bodySpecs';
import type { Pt, WrapShape, WrapView } from '../types';

export type { Pt, WrapView };

export interface Pixels {
  width: number;
  height: number;
  /** RGBA, row 0 = top of the image. */
  data: Uint8Array;
}

export type ViewKind = 'side' | 'front' | 'rear';

/** Affine map from car-plane coordinates (a, b) to pixels: px = o + a·u + b·v. */
export interface Frame {
  o: Pt;
  u: Pt;
  v: Pt;
  /** Metres per pixel. */
  mpp: number;
}

export const trackWidth = (body: CarBody) => SPECS[body].width - 0.26;

const up = (dx: number, dy: number): Pt => {
  // Perpendicular to (dx, dy) that points up in the image (negative y).
  const v: Pt = [dy, -dx];
  return v[1] > 0 ? [-v[0], -v[1]] : v;
};

/** Side view: (a, b) = (x, y). */
export function sideFrame(view: WrapView, body: CarBody): Frame & { rPx: number; wheelR: number } {
  const spec = SPECS[body];
  const [ax, ay] = view.p1;
  const [bx, by] = view.p2;
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const u: Pt = [(bx - ax) / d, (by - ay) / d];
  const v = up(u[0], u[1]);
  const mpp = (2 * spec.axle) / d;
  const rPx = view.radiusPx ?? spec.wheelR / mpp;
  const o: Pt = [(ax + bx) / 2 - v[0] * rPx, (ay + by) / 2 - v[1] * rPx];
  return { o, u: [u[0] / mpp, u[1] / mpp], v: [v[0] / mpp, v[1] / mpp], mpp, rPx, wheelR: rPx * mpp };
}

/**
 * Front/rear view: (a, b) = (z, y). Taps are the two tyre contact points; their order does not matter.
 * Seen from the front, the car's left (+z) is on the image's right; seen from behind it is on the left.
 */
export function endFrame(view: WrapView, body: CarBody, kind: 'front' | 'rear'): Frame {
  const [l, r] = view.p1[0] <= view.p2[0] ? [view.p1, view.p2] : [view.p2, view.p1];
  const d = Math.hypot(r[0] - l[0], r[1] - l[1]) || 1;
  const dir: Pt = [(r[0] - l[0]) / d, (r[1] - l[1]) / d];
  const v = up(dir[0], dir[1]);
  const mpp = trackWidth(body) / d;
  // +z goes towards image-right on a front photo and image-left on a rear photo.
  const s = kind === 'front' ? 1 : -1;
  return {
    o: [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2],
    u: [(s * dir[0]) / mpp, (s * dir[1]) / mpp],
    v: [v[0] / mpp, v[1] / mpp],
    mpp,
  };
}

export const toPx = (f: Frame, a: number, b: number): Pt => [
  f.o[0] + f.u[0] * a + f.v[0] * b,
  f.o[1] + f.u[1] * a + f.v[1] * b,
];

/** Inverse of toPx (u and v are orthogonal with equal length 1/mpp). */
export const fromPx = (f: Frame, x: number, y: number): Pt => {
  const dx = x - f.o[0];
  const dy = y - f.o[1];
  const k = f.mpp * f.mpp;
  return [(dx * f.u[0] + dy * f.u[1]) * k, (dx * f.v[0] + dy * f.v[1]) * k];
};

/** Row-major 3×3 matrix mapping (a, b, 1) to texture UV (0..1, v = 0 at the top row). */
export function uvMatrix(f: Frame, width: number, height: number): number[] {
  return [f.u[0] / width, f.v[0] / width, f.o[0] / width, f.u[1] / height, f.v[1] / height, f.o[1] / height, 0, 0, 1];
}

// ---------------------------------------------------------------------------------------------
// Segmentation

interface Work {
  w: number;
  h: number;
  rgb: Float32Array;
  /** Full-resolution pixels per working pixel. */
  scale: number;
}

function downsample(px: Pixels, maxW = 300): Work {
  const scale = Math.max(1, px.width / maxW);
  const w = Math.max(1, Math.round(px.width / scale));
  const h = Math.max(1, Math.round(px.height / scale));
  const rgb = new Float32Array(w * h * 3);
  const taps = [0.25, 0.75];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const ty of taps) {
        for (const tx of taps) {
          const sx = Math.min(px.width - 1, Math.floor((x + tx) * scale));
          const sy = Math.min(px.height - 1, Math.floor((y + ty) * scale));
          const i = (sy * px.width + sx) * 4;
          r += px.data[i];
          g += px.data[i + 1];
          b += px.data[i + 2];
        }
      }
      const o = (y * w + x) * 3;
      rgb[o] = r / 4;
      rgb[o + 1] = g / 4;
      rgb[o + 2] = b / 4;
    }
  }
  return { w, h, rgb, scale };
}

const dist2 = (rgb: Float32Array, i: number, j: number) => {
  const a = i * 3;
  const b = j * 3;
  const dr = rgb[a] - rgb[b];
  const dg = rgb[a + 1] - rgb[b + 1];
  const db = rgb[a + 2] - rgb[b + 2];
  return dr * dr + dg * dg + db * db;
};

/**
 * Flood fill from the image border. A pixel joins the background when it is close to its
 * already-background neighbour (local edge test) and to the border colour it grew from (drift test).
 * `protect` marks pixels known to be vehicle; the fill never enters them.
 * Returns 1 for vehicle, 0 for background, keeping only the region connected to `protect`.
 */
function segment(work: Work, protect: Uint8Array): Uint8Array {
  const { w, h, rgb } = work;
  const n = w * h;

  // Local threshold from the border's own noise level.
  const grads: number[] = [];
  for (let x = 1; x < w; x++) grads.push(Math.sqrt(dist2(rgb, x, x - 1)), Math.sqrt(dist2(rgb, (h - 1) * w + x, (h - 1) * w + x - 1)));
  for (let y = 1; y < h; y++) grads.push(Math.sqrt(dist2(rgb, y * w, (y - 1) * w)), Math.sqrt(dist2(rgb, y * w + w - 1, (y - 1) * w + w - 1)));
  grads.sort((a, b) => a - b);
  const median = grads[grads.length >> 1] ?? 4;
  const tLocal = Math.min(24, Math.max(9, median * 2.5 + 6));
  const tLocal2 = tLocal * tLocal;
  const tDrift2 = 80 * 80;

  const bg = new Uint8Array(n);
  const origin = new Int32Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const seed = (i: number) => {
    if (bg[i] || protect[i]) return;
    bg[i] = 1;
    origin[i] = i;
    queue[tail++] = i;
  };
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const tryN = (j: number) => {
      if (bg[j] || protect[j]) return;
      if (dist2(rgb, i, j) > tLocal2 || dist2(rgb, origin[i], j) > tDrift2) return;
      bg[j] = 1;
      origin[j] = origin[i];
      queue[tail++] = j;
    };
    if (x > 0) tryN(i - 1);
    if (x < w - 1) tryN(i + 1);
    if (y > 0) tryN(i - w);
    if (y < h - 1) tryN(i + w);
  }

  // Keep the foreground component that contains the protected core.
  const fg = new Uint8Array(n);
  head = 0;
  tail = 0;
  for (let i = 0; i < n; i++) {
    if (protect[i]) {
      fg[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const visit = (j: number) => {
      if (fg[j] || bg[j]) return;
      fg[j] = 1;
      queue[tail++] = j;
    };
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (y > 0) visit(i - w);
    if (y < h - 1) visit(i + w);
  }
  return fg;
}

function protectRegion(work: Work, f: Frame, inside: (a: number, b: number) => boolean) {
  const p = new Uint8Array(work.w * work.h);
  for (let y = 0; y < work.h; y++) {
    for (let x = 0; x < work.w; x++) {
      const [a, b] = fromPx(f, (x + 0.5) * work.scale, (y + 0.5) * work.scale);
      if (inside(a, b)) p[y * work.w + x] = 1;
    }
  }
  return p;
}

export interface Mask {
  w: number;
  h: number;
  /** Full-resolution pixels per mask pixel. */
  scale: number;
  data: Uint8Array;
}

const maskAt = (m: Mask, px: number, py: number) => {
  const x = Math.floor(px / m.scale);
  const y = Math.floor(py / m.scale);
  return x >= 0 && y >= 0 && x < m.w && y < m.h && m.data[y * m.w + x] === 1;
};

// ---------------------------------------------------------------------------------------------
// Side analysis

export interface SideFit extends WrapShape {
  mask: Mask;
  /** Median body colour, #rrggbb. */
  paint: string;
  /** 0..1; below 0.6 the silhouette should not drive the 3D shape. */
  confidence: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');

export function analyzeSide(px: Pixels, view: WrapView, body: CarBody): SideFit {
  const spec = SPECS[body];
  const work = downsample(px);
  const f = sideFrame(view, body);
  const R = f.wheelR;
  const A = spec.axle;

  // Known-vehicle core: lower door band between the wheels, and the wheels themselves.
  const protect = protectRegion(
    work,
    f,
    (x, y) =>
      (Math.abs(x) < A * 0.85 && y > R * 1.25 && y < R * 1.25 + 0.28) ||
      Math.hypot(x - A, y - R) < R * 0.6 ||
      Math.hypot(x + A, y - R) < R * 0.6,
  );
  const mask: Mask = { w: work.w, h: work.h, scale: work.scale, data: segment(work, protect) };
  const isCar = (x: number, y: number) => {
    const [X, Y] = toPx(f, x, y);
    return maskAt(mask, X, Y);
  };
  const step = Math.max(0.01, f.mpp * work.scale * 0.5);

  // Overhangs: walk outward from each axle at bumper height until the vehicle ends.
  const bandYs = [0, 0.08, 0.16, 0.24].map((d) => R * 1.15 + d);
  const extent = (dir: 1 | -1) => {
    let last = A + R;
    let misses = 0;
    for (let d = A; d < A + R + 1.6; d += step) {
      if (bandYs.some((y) => isCar(dir * d, y))) {
        last = d;
        misses = 0;
      } else if (++misses > 4 && d > A + R) break;
    }
    return Math.min(A + R + 1.4, Math.max(A + R * 1.3, last + step));
  };
  const xFront = extent(1);
  const xRear = -extent(-1);

  // Roofline: first vehicle pixel from the top in each column.
  const N = 64;
  const tops: number[] = [];
  for (let i = 0; i < N; i++) {
    const x = xRear + ((xFront - xRear) * (i + 0.5)) / N;
    let top = NaN;
    for (let y = 2.6; y > 0.25; y -= step) {
      if (isCar(x, y)) {
        top = y;
        break;
      }
    }
    tops.push(top);
  }
  const valid = tops.filter((t) => Number.isFinite(t) && t > 0.45 && t < 2.5).length / N;
  // Fill gaps by linear interpolation, then smooth (median 5, mean 3).
  const filled = tops.map((t, i) => {
    if (Number.isFinite(t)) return t;
    let l = i - 1;
    let r = i + 1;
    while (l >= 0 && !Number.isFinite(tops[l])) l--;
    while (r < N && !Number.isFinite(tops[r])) r++;
    const lv = l >= 0 ? tops[l] : NaN;
    const rv = r < N ? tops[r] : NaN;
    if (Number.isFinite(lv) && Number.isFinite(rv)) return lv + ((rv - lv) * (i - l)) / (r - l);
    return Number.isFinite(lv) ? lv : Number.isFinite(rv) ? rv : R * 2;
  });
  const med = filled.map((_, i) => median(filled.slice(Math.max(0, i - 2), i + 3)));
  const smooth = med.map((_, i) => {
    const w = med.slice(Math.max(0, i - 1), i + 2);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const profile: Pt[] = smooth.map((t, i) => [xRear + ((xFront - xRear) * (i + 0.5)) / N, Math.max(t, R * 1.6)]);

  // Sill height between the wheels.
  const sills: number[] = [];
  for (const k of [-0.5, -0.25, 0, 0.25, 0.5]) {
    for (let y = 0.02; y < R * 1.8; y += step) {
      if (isCar(k * A, y)) {
        sills.push(y);
        break;
      }
    }
  }
  const clearance = Math.min(0.5, Math.max(0.1, median(sills) || spec.clearance));

  // Paint: median colour of the door panel.
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let x = -A * 0.6; x <= A * 0.6; x += 0.05) {
    for (let y = clearance + 0.12; y <= clearance + 0.45; y += 0.05) {
      if (!isCar(x, y)) continue;
      const [X, Y] = toPx(f, x, y);
      const i = (Math.round(Y) * px.width + Math.round(X)) * 4;
      if (i < 0 || i >= px.data.length) continue;
      rs.push(px.data[i]);
      gs.push(px.data[i + 1]);
      bs.push(px.data[i + 2]);
    }
  }
  const paint = rs.length ? hex(median(rs), median(gs), median(bs)) : '#9aa0a6';

  // Confidence: share of plausible columns, penalised by jaggedness and implausible height.
  let rough = 0;
  for (let i = 1; i < N - 1; i++) rough += Math.abs(smooth[i - 1] - 2 * smooth[i] + smooth[i + 1]);
  rough /= N - 2;
  const maxTop = Math.max(...smooth);
  const heightOk = maxTop > R * 3 && maxTop < 2.6 ? 1 : 0.4;
  const confidence = Math.max(0, Math.min(1, valid * heightOk * (1 - Math.min(1, rough / 0.08) * 0.5)));

  return { mask, profile, xRear, xFront, clearance, wheelR: R, paint, confidence };
}

export function analyzeEnd(px: Pixels, view: WrapView, body: CarBody, kind: 'front' | 'rear'): { mask: Mask } {
  const spec = SPECS[body];
  const work = downsample(px);
  const f = endFrame(view, body, kind);
  const protect = protectRegion(work, f, (z, y) => Math.abs(z) < spec.width * 0.28 && y > 0.4 && y < 0.85);
  return { mask: { w: work.w, h: work.h, scale: work.scale, data: segment(work, protect) } };
}

// ---------------------------------------------------------------------------------------------
// Texture

/**
 * RGBA texture at up to `maxW` wide. Alpha is the vehicle mask, eroded one mask pixel
 * (so background halos do not bleed onto the body) and bilinearly interpolated for soft edges.
 */
export function buildTexture(px: Pixels, mask: Mask, maxW = 1024): Pixels {
  const scale = Math.max(1, px.width / maxW);
  const width = Math.round(px.width / scale);
  const height = Math.round(px.height / scale);

  const { w, h } = mask;
  const eroded = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask.data[i]) continue;
      const edge =
        (x > 0 && !mask.data[i - 1]) ||
        (x < w - 1 && !mask.data[i + 1]) ||
        (y > 0 && !mask.data[i - w]) ||
        (y < h - 1 && !mask.data[i + w]);
      eroded[i] = edge ? 0 : 1;
    }
  }
  const alphaAt = (fx: number, fy: number) => {
    const x = Math.min(w - 1.001, Math.max(0, fx / mask.scale - 0.5));
    const y = Math.min(h - 1.001, Math.max(0, fy / mask.scale - 0.5));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const i = y0 * w + x0;
    const x1 = Math.min(w - 1, x0 + 1) - x0;
    const y1 = Math.min(h - 1, y0 + 1) - y0;
    const top = eroded[i] * (1 - tx) + eroded[i + x1] * tx;
    const bot = eroded[i + y1 * w] * (1 - tx) + eroded[i + y1 * w + x1] * tx;
    return top * (1 - ty) + bot * ty;
  };

  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(px.height - 1, Math.floor((y + 0.5) * scale));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(px.width - 1, Math.floor((x + 0.5) * scale));
      const s = (sy * px.width + sx) * 4;
      const o = (y * width + x) * 4;
      data[o] = px.data[s];
      data[o + 1] = px.data[s + 1];
      data[o + 2] = px.data[s + 2];
      data[o + 3] = Math.round(255 * alphaAt((x + 0.5) * scale, (y + 0.5) * scale));
    }
  }
  return { width, height, data };
}

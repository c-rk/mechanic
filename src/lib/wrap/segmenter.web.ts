import Constants from 'expo-constants';

import type { Mask, Pixels } from './analyze';

export type Stroke = [number, number][];

/**
 * Point-prompted segmentation in the browser with MediaPipe's Interactive Segmenter (Magic Touch
 * v2). The model and WebAssembly runtime are served with the app (public/models, public/mediapipe)
 * and run locally: the photo never leaves the device.
 */
export const modelSegmentationAvailable = true;

type Vision = typeof import('@mediapipe/tasks-vision');

/**
 * MediaPipe is loaded as a plain ES module from public/mediapipe at runtime rather than bundled:
 * its loader uses dynamic import() of computed URLs, which Metro cannot bundle. Only its types
 * are used at build time. `new Function` keeps the bundler from rewriting this import().
 */
const importAtRuntime = new Function('url', 'return import(url)') as (url: string) => Promise<Vision>;
type Segmenter = import('@mediapipe/tasks-vision').InteractiveSegmenter;

let loading: Promise<{ vision: Vision; seg: Segmenter }> | null = null;

const base = () => `${location.origin}${(Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '')}`;

function load() {
  if (!loading) {
    loading = (async () => {
      const vision = await importAtRuntime(`${base()}/mediapipe/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${base()}/mediapipe/wasm`);
      const create = (delegate: 'GPU' | 'CPU') =>
        vision.InteractiveSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: `${base()}/models/interactive_segmentation.task`, delegate },
        });
      const seg = await create('GPU').catch(() => create('CPU'));
      return { vision, seg };
    })();
    loading.catch(() => (loading = null));
  }
  return loading;
}

/** Strokes are in full-resolution pixel coordinates. Returns a 0/1 mask at most 640 px wide. */
export async function segmentWithModel(px: Pixels, positive: Stroke[], negative: Stroke[]): Promise<Mask | null> {
  try {
    const { vision, seg } = await load();
    const rgba = new Uint8ClampedArray(px.width * px.height * 4);
    rgba.set(px.data);
    const image = new ImageData(rgba, px.width, px.height);
    seg.setImage(image);
    const norm = (s: Stroke) => s.map(([x, y]) => ({ x: x / px.width, y: y / px.height }));
    const strokes = [
      ...positive.map((s) => ({ brushMode: vision.BrushMode?.POSITIVE ?? 1, point: norm(s), isCompleted: true })),
      ...negative.map((s) => ({ brushMode: vision.BrushMode?.NEGATIVE ?? 2, point: norm(s), isCompleted: true })),
    ];
    const out = seg.segment(strokes);
    const mw = out.width;
    const mh = out.height;
    const values: ArrayLike<number> = out.hasFloat32Array() ? out.getAsFloat32Array() : out.getAsUint8Array();
    const isFloat = out.hasFloat32Array();
    // Resample to at most 640 px wide.
    const w = Math.min(640, mw);
    const h = Math.round((mh * w) / mw);
    const data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const sy = Math.min(mh - 1, Math.floor(((y + 0.5) * mh) / h));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(mw - 1, Math.floor(((x + 0.5) * mw) / w));
        const v = values[sy * mw + sx];
        data[y * w + x] = (isFloat ? v > 0.5 : v > 127) ? 1 : 0;
      }
    }
    out.close();
    return { w, h, scale: px.width / w, data };
  } catch (e) {
    console.warn('Segmentation model unavailable, using the built-in cut-out', e);
    return null;
  }
}

/** Data URI of a translucent overlay that darkens everything outside the mask. */
export function maskOverlayUri(m: Mask): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = m.w;
  canvas.height = m.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(m.w, m.h);
  for (let i = 0; i < m.data.length; i++) {
    const o = i * 4;
    if (m.data[i]) continue;
    img.data[o] = 6;
    img.data[o + 1] = 7;
    img.data[o + 2] = 9;
    img.data[o + 3] = 170;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

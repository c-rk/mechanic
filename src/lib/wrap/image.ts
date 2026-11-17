import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
// The decoder alone: the package entry also loads the encoder, which needs Node's Buffer.
import decode from 'jpeg-js/lib/decoder';

import { readBytes } from '../files';
import type { Pixels } from './analyze';

export const MAX_PHOTO_WIDTH = 1280;

/** Re-encodes a picked photo as an upright JPEG at most 1280 px wide (EXIF rotation applied). */
export async function normalizePhoto(uri: string, width?: number): Promise<{ uri: string; width: number; height: number }> {
  const ctx = ImageManipulator.manipulate(uri);
  if (!width || width > MAX_PHOTO_WIDTH) ctx.resize({ width: MAX_PHOTO_WIDTH });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return { uri: out.uri, width: out.width, height: out.height };
}

export function decodeJpeg(bytes: Uint8Array): Pixels {
  const img = decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 256 });
  return { width: img.width, height: img.height, data: img.data as Uint8Array };
}

const cache = new Map<string, Promise<Pixels>>();

/** Decoded pixels of a stored photo, cached for the session. */
export function loadPixels(ref: string): Promise<Pixels> {
  let p = cache.get(ref);
  if (!p) {
    p = readBytes(ref).then(decodeJpeg);
    p.catch(() => cache.delete(ref));
    cache.set(ref, p);
  }
  return p;
}

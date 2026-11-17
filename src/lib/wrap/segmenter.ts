import type { Mask, Pixels } from './analyze';

export type Stroke = [number, number][];

/** iOS/Android: no on-device model yet; callers fall back to the built-in background flood fill. */
export async function segmentWithModel(_px: Pixels, _positive: Stroke[], _negative: Stroke[]): Promise<Mask | null> {
  return null;
}

export const modelSegmentationAvailable = false;

export function maskOverlayUri(_m: Mask): string | null {
  return null;
}

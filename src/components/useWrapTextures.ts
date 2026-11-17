import { useEffect, useState } from 'react';

import type { CarBody } from '../lib/bodySpecs';
import type { BodyType, Wrap, WrapView } from '../lib/types';
import { analyzeEnd, analyzeSide, buildTexture, endFrame, sideFrame, uvMatrix } from '../lib/wrap/analyze';
import { loadPixels } from '../lib/wrap/image';
import { photoTexture, type ProjectedPhoto, type WrapTextures } from './wrapMaterial';

type Kind = 'side' | 'front' | 'rear';
const cache = new Map<string, Promise<ProjectedPhoto>>();

function project(kind: Kind, view: WrapView, body: CarBody): Promise<ProjectedPhoto> {
  const key = JSON.stringify([kind, body, view]);
  let p = cache.get(key);
  if (!p) {
    p = loadPixels(view.ref).then((px) => {
      const mask = kind === 'side' ? analyzeSide(px, view, body).mask : analyzeEnd(px, view, body, kind).mask;
      const frame = kind === 'side' ? sideFrame(view, body) : endFrame(view, body, kind);
      return { texture: photoTexture(buildTexture(px, mask)), matrix: uvMatrix(frame, px.width, px.height) };
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/** Loads, segments and uploads the wrap photos. Undefined while loading or when there is no wrap. */
export function useWrapTextures(wrap: Wrap | undefined, body: BodyType) {
  const [state, setState] = useState<{ key: string; textures?: WrapTextures; error?: string }>({ key: '' });
  const key = wrap && body !== 'motorcycle' ? JSON.stringify([body, wrap.side, wrap.front, wrap.rear]) : '';

  useEffect(() => {
    if (!key || !wrap || body === 'motorcycle') return;
    let live = true;
    const kinds = (['side', 'front', 'rear'] as const).filter((k) => wrap[k]);
    Promise.all(kinds.map((k) => project(k, wrap[k]!, body)))
      .then((list) => {
        if (!live) return;
        const textures: WrapTextures = {};
        kinds.forEach((k, i) => (textures[k] = list[i]));
        setState({ key, textures });
      })
      .catch((e) => live && setState({ key, error: (e as Error).message }));
    return () => {
      live = false;
    };
    // `key` captures every input that changes the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key || state.key !== key) return { loading: Boolean(key) };
  return { loading: false, textures: state.textures, error: state.error };
}

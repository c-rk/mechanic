import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { dimsKey, type Dims } from '../lib/dimensions';
import { fileUrl } from '../lib/files';
import type { BodyType, Wrap } from '../lib/types';
import { buildVehicle, normaliseImported } from './carModel';
import { useWrapTextures } from './useWrapTextures';

export interface ModelSource {
  /** Real dimensions from the spec sheet. */
  dims?: Dims;
  bodyType: BodyType;
  color: string;
  modelRef?: string;
  wrap?: Wrap;
}

/**
 * The 3D object for a vehicle: an uploaded .glb when present, otherwise the procedural body,
 * fitted to and wrapped with the owner's photos when a photo wrap exists.
 */
export function useVehicleModel({ bodyType, color, modelRef, wrap, dims }: ModelSource) {
  const dk = dimsKey(dims);
  const [imported, setImported] = useState<{ ref: string; object: THREE.Group; length: number } | null>(null);
  const [failedRef, setFailedRef] = useState<string | null>(null);
  const photo = useWrapTextures(modelRef ? undefined : wrap, bodyType);

  useEffect(() => {
    let live = true;
    if (!modelRef) return;
    fileUrl(modelRef)
      .then((url) => new GLTFLoader().loadAsync(url))
      .then((gltf) => live && setImported({ ref: modelRef, ...normaliseImported(gltf.scene) }))
      .catch(() => live && setFailedRef(modelRef));
    return () => {
      live = false;
    };
  }, [modelRef]);

  const builtIn = useMemo(
    () => buildVehicle(bodyType, color, { dims: dk ? (JSON.parse(dk) as Dims) : undefined, ...(photo.textures ? { wrap: photo.textures, fit: wrap?.shape } : {}) }),
    [bodyType, color, photo.textures, wrap?.shape, dk],
  );

  return {
    model: modelRef && imported?.ref === modelRef ? imported : builtIn,
    loading: photo.loading,
    note: modelRef && failedRef === modelRef ? 'Model could not be loaded' : photo.error ? 'Photo wrap could not be loaded' : '',
  };
}

/** Soft elliptical contact shadow texture, generated once. */
let shadowTexture: THREE.DataTexture | undefined;
export function contactShadow() {
  if (shadowTexture) return shadowTexture;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n - 0.5;
      const dy = (y + 0.5) / n - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy * 2.1) * 2);
      data[(y * n + x) * 4 + 3] = Math.round(Math.pow(1 - r, 1.8) * 0.85 * 255);
    }
  }
  shadowTexture = new THREE.DataTexture(data, n, n);
  shadowTexture.magFilter = THREE.LinearFilter;
  shadowTexture.needsUpdate = true;
  return shadowTexture;
}

/** White radial falloff, used for pools of light on the floor. */
let glowTexture: THREE.DataTexture | undefined;
export function radialGlow() {
  if (glowTexture) return glowTexture;
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.min(1, Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2);
      const i = (y * n + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(Math.pow(1 - r, 2.2) * 255);
    }
  }
  glowTexture = new THREE.DataTexture(data, n, n);
  glowTexture.magFilter = THREE.LinearFilter;
  glowTexture.needsUpdate = true;
  return glowTexture;
}

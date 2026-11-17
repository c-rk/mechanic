import * as THREE from 'three';

import type { Pixels } from '../lib/wrap/analyze';

export interface ProjectedPhoto {
  texture: THREE.Texture;
  /** Row-major 3×3: (a, b, 1) in car-plane metres → texture UV. */
  matrix: number[];
}

/** Side photo is projected along z (a, b = x, y); front and rear along x (a, b = z, y). */
export interface WrapTextures {
  side?: ProjectedPhoto;
  front?: ProjectedPhoto;
  rear?: ProjectedPhoto;
}

export function photoTexture(px: Pixels): THREE.DataTexture {
  const t = new THREE.DataTexture(px.data, px.width, px.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

let blank: THREE.DataTexture | undefined;
const empty = () => {
  if (!blank) {
    blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    blank.needsUpdate = true;
  }
  return blank;
};

const DECLARATIONS = /* glsl */ `
uniform sampler2D uSide;
uniform sampler2D uFront;
uniform sampler2D uRear;
uniform mat3 uSideM;
uniform mat3 uFrontM;
uniform mat3 uRearM;
uniform vec3 uHas;
varying vec3 vCarPos;
varying vec3 vCarNormal;

vec4 projectPhoto(sampler2D tex, mat3 m, vec2 p) {
  vec2 uv = (m * vec3(p, 1.0)).xy;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture2D(tex, uv);
}
`;

/*
 * Weighted blend of the three projections by surface orientation. Where no photo covers a
 * surface (roof, background-masked pixels) the paint colour shows through.
 */
const MAP = /* glsl */ `
#include <map_fragment>
vec3 nCar = normalize(vCarNormal);
float wS = uHas.x * pow(abs(nCar.z), 2.5);
float wF = uHas.y * pow(max(nCar.x, 0.0), 2.5);
float wR = uHas.z * pow(max(-nCar.x, 0.0), 2.5);
float wTop = pow(max(nCar.y, 0.0), 2.5) + 0.02;
vec4 cS = projectPhoto(uSide, uSideM, vCarPos.xy);
vec4 cF = projectPhoto(uFront, uFrontM, vCarPos.zy);
vec4 cR = projectPhoto(uRear, uRearM, vCarPos.zy);
float aS = wS * cS.a;
float aF = wF * cF.a;
float aR = wR * cR.a;
float aSum = aS + aF + aR;
float photoA = clamp(aSum / (wS + wF + wR + wTop), 0.0, 1.0);
vec3 photoRGB = (cS.rgb * aS + cF.rgb * aF + cR.rgb * aR) / max(aSum, 1e-4);
diffuseColor.rgb = mix(diffuseColor.rgb, photoRGB, photoA);
`;

function patch(material: THREE.MeshStandardMaterial, uniforms: Record<string, THREE.IUniform>) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      'varying vec3 vCarPos;\nvarying vec3 vCarNormal;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCarPos = position;\nvCarNormal = normal;');
    shader.fragmentShader =
      DECLARATIONS +
      shader.fragmentShader
        .replace('#include <map_fragment>', MAP)
        // The photo already contains its lighting: treat photo areas as a dielectric so
        // metalness does not blacken them, and keep the clear coat for reflections.
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.42), photoA);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - 0.9 * photoA;');
  };
  material.customProgramCacheKey = () => 'bayone-photo-wrap';
  material.needsUpdate = true;
}

/** Patches every material in the (baked, car-space) model to show the projected photos. */
export function applyWrap(root: THREE.Object3D, wrap: WrapTextures) {
  const m = (p?: ProjectedPhoto) => {
    const mat = new THREE.Matrix3();
    if (p) mat.set(...(p.matrix as [number, number, number, number, number, number, number, number, number]));
    return mat;
  };
  const uniforms: Record<string, THREE.IUniform> = {
    uSide: { value: wrap.side?.texture ?? empty() },
    uFront: { value: wrap.front?.texture ?? empty() },
    uRear: { value: wrap.rear?.texture ?? empty() },
    uSideM: { value: m(wrap.side) },
    uFrontM: { value: m(wrap.front) },
    uRearM: { value: m(wrap.rear) },
    uHas: { value: new THREE.Vector3(wrap.side ? 1 : 0, wrap.front ? 1 : 0, wrap.rear ? 1 : 0) },
  };
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mat = o.material as THREE.MeshStandardMaterial;
    if (seen.has(mat) || !(mat instanceof THREE.MeshStandardMaterial)) return;
    seen.add(mat);
    patch(mat, uniforms);
  });
}

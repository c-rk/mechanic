import * as THREE from 'three';

/**
 * Smooth procedural car geometry.
 *
 * Bodies are lofted: a superellipse cross-section (rounded top, gently curved sides, flatter
 * bottom) is swept along the car's length, following a top profile, a bottom profile with wheel
 * arches and a plan-view width. Ends close with a rounded radius, and the indexed grid gets
 * smooth vertex normals, so there are no facets or flat extrusion faces.
 */

export type Fn = (x: number) => number;
type P = [number, number];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** y(x) through points via a Catmull-Rom spline, sampled densely and interpolated by x. */
export function profileFn(points: P[]): Fn {
  const curve = new THREE.SplineCurve(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const pts = curve.getSpacedPoints(400).sort((a, b) => a.x - b.x);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    let lo = 0;
    let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] > x) hi = mid;
      else lo = mid;
    }
    const t = (x - xs[lo]) / Math.max(1e-6, xs[hi] - xs[lo]);
    return ys[lo] + (ys[hi] - ys[lo]) * t;
  };
}

/** Body underside: ground clearance, lifted into a round arch over each wheel. */
export function archedBottom(clearance: number, wheelR: number, axles: number[], gap = 1.12): Fn {
  const ra = wheelR * gap;
  return (x) => {
    let y = clearance;
    for (const wx of axles) {
      const d = Math.abs(x - wx);
      if (d < ra) y = Math.max(y, wheelR + Math.sqrt(ra * ra - d * d));
    }
    return y;
  };
}

export interface LoftOptions {
  x0: number;
  x1: number;
  top: Fn;
  bottom: Fn;
  /** Half width at x. */
  half: Fn;
  /** Radius over which the ends round off. */
  endR: number;
  /** Superellipse exponents: higher = squarer. */
  sideN?: number;
  topN?: number;
  bottomN?: number;
  /** Narrow the section towards the top (tumblehome), as a fraction of the half width. */
  tuck?: number;
  nx?: number;
  ns?: number;
}

export function loft(o: LoftOptions): THREE.BufferGeometry {
  const { x0, x1, top, bottom, half, endR } = o;
  const sideN = o.sideN ?? 3.4;
  const topN = o.topN ?? 2.6;
  const bottomN = o.bottomN ?? 5;
  const tuck = o.tuck ?? 0;
  const nx = o.nx ?? 140;
  const ns = o.ns ?? 56;
  const pos: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= nx; i++) {
    // Cosine spacing puts more rings near the rounded ends.
    const u = 0.5 - 0.5 * Math.cos((Math.PI * i) / nx);
    const x = x0 + (x1 - x0) * u;
    const d = Math.max(0, Math.min(x - x0, x1 - x));
    const f = d >= endR ? 1 : Math.max(0.015, Math.sqrt(Math.max(0, 1 - (1 - d / endR) ** 2)));
    const t = top(x);
    const b = Math.min(bottom(x), t - 0.05);
    const yc = (t + b) / 2;
    const h = ((t - b) / 2) * f;
    const w = half(x) * f;
    for (let j = 0; j < ns; j++) {
      const th = (2 * Math.PI * j) / ns;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const yy = s >= 0 ? Math.pow(Math.abs(s), 2 / topN) : -Math.pow(Math.abs(s), 2 / bottomN);
      const narrow = 1 - tuck * smoothstep(0, 1, yy);
      pos.push(x, yc + h * yy, w * narrow * Math.sign(c) * Math.pow(Math.abs(c), 2 / sideN));
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ns; j++) {
      const a = i * ns + j;
      const b2 = i * ns + ((j + 1) % ns);
      const c2 = (i + 1) * ns + j;
      const d2 = (i + 1) * ns + ((j + 1) % ns);
      idx.push(a, c2, b2, b2, c2, d2);
    }
  }
  // Close both tips with a fan to their centre.
  const cap = (ring: number, flip: boolean) => {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let j = 0; j < ns; j++) {
      cx += pos[(ring * ns + j) * 3];
      cy += pos[(ring * ns + j) * 3 + 1];
      cz += pos[(ring * ns + j) * 3 + 2];
    }
    const centre = pos.length / 3;
    pos.push(cx / ns, cy / ns, cz / ns);
    for (let j = 0; j < ns; j++) {
      const a = ring * ns + j;
      const b2 = ring * ns + ((j + 1) % ns);
      if (flip) idx.push(centre, a, b2);
      else idx.push(centre, b2, a);
    }
  };
  cap(0, false);
  cap(nx, true);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Wheels

export interface WheelMaterials {
  tyre: THREE.Material;
  rim: THREE.Material;
  dark: THREE.Material;
  disc: THREE.Material;
}

/** Tyre with rounded shoulders, five-spoke alloy, brake disc and calliper. Axis along z. */
export function wheel(r: number, width: number, m: WheelMaterials): THREE.Group {
  const g = new THREE.Group();
  const rimR = r * 0.66;
  const hw = width / 2;
  // Tyre cross-section (radius, axial) swept around the axle with a lathe.
  // Points are (radius, axial offset): sidewall up from the rim, rounded shoulder, tread, shoulder, sidewall.
  const s = Math.min(hw * 0.55, (r - rimR) * 0.5);
  const sec: THREE.Vector2[] = [new THREE.Vector2(rimR, -hw * 0.8)];
  for (let i = 0; i <= 10; i++) {
    const th = -Math.PI / 2 + (Math.PI / 2) * (i / 10);
    sec.push(new THREE.Vector2(r - s + s * Math.cos(th), -hw + s + s * Math.sin(th)));
  }
  for (let i = 0; i <= 10; i++) {
    const th = (Math.PI / 2) * (i / 10);
    sec.push(new THREE.Vector2(r - s + s * Math.cos(th), hw - s + s * Math.sin(th)));
  }
  sec.push(new THREE.Vector2(rimR, hw * 0.8));
  const tyre = new THREE.Mesh(new THREE.LatheGeometry(sec, 72), m.tyre);
  tyre.rotation.x = Math.PI / 2;
  g.add(tyre);

  // Rim barrel and outer lip.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.8, 64, 1, true), m.dark);
  barrel.rotation.x = Math.PI / 2;
  g.add(barrel);
  for (const side of [1, -1]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, r * 0.03, 10, 64), m.rim);
    lip.position.z = side * width * 0.4;
    g.add(lip);

    // Spokes and hub on the outer face of each side (the model is seen from both).
    const face = new THREE.Group();
    face.position.z = side * width * 0.36;
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(rimR * 0.95, r * 0.13, r * 0.07), m.rim);
      spoke.position.x = rimR * 0.47;
      const arm = new THREE.Group();
      arm.rotation.z = (k / 5) * Math.PI * 2;
      arm.add(spoke);
      face.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.17, r * 0.19, r * 0.1, 32), m.rim);
    hub.rotation.x = Math.PI / 2;
    face.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.11, 24), m.dark);
    cap.rotation.x = Math.PI / 2;
    face.add(cap);
    g.add(face);
  }
  // Brake disc and calliper visible through the spokes.
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.82, rimR * 0.82, r * 0.06, 48), m.disc);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const calliper = new THREE.Mesh(new THREE.BoxGeometry(r * 0.22, r * 0.38, width * 0.3), m.dark);
  calliper.position.set(-rimR * 0.62, rimR * 0.2, 0);
  g.add(calliper);
  return g;
}

/** Rounded light lens: a flattened capsule embedded in the body surface. */
export function lamp(len: number, height: number, depth: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.CapsuleGeometry(height / 2, Math.max(0.001, len - height), 8, 24);
  geo.rotateX(Math.PI / 2);
  geo.scale(depth / height, 1, 1);
  return new THREE.Mesh(geo, mat);
}

/**
 * Places `obj` on the surface of `target`: a ray from `from` along `dir` finds the surface, and the
 * object sits there, sunk by `inset` along the ray, facing out along the surface normal.
 * Returns false when the ray misses.
 */
export function stick(obj: THREE.Object3D, target: THREE.Mesh, from: THREE.Vector3, dir: THREE.Vector3, inset = 0.01): boolean {
  target.updateMatrixWorld(true);
  const hit = new THREE.Raycaster(from, dir.clone().normalize()).intersectObject(target, false)[0];
  if (!hit?.face) return false;
  obj.position.copy(hit.point).addScaledVector(dir.clone().normalize(), inset);
  const n = hit.face.normal.clone().transformDirection(target.matrixWorld);
  // Lamps are built facing +x; turn them to face along the surface normal.
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), n);
  return true;
}

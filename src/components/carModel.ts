import * as THREE from 'three';

import { SPECS, type BodySpec, type CarBody, type P } from '../lib/bodySpecs';
import type { Dims } from '../lib/dimensions';
import type { BodyType, WrapShape } from '../lib/types';
import { archedBottom, lamp, loft, profileFn, stick, wheel } from './carGeometry';
import { applyWrap, type WrapTextures } from './wrapMaterial';

function materials(color: string) {
  return {
    paint: new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.55,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#06090d', metalness: 0.5, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
    tyre: new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.82 }),
    rim: new THREE.MeshStandardMaterial({ color: '#d5d9de', metalness: 1, roughness: 0.18 }),
    disc: new THREE.MeshStandardMaterial({ color: '#7d8187', metalness: 0.9, roughness: 0.38 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1a1d21', metalness: 0.4, roughness: 0.6 }),
    head: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 1.6 }),
    tail: new THREE.MeshStandardMaterial({ color: '#ff2a1c', emissive: '#ff1a10', emissiveIntensity: 1.2 }),
  };
}


function buildCar(spec: BodySpec, color: string, photo: boolean) {
  const m = materials(color);
  const car = new THREE.Group();
  const { width: W, wheelR: R, axle, clearance: c } = spec;
  const x0 = spec.top[0][0];
  const x1 = spec.top[spec.top.length - 1][0];
  const mid = (x0 + x1) / 2;
  const halfL = (x1 - x0) / 2;
  const top = profileFn(spec.top);

  // Lower body: hood, flanks, trunk, with wheel arches and a gently curved plan. Flat-ish sides
  // and a tight shoulder radius keep the character of a car rather than a pebble.
  const bodyMesh = new THREE.Mesh(
    loft({
      x0,
      x1,
      top,
      bottom: archedBottom(c, R, [axle, -axle]),
      half: (x) => (W / 2) * (1 - 0.035 * ((x - mid) / halfL) ** 4),
      endR: 0.15,
      sideN: 7,
      topN: 4.5,
      bottomN: 9,
      tuck: 0.04,
    }),
    m.paint,
  );
  car.add(bodyMesh);

  // Greenhouse glass, narrowing towards the roof.
  const cab = spec.cabin;
  const cx0 = cab[0][0];
  const cx1 = cab[cab.length - 1][0];
  const cabTop = profileFn(cab);
  const cabHalf = (W / 2) * 0.86;
  const tuck = 0.2;
  car.add(
    new THREE.Mesh(
      loft({ x0: cx0, x1: cx1, top: cabTop, bottom: (x) => top(x) - 0.08, half: () => cabHalf, endR: 0.05, sideN: 4, topN: 4, bottomN: 4, tuck, nx: 120 }),
      m.glass,
    ),
  );
  // Painted roof panel over the flat part of the greenhouse.
  const roofY = Math.max(...cab.map((p) => p[1]));
  let rx0 = cx1;
  let rx1 = cx0;
  for (let x = cx0; x <= cx1; x += 0.01) {
    if (cabTop(x) > roofY - 0.07) {
      rx0 = Math.min(rx0, x);
      rx1 = Math.max(rx1, x);
    }
  }
  if (rx1 > rx0 + 0.2) {
    car.add(
      new THREE.Mesh(
        loft({
          x0: rx0 - 0.05,
          x1: rx1 + 0.05,
          top: (x) => cabTop(x) + 0.008,
          bottom: (x) => cabTop(x) - 0.06,
          half: () => cabHalf * (1 - tuck) * 0.9,
          endR: 0.12,
          sideN: 6,
          topN: 3,
          bottomN: 3,
          nx: 60,
          ns: 40,
        }),
        m.paint,
      ),
    );
  }

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const w = wheel(R, R * 0.7, m);
      w.position.set(sx * axle, R, sz * (W / 2 - 0.13));
      car.add(w);
    }
  }
  // Lamps, grille and mirrors are drawn by the photo when one is wrapped on. Each is placed by
  // casting a ray onto the body so it sits flush on the surface.
  if (!photo) {
    const frontY = Math.min(top(x1 - 0.25) - 0.1, c + (top(x1 - 0.25) - c) * 0.72);
    const rearY = Math.min(top(x0 + 0.25) - 0.1, c + (top(x0 + 0.25) - c) * 0.75);
    for (const sz of [1, -1]) {
      const head = lamp(W * 0.2, 0.075, 0.04, m.head);
      if (stick(head, bodyMesh, new THREE.Vector3(x1 + 1, frontY, sz * W * 0.3), new THREE.Vector3(-1, 0, 0), 0.012)) car.add(head);
      const tail = lamp(W * 0.22, 0.07, 0.04, m.tail);
      if (stick(tail, bodyMesh, new THREE.Vector3(x0 - 1, rearY, sz * W * 0.3), new THREE.Vector3(1, 0, 0), 0.012)) car.add(tail);
      const mirror = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.09, 6, 16), m.paint);
      mirror.rotation.x = Math.PI / 2;
      mirror.position.set(cx1 - 0.14, top(cx1 - 0.14) + 0.05, sz * (W / 2 + 0.02));
      car.add(mirror);
    }
    const grille = lamp(W * 0.4, 0.12, 0.03, m.dark);
    if (stick(grille, bodyMesh, new THREE.Vector3(x1 + 1, c + (frontY - c) * 0.55, 0), new THREE.Vector3(-1, 0, 0), 0.01)) car.add(grille);
  }
  return car;
}

function buildMotorcycle(color: string) {
  const m = materials(color);
  const g = new THREE.Group();
  const R = 0.32;
  const bar = (from: THREE.Vector3, to: THREE.Vector3, r: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, from.distanceTo(to), 14), mat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    return mesh;
  };
  const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
  for (const x of [0.74, -0.7]) {
    const w = wheel(R, 0.13, m);
    w.position.set(x, R, 0);
    g.add(w);
  }
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.34, 8, 20), m.paint);
  tank.rotation.z = Math.PI / 2 - 0.12;
  tank.scale.set(1, 1, 1.25);
  tank.position.set(0.14, 0.86, 0);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.26), m.dark);
  seat.position.set(-0.4, 0.82, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.2), m.paint);
  tail.position.set(-0.72, 0.8, 0);
  tail.rotation.z = -0.2;
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.3), m.rim);
  engine.position.set(0.02, 0.48, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), m.head);
  lamp.position.set(0.66, 0.93, 0);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.12), m.tail);
  rear.position.set(-0.88, 0.78, 0);
  g.add(tank, seat, tail, engine, lamp, rear);
  for (const z of [0.08, -0.08]) g.add(bar(v(0.74, R, z), v(0.52, 1.02, z), 0.025, m.rim));
  g.add(bar(v(0.5, 1.05, -0.34), v(0.5, 1.05, 0.34), 0.016, m.dark));
  g.add(bar(v(-0.7, R, 0.09), v(-0.05, 0.42, 0.09), 0.025, m.dark));
  g.add(bar(v(-0.7, R, -0.09), v(-0.05, 0.42, -0.09), 0.025, m.dark));
  g.add(bar(v(0.5, 0.95, 0), v(0.1, 0.62, 0), 0.03, m.dark));
  g.add(bar(v(-0.6, 0.76, 0), v(-0.1, 0.62, 0), 0.03, m.dark));
  g.add(bar(v(-0.9, 0.42, 0.17), v(0.1, 0.34, 0.17), 0.045, m.rim));
  return g;
}

/**
 * Body lofted along the roofline fitted to the owner's side photo: smooth cross-sections that
 * narrow towards the roof, round off at nose and tail and arch over the wheels.
 */
function buildFitted(spec: BodySpec, fit: WrapShape, color: string) {
  const m = materials(color);
  const car = new THREE.Group();
  const W = spec.width;
  const R = fit.wheelR;
  const A = spec.axle;
  const mid = (fit.xFront + fit.xRear) / 2;
  const halfL = (fit.xFront - fit.xRear) / 2;

  // One smooth loft along the photo's silhouette; the section narrows towards the roof.
  const body = loft({
    x0: fit.xRear,
    x1: fit.xFront,
    top: profileFn(fit.profile),
    bottom: archedBottom(fit.clearance, R, [A, -A]),
    half: (x) => (W / 2) * (1 - 0.035 * ((x - mid) / halfL) ** 4),
    endR: 0.16,
    sideN: 6,
    topN: 4,
    bottomN: 9,
    tuck: 0.16,
  });
  car.add(new THREE.Mesh(body, m.paint));

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const w = wheel(R, R * 0.7, m);
      w.position.set(sx * A, R, sz * (W / 2 - 0.13));
      car.add(w);
    }
  }
  return car;
}

/** Moves every mesh's transform into its geometry so that local position equals car space. */
function bake(root: THREE.Group) {
  root.updateMatrixWorld(true);
  const out = new THREE.Group();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
    out.add(new THREE.Mesh(geo, o.material));
  });
  return out;
}

export interface VehicleOptions {
  /** Real dimensions from the spec sheet (metres); missing values keep the body-type defaults. */
  dims?: Dims;
  /** Body shape fitted to a side photo; ignored for motorcycles. */
  fit?: WrapShape;
  /** Photo textures projected onto the body. */
  wrap?: WrapTextures;
}

/** Procedural model for a body type, optionally fitted to and wrapped with the owner's photos. */
/**
 * Body-type template stretched to the vehicle's real dimensions. Length, height and width scale the
 * outline independently; wheelbase, wheel size and ground clearance are set directly, so wheels stay
 * round and sit in correctly placed arches.
 */
export function sizedSpec(spec: BodySpec, d: Dims = {}): BodySpec {
  const templateTop = Math.max(...spec.cabin.map((p) => p[1]), ...spec.top.map((p) => p[1]));
  const sx = d.length ? d.length / spec.length : d.wheelbase ? d.wheelbase / (2 * spec.axle) : 1;
  const sy = d.height ? d.height / templateTop : sx;
  const axle = d.wheelbase ? d.wheelbase / 2 : spec.axle * sx;
  const wheelR = d.wheelR ?? spec.wheelR * Math.min(sx, sy);
  const clearance = d.clearance ?? spec.clearance * sy;
  // Keep the outline clear of the arches when the wheels are larger than the template's.
  const lift = Math.max(0, wheelR * 2.25 + 0.04 - Math.min(...spec.top.map((p) => p[1])) * sy);
  const scale = (p: P): P => [p[0] * sx, p[1] * sy + lift * (1 - p[1] / templateTop)];
  return {
    length: spec.length * sx,
    width: d.width ?? spec.width,
    wheelR,
    axle: Math.min(axle, (spec.length * sx) / 2 - wheelR * 1.3),
    clearance,
    top: spec.top.map(scale),
    cabin: spec.cabin.map(scale),
  };
}

export function buildVehicle(bodyType: BodyType, color: string, opts: VehicleOptions = {}): { object: THREE.Group; length: number } {
  if (bodyType === 'motorcycle') {
    const object = buildMotorcycle(color);
    const k = opts.dims?.length ? opts.dims.length / 2.1 : 1;
    object.scale.setScalar(k);
    return { object, length: 2.1 * k };
  }
  const base = SPECS[bodyType as CarBody];
  const photo = Boolean(opts.wrap);
  if (opts.fit) {
    // The photo fixes proportions; the real wheelbase (or length) fixes the scale.
    let object = buildFitted(base, opts.fit, color);
    const fitLength = opts.fit.xFront - opts.fit.xRear;
    const k = opts.dims?.wheelbase ? opts.dims.wheelbase / (2 * base.axle) : opts.dims?.length ? opts.dims.length / fitLength : 1;
    const zk = opts.dims?.width ? opts.dims.width / (base.width * k) : 1;
    if (opts.wrap) {
      object = bake(object);
      applyWrap(object, opts.wrap);
    }
    // Projection works in the model's local space, so scaling the group keeps the photo aligned.
    object.scale.set(k, k, k * zk);
    return { object, length: fitLength * k };
  }
  const spec = sizedSpec(base, opts.dims);
  if (!opts.wrap) return { object: buildCar(spec, color, photo), length: spec.length };
  // The photo projection was measured against the template wheelbase; scale uniformly to match.
  const object = bake(buildCar(base, color, photo));
  applyWrap(object, opts.wrap);
  const k = spec.axle / base.axle;
  object.scale.set(k, k, spec.width / base.width);
  return { object, length: base.length * k };
}

/** Centres an imported model on the turntable, rests it on the floor and reports its length. */
export function normaliseImported(object: THREE.Object3D): { object: THREE.Group; length: number } {
  const wrapper = new THREE.Group();
  wrapper.add(object);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const longest = Math.max(size.x, size.z, 0.001);
  const scale = 4.5 / longest;
  object.position.set(-centre.x, -box.min.y, -centre.z);
  wrapper.scale.setScalar(scale);
  // Turn the model so its long axis lies along x, matching the built-in models.
  if (size.z > size.x) wrapper.rotation.y = Math.PI / 2;
  return { object: wrapper, length: 4.5 };
}

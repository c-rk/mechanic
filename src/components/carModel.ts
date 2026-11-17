import * as THREE from 'three';

import { SPECS, type BodySpec, type CarBody, type P } from '../lib/bodySpecs';
import type { Dims } from '../lib/dimensions';
import type { BodyType, WrapShape } from '../lib/types';
import { applyWrap, type WrapTextures } from './wrapMaterial';

function extrude(shape: THREE.Shape, width: number, bevel: number) {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 5,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function materials(color: string) {
  return {
    paint: new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.55,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#05080b', metalness: 0.6, roughness: 0.08, clearcoat: 1 }),
    tyre: new THREE.MeshStandardMaterial({ color: '#111315', roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 1, roughness: 0.22 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1a1d21', metalness: 0.4, roughness: 0.6 }),
    head: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4d6', emissiveIntensity: 1.6 }),
    tail: new THREE.MeshStandardMaterial({ color: '#ff2a1c', emissive: '#ff1a10', emissiveIntensity: 1.2 }),
  };
}

function wheel(r: number, w: number, m: ReturnType<typeof materials>) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 40), m.tyre);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, w + 0.02, 28), m.rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, w + 0.05, 16), m.dark);
  for (let i = 0; i < 5; i++) {
    const slot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.13, r * 0.13, w + 0.03, 12), m.dark);
    const a = (i / 5) * Math.PI * 2;
    slot.position.set(Math.cos(a) * r * 0.42, 0, Math.sin(a) * r * 0.42);
    g.add(slot);
  }
  g.add(tyre, rim, hub);
  g.rotation.x = Math.PI / 2;
  return g;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Rounds an extruded slab into a car-like volume: the nose and tail narrow in plan view and the
 * sides tuck in towards the top, so the silhouette no longer reads as a flat cut-out.
 */
function sculpt(geo: THREE.BufferGeometry, xMin: number, xMax: number, yLow: number, yTop: number, ends = 0.22, tuck = 0.08) {
  const mid = (xMin + xMax) / 2;
  const half = (xMax - xMin) / 2;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const plan = 1 - ends * Math.pow(smoothstep(0.55, 1, Math.abs(x - mid) / half), 1.6);
    const side = 1 - tuck * smoothstep(yLow, yTop, y);
    pos.setZ(i, pos.getZ(i) * plan * side);
  }
  pos.needsUpdate = true;
  return geo;
}

function buildCar(spec: BodySpec, color: string, photo: boolean) {
  const m = materials(color);
  const car = new THREE.Group();
  const { width: W, wheelR: R, axle, clearance: c } = spec;
  const arch = R * 1.18;

  const body = new THREE.Shape();
  const first = spec.top[0];
  const last = spec.top[spec.top.length - 1];
  body.moveTo(first[0] + 0.05, c);
  body.lineTo(first[0], first[1]);
  // A spline through the outline gives the rounded shoulders and nose of a real body shell.
  body.splineThru(spec.top.slice(1).map(([x, y]) => new THREE.Vector2(x, y)));
  body.lineTo(last[0] - 0.05, c);
  for (const wx of [axle, -axle]) {
    body.lineTo(wx + arch, c);
    body.lineTo(wx + arch, R);
    body.absarc(wx, R, arch, 0, Math.PI, false);
    body.lineTo(wx - arch, c);
  }
  body.closePath();
  const topY = Math.max(...spec.top.map((p) => p[1]));
  car.add(new THREE.Mesh(sculpt(extrude(body, W, 0.1), first[0], last[0], c + 0.2, topY), m.paint));

  const dome = new THREE.SplineCurve(spec.cabin.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(48);
  const cabin = new THREE.Shape(dome);
  cabin.closePath();
  const cx = spec.cabin.map((p) => p[0]);
  const cy = spec.cabin.map((p) => p[1]);
  // Greenhouse: stronger tumblehome than the body.
  const glass = (g: THREE.BufferGeometry) => sculpt(g, Math.min(...cx), Math.max(...cx), Math.min(...cy), Math.max(...cy), 0.12, 0.2);
  car.add(new THREE.Mesh(glass(extrude(cabin, W * 0.84, 0.06)), m.glass));

  // Painted roof skin: the top of the dome between the screen headers, as a thin band over the glass.
  const roofTop = dome.filter((pt) => pt.x >= spec.cabin[1][0] && pt.x <= spec.cabin[2][0]);
  const roof = new THREE.Shape([
    ...roofTop.map((pt) => new THREE.Vector2(pt.x, pt.y + 0.015)),
    ...roofTop.map((pt) => new THREE.Vector2(pt.x, pt.y - 0.05)).reverse(),
  ]);
  car.add(new THREE.Mesh(glass(extrude(roof, W * 0.87, 0.03)), m.paint));

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const w = wheel(R, 0.24, m);
      w.position.set(sx * axle, R, sz * (W / 2 - 0.13));
      car.add(w);
      // Lamps and grille are drawn by the photo when one is wrapped on.
      if (photo) continue;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, W * 0.15), sx > 0 ? m.head : m.tail);
      const end = sx > 0 ? last : first;
      // Inside the rounded nose/tail so the lamp sits flush instead of floating.
      lamp.position.set(end[0] - sx * 0.045, end[1] + 0.05, sz * W * 0.26);
      car.add(lamp);
    }
  }
  if (!photo) {
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, W * 0.42), m.dark);
    grille.position.set(last[0] + 0.01, last[1] - 0.05, 0);
    car.add(grille);
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
 * Body extruded from the roofline fitted to the user's side photo. The single extrusion is then
 * shaped in plan and section: the greenhouse narrows above the beltline (tumblehome) and the
 * nose and tail round off, so the photo-textured slab reads as a car body rather than a cut-out.
 */
function buildFitted(spec: BodySpec, fit: WrapShape, color: string) {
  const m = materials(color);
  const car = new THREE.Group();
  const W = spec.width;
  const R = fit.wheelR;
  const A = spec.axle;
  const c = fit.clearance;
  const arch = R * 1.15;

  // Outline with rounded bumper corners; the photo's own silhouette supplies the rest.
  const r = 0.16;
  const pts = fit.profile.filter(([x]) => x > fit.xRear + r && x < fit.xFront - r);
  const yRear = pts[0]?.[1] ?? c + 0.6;
  const yFront = pts[pts.length - 1]?.[1] ?? c + 0.6;
  const shape = new THREE.Shape();
  shape.moveTo(fit.xRear + r, c);
  shape.quadraticCurveTo(fit.xRear, c, fit.xRear, c + r);
  shape.lineTo(fit.xRear, Math.max(c + r, yRear - r));
  shape.quadraticCurveTo(fit.xRear, yRear, fit.xRear + r, yRear);
  for (const [x, y] of pts) shape.lineTo(x, y);
  shape.lineTo(fit.xFront - r, yFront);
  shape.quadraticCurveTo(fit.xFront, yFront, fit.xFront, Math.max(c + r, yFront - r));
  shape.lineTo(fit.xFront, c + r);
  shape.quadraticCurveTo(fit.xFront, c, fit.xFront - r, c);
  for (const wx of [A, -A]) {
    shape.lineTo(wx + arch, c);
    shape.lineTo(wx + arch, R);
    shape.absarc(wx, R, arch, 0, Math.PI, false);
    shape.lineTo(wx - arch, c);
  }
  shape.closePath();
  const geo = extrude(shape, W, 0.09);

  const top = Math.max(...fit.profile.map((p) => p[1]));
  const belt = c + (top - c) * 0.56;
  const mid = (fit.xFront + fit.xRear) / 2;
  const half = (fit.xFront - fit.xRear) / 2;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const tumble = 1 - 0.16 * smoothstep(belt, top, y);
    // Round the nose and tail in plan view.
    const ends = 1 - 0.24 * Math.pow(smoothstep(0.55, 1, Math.abs(x - mid) / half), 1.6);
    pos.setZ(i, pos.getZ(i) * tumble * ends);
  }
  pos.needsUpdate = true;
  car.add(new THREE.Mesh(geo, m.paint));

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const w = wheel(R, 0.24, m);
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

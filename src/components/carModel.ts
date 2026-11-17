import * as THREE from 'three';

import type { BodyType } from '../lib/types';

type P = [number, number];

interface Spec {
  length: number;
  width: number;
  wheelR: number;
  axle: number;
  clearance: number;
  /** Upper outline of the lower body, rear bumper to front bumper (x forward, y up, metres). */
  top: P[];
  /** Greenhouse outline, rear base to front base. */
  cabin: P[];
}

const SPECS: Record<Exclude<BodyType, 'motorcycle'>, Spec> = {
  sedan: {
    length: 4.6, width: 1.8, wheelR: 0.33, axle: 1.36, clearance: 0.2,
    top: [[-2.3, 0.56], [-2.24, 0.9], [-1.35, 0.97], [0.9, 0.94], [2.0, 0.78], [2.3, 0.56]],
    cabin: [[-1.55, 0.95], [-0.85, 1.4], [0.2, 1.43], [1.0, 0.93]],
  },
  coupe: {
    length: 4.4, width: 1.82, wheelR: 0.34, axle: 1.3, clearance: 0.16,
    top: [[-2.2, 0.52], [-2.14, 0.86], [-1.3, 0.9], [0.75, 0.88], [1.95, 0.7], [2.2, 0.5]],
    cabin: [[-1.6, 0.88], [-0.5, 1.26], [0.15, 1.27], [0.9, 0.86]],
  },
  hatchback: {
    length: 4.1, width: 1.76, wheelR: 0.32, axle: 1.28, clearance: 0.19,
    top: [[-2.05, 0.56], [-2.02, 0.95], [0.75, 0.93], [1.75, 0.78], [2.05, 0.56]],
    cabin: [[-2.0, 0.94], [-1.62, 1.44], [0.1, 1.47], [0.9, 0.92]],
  },
  suv: {
    length: 4.7, width: 1.9, wheelR: 0.38, axle: 1.42, clearance: 0.28,
    top: [[-2.35, 0.68], [-2.32, 1.1], [0.95, 1.08], [2.1, 0.97], [2.35, 0.7]],
    cabin: [[-2.28, 1.09], [-2.0, 1.7], [0.2, 1.73], [1.05, 1.07]],
  },
  pickup: {
    length: 5.4, width: 1.95, wheelR: 0.4, axle: 1.75, clearance: 0.3,
    top: [[-2.7, 0.72], [-2.7, 1.16], [-0.55, 1.16], [1.2, 1.1], [2.45, 1.0], [2.7, 0.74]],
    cabin: [[-0.55, 1.15], [-0.45, 1.78], [0.6, 1.8], [1.28, 1.09]],
  },
  van: {
    length: 5.0, width: 1.95, wheelR: 0.36, axle: 1.6, clearance: 0.24,
    top: [[-2.5, 0.6], [-2.5, 1.1], [1.6, 1.05], [2.35, 0.9], [2.5, 0.6]],
    cabin: [[-2.48, 1.09], [-2.42, 1.93], [1.2, 1.95], [1.95, 1.04]],
  },
};

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

function buildCar(spec: Spec, color: string) {
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
  car.add(new THREE.Mesh(extrude(body, W, 0.1), m.paint));

  const dome = new THREE.SplineCurve(spec.cabin.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(48);
  const cabin = new THREE.Shape(dome);
  cabin.closePath();
  car.add(new THREE.Mesh(extrude(cabin, W * 0.84, 0.06), m.glass));

  // Painted roof skin: the top of the dome between the screen headers, as a thin band over the glass.
  const roofTop = dome.filter((pt) => pt.x >= spec.cabin[1][0] && pt.x <= spec.cabin[2][0]);
  const roof = new THREE.Shape([
    ...roofTop.map((pt) => new THREE.Vector2(pt.x, pt.y + 0.015)),
    ...roofTop.map((pt) => new THREE.Vector2(pt.x, pt.y - 0.05)).reverse(),
  ]);
  car.add(new THREE.Mesh(extrude(roof, W * 0.87, 0.03), m.paint));

  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const w = wheel(R, 0.24, m);
      w.position.set(sx * axle, R, sz * (W / 2 - 0.13));
      car.add(w);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, W * 0.2), sx > 0 ? m.head : m.tail);
      const end = sx > 0 ? last : first;
      lamp.position.set(end[0] - sx * 0.02, end[1] + 0.06, sz * W * 0.33);
      car.add(lamp);
    }
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, W * 0.42), m.dark);
  grille.position.set(last[0] + 0.01, last[1] - 0.05, 0);
  car.add(grille);
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

/** Procedural stand-in model for a body type. Returns the group and its overall length. */
export function buildVehicle(bodyType: BodyType, color: string): { object: THREE.Group; length: number } {
  if (bodyType === 'motorcycle') return { object: buildMotorcycle(color), length: 2.1 };
  const spec = SPECS[bodyType];
  return { object: buildCar(spec, color), length: spec.length };
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

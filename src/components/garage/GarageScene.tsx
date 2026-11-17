import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { vehicleDims } from '../../lib/dimensions';
import type { Vehicle } from '../../lib/types';
import { contactShadow, radialGlow, useVehicleModel, type ModelSource } from '../useVehicleModel';
import { bayNumber, corrugated } from './textures';

/** Distance between parking bays along x, metres. */
export const BAY = 5.2;
/** Cars park nose-out at a three-quarter angle to the camera. */
const YAW = -1.78;
const BG = '#0a0b0e';
/** Soft blue wall glow (the UI accent), neutral overhead light, white floor paint. */
const ACCENT = '#7ea6ff';
const LAMP = '#ffffff';
const PAINT = '#d5dbe4';

export interface GarageCamera {
  /** Bay the camera settles on. */
  index: number;
  /** Live finger offset in bays while swiping (positive = towards the next bay). */
  drag: number;
  /** Fraction of the screen height covered by UI at the bottom; the scene is framed above it. */
  bottomInset: number;
  /** Metres of garage to fit across the screen for each bay (larger vehicles need more). */
  fits?: number[];
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    let texture: THREE.Texture | undefined;
    try {
      const pmrem = new THREE.PMREMGenerator(gl);
      texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      // eslint-disable-next-line react-hooks/immutability -- three.js scene objects are mutable by design
      scene.environment = texture;
      pmrem.dispose();
    } catch {
      // Some mobile GL drivers cannot build the reflection map; direct lights still apply.
    }
    return () => {
      scene.environment = null;
      texture?.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Camera dolly between bays with exponential easing; framed to fit a car above the info sheet. */
function Rig({ cam }: { cam: React.RefObject<GarageCamera> }) {
  const { camera, size } = useThree();
  const x = useRef<number | null>(null);
  const fit = useRef(5.4);
  const dir = new THREE.Vector3(0.42, 0.25, 0.9).normalize();

  /* eslint-disable react-hooks/immutability -- the camera is driven imperatively every frame */
  useFrame((_, dt) => {
    const c = cam.current;
    if (!c) return;
    const p = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const fov = aspect < 1 ? 40 : 30;
    if (p.fov !== fov || p.view?.offsetY !== size.height * c.bottomInset * 0.5) {
      p.fov = fov;
      // Shift the projection so the car sits in the visible area above the bottom sheet.
      p.setViewOffset(size.width, size.height, 0, size.height * c.bottomInset * 0.5, size.width, size.height);
      p.updateProjectionMatrix();
    }
    const target = (c.index + c.drag) * BAY;
    if (x.current === null) x.current = target;
    x.current += (target - x.current) * (1 - Math.exp(-dt * 9));
    // Distance that fits the selected vehicle across the screen, whatever the aspect ratio.
    const wanted = c.fits?.[Math.round(c.index + c.drag)] ?? 5.4;
    fit.current += (wanted - fit.current) * (1 - Math.exp(-dt * 5));
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
    const dist = Math.max(7.5, fit.current / 2 / Math.tan(hfov / 2));
    p.position.set(x.current + dir.x * dist, dir.y * dist, dir.z * dist);
    p.lookAt(x.current, 0.55 * (fit.current / 5.4), 0);
  });
  /* eslint-enable react-hooks/immutability */
  return null;
}

function Car({ source }: { source: ModelSource }) {
  const { model } = useVehicleModel(source);
  return (
    <group rotation={[0, YAW, 0]}>
      <primitive object={model.object} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[model.length * 1.25, model.length * 1.25, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={contactShadow()} transparent depthWrite={false} color="#000" />
      </mesh>
    </group>
  );
}

/** One parking bay: painted lines, a pool of light that brightens when the bay is selected, the car. */
function Bay({ x, i, source, cam }: { x: number; i: number; source?: ModelSource; cam: React.RefObject<GarageCamera> }) {
  const pool = useRef<THREE.MeshBasicMaterial>(null);
  const strip = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    const c = cam.current;
    if (!c) return;
    const near = Math.max(0, 1 - Math.abs(c.index + c.drag - i));
    const k = 1 - Math.exp(-dt * 6);
    if (pool.current) pool.current.opacity += (0.02 + near * 0.12 - pool.current.opacity) * k;
    if (strip.current) strip.current.opacity += (0.03 + near * 0.22 - strip.current.opacity) * k;
  });

  const lineMat = <meshBasicMaterial color={PAINT} transparent opacity={0.22} depthWrite={false} />;
  return (
    <group position={[x, 0, 0]}>
      {/* Painted bay markings, a stop line at the back and the bay number up front. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-BAY / 2, 0.003, 0.4]}>
        <planeGeometry args={[0.09, 7.2]} />
        {lineMat}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[BAY / 2, 0.003, 0.4]}>
        <planeGeometry args={[0.09, 7.2]} />
        {lineMat}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -3.25]}>
        <planeGeometry args={[BAY * 0.8, 0.06]} />
        {lineMat}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[BAY * 0.22, 0.003, 3.3]}>
        <planeGeometry args={[1.7, 1.13]} />
        <meshBasicMaterial map={bayNumber(i + 1)} color={PAINT} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {/* Overhead light falling on the floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[6.2, 6.2]} />
        <meshBasicMaterial ref={pool} map={radialGlow()} color={LAMP} transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Soft accent wash on the back wall behind the selected car. */}
      <mesh position={[0, 1.4, -4.39]}>
        <planeGeometry args={[BAY * 1.3, 4.2]} />
        <meshBasicMaterial ref={strip} map={radialGlow()} color={ACCENT} transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {source ? <Car source={source} /> : null}
    </group>
  );
}

/** The wall texture needs its own instance to set its own repeat. */
function wall(len: number) {
  const t = corrugated().clone();
  t.repeat.set(len / 0.22, 1);
  t.needsUpdate = true;
  return t;
}

export function GarageScene({ vehicles, cam }: { vehicles: Vehicle[]; cam: React.RefObject<GarageCamera> }) {
  // An empty garage still shows one bay with a placeholder car.
  const bays: (ModelSource | undefined)[] = vehicles.length
    ? vehicles.map((v) => ({ bodyType: v.bodyType, color: v.color, modelRef: v.modelRef, wrap: v.wrap, dims: vehicleDims(v) }))
    : [{ bodyType: 'coupe', color: '#3b4048' }];
  const extent = Math.max(bays.length, 3) * BAY;
  const wallTex = useMemo(() => wall(extent + 60), [extent]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas camera={{ fov: 40, near: 0.1, far: 120 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 11, 30]} />
        <Environment />
        <Rig cam={cam} />
        <hemisphereLight args={['#e8eeff', '#0d0e11', 0.35]} />
        <directionalLight position={[4, 9, 6]} intensity={2.0} color="#ffffff" />
        <directionalLight position={[-6, 4, -3]} intensity={0.55} color="#9fb3c8" />
        {/* Polished concrete floor and back wall. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[extent / 2 - BAY, 0, 0]}>
          <planeGeometry args={[extent + 60, 60]} />
          <meshStandardMaterial color="#07080a" metalness={0.15} roughness={0.7} envMapIntensity={0.06} />
        </mesh>
        <mesh position={[extent / 2 - BAY, 3, -4.4]}>
          <planeGeometry args={[extent + 60, 6]} />
          <meshStandardMaterial map={wallTex} color="#9aa0a8" roughness={0.8} metalness={0.3} envMapIntensity={0.15} />
        </mesh>
        {bays.map((b, i) => (
          <Bay key={vehicles[i]?.id ?? 'empty'} x={i * BAY} i={i} source={b} cam={cam} />
        ))}
      </Canvas>
    </View>
  );
}

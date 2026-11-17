import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import type { Vehicle } from '../../lib/types';
import { contactShadow, radialGlow, useVehicleModel, type ModelSource } from '../useVehicleModel';

/** Distance between parking bays along x, metres. */
export const BAY = 5.2;
/** Cars park nose-out at a three-quarter angle to the camera. */
const YAW = -1.78;
const BG = '#08090b';
const ACCENT = '#7b93ff';

export interface GarageCamera {
  /** Bay the camera settles on. */
  index: number;
  /** Live finger offset in bays while swiping (positive = towards the next bay). */
  drag: number;
  /** Fraction of the screen height covered by UI at the bottom; the scene is framed above it. */
  bottomInset: number;
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
    // Distance that fits about 5.4 m of garage across the screen, whatever the aspect ratio.
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
    const dist = Math.max(7.5, 2.7 / Math.tan(hfov / 2));
    p.position.set(x.current + dir.x * dist, dir.y * dist, dir.z * dist);
    p.lookAt(x.current, 0.55, 0);
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
    if (pool.current) pool.current.opacity += (0.04 + near * 0.2 - pool.current.opacity) * k;
    if (strip.current) strip.current.opacity += (0.03 + near * 0.22 - strip.current.opacity) * k;
  });

  const lineMat = <meshBasicMaterial color="#c9ced6" transparent opacity={0.12} depthWrite={false} />;
  return (
    <group position={[x, 0, 0]}>
      {/* Bay side lines and the front stop line. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-BAY / 2, 0.003, 0.4]}>
        <planeGeometry args={[0.05, 7.2]} />
        {lineMat}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[BAY / 2, 0.003, 0.4]}>
        <planeGeometry args={[0.05, 7.2]} />
        {lineMat}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, -3.2]}>
        <planeGeometry args={[BAY, 0.07]} />
        {lineMat}
      </mesh>
      {/* Overhead light falling on the floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[7.5, 7.5]} />
        <meshBasicMaterial ref={pool} map={radialGlow()} transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
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

export function GarageScene({ vehicles, cam }: { vehicles: Vehicle[]; cam: React.RefObject<GarageCamera> }) {
  // An empty garage still shows one bay with a placeholder car.
  const bays: (ModelSource | undefined)[] = vehicles.length
    ? vehicles.map((v) => ({ bodyType: v.bodyType, color: v.color, modelRef: v.modelRef, wrap: v.wrap }))
    : [{ bodyType: 'coupe', color: '#3b4048' }];
  const extent = Math.max(bays.length, 3) * BAY;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas camera={{ fov: 40, near: 0.1, far: 120 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 11, 30]} />
        <Environment />
        <Rig cam={cam} />
        <hemisphereLight args={['#dfe6ff', '#0d0e11', 0.35]} />
        <directionalLight position={[4, 9, 6]} intensity={2.0} />
        <directionalLight position={[-6, 4, -3]} intensity={0.6} color="#b8c6ff" />
        {/* Polished concrete floor and back wall. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[extent / 2 - BAY, 0, 0]}>
          <planeGeometry args={[extent + 60, 60]} />
          <meshStandardMaterial color="#0c0d10" metalness={0.2} roughness={0.55} envMapIntensity={0.12} />
        </mesh>
        <mesh position={[extent / 2 - BAY, 3, -4.4]}>
          <planeGeometry args={[extent + 60, 6]} />
          <meshStandardMaterial color="#0a0b0d" roughness={0.95} envMapIntensity={0.1} />
        </mesh>
        {bays.map((b, i) => (
          <Bay key={vehicles[i]?.id ?? 'empty'} x={i * BAY} i={i} source={b} cam={cam} />
        ))}
      </Canvas>
    </View>
  );
}

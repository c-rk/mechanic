import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { fileUrl } from '../lib/files';
import { C, F } from '../lib/theme';
import type { BodyType, Wrap } from '../lib/types';
import { buildVehicle, normaliseImported } from './carModel';
import { useWrapTextures } from './useWrapTextures';

interface Props {
  bodyType: BodyType;
  color: string;
  modelRef?: string;
  wrap?: Wrap;
  height?: number;
  /** Start angle in radians; the turntable eases into a slow spin from there. */
  initialYaw?: number;
  /** Disable the idle spin (e.g. while comparing against a photo). */
  still?: boolean;
}

interface Spin {
  yaw: number;
  velocity: number;
  dragging: boolean;
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    let texture: THREE.Texture | undefined;
    try {
      const pmrem = new THREE.PMREMGenerator(gl);
      texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      // three.js scene objects are mutable by design.
      // eslint-disable-next-line react-hooks/immutability
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

const BACKDROP = '#0e1013';

/** Soft elliptical contact shadow, generated once. */
let shadowTexture: THREE.DataTexture | undefined;
function contactShadow() {
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

function Stage({ model, length, spin, still }: { model: THREE.Object3D; length: number; spin: React.RefObject<Spin>; still?: boolean }) {
  const turntable = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  useEffect(() => {
    // Narrow viewports need more distance to keep the whole car in frame.
    const d = Math.max(length, 2.4) * 1.5 * Math.max(1, 1.9 / (size.width / Math.max(1, size.height)));
    camera.position.set(d * 0.8, d * 0.26, d * 0.6);
    camera.lookAt(0, Math.min(0.7, length * 0.15), 0);
  }, [camera, length, size.width, size.height]);

  /* eslint-disable react-hooks/immutability -- per-frame animation state lives in a ref */
  useFrame((_, dt) => {
    const s = spin.current;
    if (!s || !turntable.current) return;
    if (!s.dragging) {
      // Ease back to a slow showroom rotation after a drag.
      s.velocity += ((still ? 0 : 0.16) - s.velocity) * Math.min(1, dt * 1.6);
      s.yaw += s.velocity * dt;
    }
    turntable.current.rotation.y = s.yaw;
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <hemisphereLight args={['#dfe6ff', '#1a1c20', 0.55]} />
      <directionalLight position={[3, 8, 5]} intensity={2.1} />
      <directionalLight position={[-6, 3, -4]} intensity={0.8} color="#b8c6ff" />
      <group ref={turntable}>
        <primitive object={model} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={[length * 1.25, length * 1.25, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={contactShadow()} transparent depthWrite={false} color="#000" />
        </mesh>
      </group>
      {/* Dark studio floor that fades into the backdrop through the fog. */}
      <color attach="background" args={[BACKDROP]} />
      <fog attach="fog" args={[BACKDROP, length * 2.2, length * 5.5]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <circleGeometry args={[length * 8, 64]} />
        <meshStandardMaterial color="#15171b" metalness={0.2} roughness={0.55} />
      </mesh>
    </>
  );
}

export function Viewer3D({ bodyType, color, modelRef, wrap, height = 280, initialYaw = -0.65, still }: Props) {
  const spin = useRef<Spin>({ yaw: initialYaw, velocity: 0, dragging: false });
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
    () => buildVehicle(bodyType, color, photo.textures ? { wrap: photo.textures, fit: wrap?.shape } : {}),
    [bodyType, color, photo.textures, wrap?.shape],
  );
  const shown = modelRef && imported?.ref === modelRef ? imported : builtIn;

  // The ref is read only inside gesture callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const drag = { start: 0, lastDx: 0 };
    const state = () => spin.current;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        drag.start = state().yaw;
        drag.lastDx = 0;
        state().dragging = true;
      },
      onPanResponderMove: (_, g) => {
        state().yaw = drag.start + g.dx * 0.01;
        state().velocity = (g.dx - drag.lastDx) * 0.6;
        drag.lastDx = g.dx;
      },
      onPanResponderRelease: () => {
        state().dragging = false;
      },
      onPanResponderTerminate: () => {
        state().dragging = false;
      },
    });
  });

  const note =
    modelRef && failedRef === modelRef ? 'Model could not be loaded' : photo.error ? 'Photo wrap could not be loaded' : '';

  return (
    <View style={[styles.wrap, { height }]} {...pan.panHandlers}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas camera={{ fov: 30, near: 0.1, far: 100 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <Environment />
          <Stage model={shown.object} length={shown.length} spin={spin} still={still} />
        </Canvas>
      </View>
      {photo.loading ? <ActivityIndicator color={C.dim} style={styles.spinner} /> : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', backgroundColor: '#0e1013' },
  spinner: { position: 'absolute', top: 12, right: 12 },
  note: { position: 'absolute', bottom: 10, left: 14, color: C.faint, fontFamily: F.medium, fontSize: 11 },
});

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { fileUrl } from '../lib/files';
import { C, F } from '../lib/theme';
import type { BodyType } from '../lib/types';
import { buildVehicle, normaliseImported } from './carModel';

interface Props {
  bodyType: BodyType;
  color: string;
  modelRef?: string;
  height?: number;
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

function Stage({ model, length, spin }: { model: THREE.Object3D; length: number; spin: React.RefObject<Spin> }) {
  const turntable = useRef<THREE.Group>(null);
  const { camera, size } = useThree();

  useEffect(() => {
    // Narrow viewports need more distance to keep the whole turntable in frame.
    const d = Math.max(length, 2.4) * 1.6 * Math.max(1, 1.9 / (size.width / Math.max(1, size.height)));
    camera.position.set(d * 0.78, d * 0.3, d * 0.62);
    camera.lookAt(0, Math.min(0.75, length * 0.16), 0);
  }, [camera, length, size.width, size.height]);

  /* eslint-disable react-hooks/immutability -- per-frame animation state lives in a ref */
  useFrame((_, dt) => {
    const s = spin.current;
    if (!s || !turntable.current) return;
    if (!s.dragging) {
      // Ease back to a slow showroom rotation after a drag.
      s.velocity += (0.22 - s.velocity) * Math.min(1, dt * 1.5);
      s.yaw += s.velocity * dt;
    }
    turntable.current.rotation.y = s.yaw;
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 7, 5]} intensity={2.2} />
      <directionalLight position={[-6, 3, -4]} intensity={0.9} color="#9cc4ff" />
      <group ref={turntable}>
        <primitive object={model} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]}>
          <circleGeometry args={[length * 0.72, 72]} />
          <meshStandardMaterial color="#1b2027" metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]}>
          <ringGeometry args={[length * 0.72, length * 0.735, 72]} />
          <meshBasicMaterial color={C.blue} />
        </mesh>
        {Array.from({ length: 36 }, (_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 2, 0, -(i / 36) * Math.PI * 2]}
            position={[Math.cos((i / 36) * Math.PI * 2) * length * 0.67, -0.006, Math.sin((i / 36) * Math.PI * 2) * length * 0.67]}>
            <planeGeometry args={[i % 3 === 0 ? 0.14 : 0.07, 0.015]} />
            <meshBasicMaterial color="#5d6a7a" />
          </mesh>
        ))}
      </group>
    </>
  );
}

export function Viewer3D({ bodyType, color, modelRef, height = 280 }: Props) {
  const spin = useRef<Spin>({ yaw: -0.6, velocity: 0.22, dragging: false });
  const [imported, setImported] = useState<{ ref: string; object: THREE.Group; length: number } | null>(null);
  const [failedRef, setFailedRef] = useState<string | null>(null);

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

  const builtIn = useMemo(() => buildVehicle(bodyType, color), [bodyType, color]);
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

  return (
    <View style={[styles.wrap, { height }]} {...pan.panHandlers}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas camera={{ fov: 32, near: 0.1, far: 100 }} dpr={[1, 2]}>
          <Environment />
          <Stage model={shown.object} length={shown.length} spin={spin} />
        </Canvas>
      </View>
      <Text style={styles.hint}>{modelRef && failedRef === modelRef ? '3D model could not be loaded; showing the built-in body' : 'DRAG TO ROTATE'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: '#090c10', overflow: 'hidden' },
  hint: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    color: C.faint,
    fontFamily: F.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
});

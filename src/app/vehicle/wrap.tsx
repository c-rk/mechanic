import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, GestureResponderEvent, Image, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Shell } from '../../components/Shell';
import { Badge, Button, Panel, Segmented, T } from '../../components/ui';
import { Viewer3D } from '../../components/Viewer3D';
import { vehicleDims } from '../../lib/dimensions';
import type { CarBody } from '../../lib/bodySpecs';
import { deleteFile, fileUrl, saveFile } from '../../lib/files';
import { useStore } from '../../lib/store';
import { C, F } from '../../lib/theme';
import type { Pt, Wrap, WrapView } from '../../lib/types';
import { analyzeSide, decodeMask, detectWheelRadius, encodeMask, endFrame, modelPrompts, sideFrame, toPx, type SideFit } from '../../lib/wrap/analyze';
import { maskOverlayUri, modelSegmentationAvailable, segmentWithModel } from '../../lib/wrap/segmenter';
import { loadPixels, normalizePhoto } from '../../lib/wrap/image';

type Kind = 'side' | 'front' | 'rear';
type Draft = Omit<WrapView, 'p1' | 'p2'> & { p1?: Pt; p2?: Pt };

const KINDS: { value: Kind; label: string }[] = [
  { value: 'side', label: 'Side' },
  { value: 'front', label: 'Front' },
  { value: 'rear', label: 'Rear' },
];

const HELP: Record<Kind, [string, string]> = {
  side: ['Tap the centre of the rear wheel', 'Now tap the centre of the front wheel'],
  front: ['Tap where one front tyre touches the ground', 'Now tap where the other front tyre touches the ground'],
  rear: ['Tap where one rear tyre touches the ground', 'Now tap where the other rear tyre touches the ground'],
};

const complete = (d?: Draft): d is WrapView => Boolean(d?.p1 && d?.p2);

export default function WrapStudio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useStore((s) => s.vehicles.find((x) => x.id === id));
  const updateVehicle = useStore((s) => s.updateVehicle);

  const [kind, setKind] = useState<Kind>('side');
  const [drafts, setDrafts] = useState<Partial<Record<Kind, Draft>>>(() => ({ ...v?.wrap }));
  const [fit, setFit] = useState<{ key: string; result: SideFit } | null>(null);
  const [useShape, setUseShape] = useState(v?.wrap ? Boolean(v.wrap.shape) : true);
  const [usePaint, setUsePaint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [seg, setSeg] = useState<Partial<Record<Kind, 'running' | 'done' | 'fallback'>>>({});
  const [radiusManual, setRadiusManual] = useState(false);
  const created = useRef<string[]>([]);

  const body = v?.bodyType as CarBody;
  const side = drafts.side;
  const sideKey = complete(side) ? JSON.stringify(side) : '';

  useEffect(() => {
    if (!sideKey || !v || v.bodyType === 'motorcycle') return;
    let live = true;
    const view = JSON.parse(sideKey) as WrapView;
    loadPixels(view.ref)
      .then((px) => live && setFit({ key: sideKey, result: analyzeSide(px, view, body, view.mask ? decodeMask(view.mask) : null) }))
      .catch((e) => live && setError(`Could not read the photo: ${(e as Error).message}`));
    return () => {
      live = false;
    };
  }, [sideKey, body, v]);

  const sideFit = fit && fit.key === sideKey ? fit.result : null;
  const lowConfidence = sideFit !== null && sideFit.confidence < 0.6;

  const preview: Wrap | undefined = useMemo(() => {
    const w: Wrap = {};
    for (const k of ['side', 'front', 'rear'] as const) if (complete(drafts[k])) w[k] = drafts[k] as WrapView;
    if (!w.side) return undefined;
    if (useShape && sideFit && !lowConfidence) {
      w.shape = { profile: sideFit.profile, xRear: sideFit.xRear, xFront: sideFit.xFront, clearance: sideFit.clearance, wheelR: sideFit.wheelR };
    }
    return w;
  }, [drafts, useShape, sideFit, lowConfidence]);

  if (!v) {
    return (
      <Shell title="Photo wrap" back>
        <Text style={T.dim}>Vehicle not found.</Text>
      </Shell>
    );
  }
  if (v.bodyType === 'motorcycle') {
    return (
      <Shell title="Photo wrap" back>
        <Text style={T.dim}>Photo wrap is available for cars, vans and pickups. Upload a .glb model for a motorcycle instead.</Text>
      </Shell>
    );
  }

  const pick = async (camera: boolean) => {
    setError('');
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setError('Camera permission was not granted.');
      }
      const res = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (res.canceled) return;
      setBusy(true);
      const asset = res.assets[0];
      const photo = await normalizePhoto(asset.uri, asset.width);
      const ref = await saveFile({ uri: photo.uri, name: `wrap-${kind}.jpg`, mimeType: 'image/jpeg' });
      created.current.push(ref);
      setDrafts((d) => ({ ...d, [kind]: { ref, width: photo.width, height: photo.height } }));
    } catch (e) {
      setError(`Could not use that photo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const draft = drafts[kind];
  /** Runs the on-device segmentation model for one photo once both taps are placed. */
  const runSegmentation = async (k: Kind, view: WrapView, manual = radiusManual) => {
    if (!modelSegmentationAvailable) return;
    setSeg((x) => ({ ...x, [k]: 'running' }));
    // Let the progress indicator paint before the model blocks the thread.
    await new Promise((r) => setTimeout(r, 50));
    try {
      const px = await loadPixels(view.ref);
      const { positive, negative } = modelPrompts(view, body, k);
      const m = await segmentWithModel(px, positive, negative);
      if (!m) {
        setSeg((x) => ({ ...x, [k]: 'fallback' }));
        return;
      }
      const auto = k === 'side' && !manual ? detectWheelRadius(m, view) : undefined;
      setDrafts((d) => {
        const cur = d[k];
        // Ignore a result for taps that have since changed.
        if (!cur || cur.ref !== view.ref || cur.p1 !== view.p1 || cur.p2 !== view.p2) return d;
        return { ...d, [k]: { ...cur, mask: encodeMask(m), ...(auto ? { radiusPx: auto } : {}) } };
      });
      setSeg((x) => ({ ...x, [k]: 'done' }));
    } catch {
      setSeg((x) => ({ ...x, [k]: 'fallback' }));
    }
  };

  const tap = (p: Pt) => {
    const cur = drafts[kind];
    if (!cur) return;
    // Two taps define the view; a third tap starts over. New taps invalidate the model mask.
    const next: Draft = !cur.p1 || cur.p2 ? { ...cur, p1: p, p2: undefined, mask: undefined } : { ...cur, p2: p, mask: undefined };
    if (kind === 'side' && next.p1 && next.p2) {
      setRadiusManual(false);
      next.radiusPx = sideFrame({ ...next, radiusPx: undefined } as WrapView, body).rPx;
    }
    setDrafts((d) => ({ ...d, [kind]: next }));
    if (complete(next)) runSegmentation(kind, next, false);
  };
  const nudgeRadius = (f: number) => {
    setRadiusManual(true);
    setDrafts((d) => (d.side?.radiusPx ? { ...d, side: { ...d.side, radiusPx: d.side.radiusPx * f } } : d));
  };
  const clear = () => setDrafts((d) => ({ ...d, [kind]: undefined }));

  const save = async () => {
    if (!preview) return;
    const keep = new Set([preview.side?.ref, preview.front?.ref, preview.rear?.ref]);
    const old = [v.wrap?.side?.ref, v.wrap?.front?.ref, v.wrap?.rear?.ref, ...created.current];
    await Promise.all(old.filter((r): r is string => Boolean(r) && !keep.has(r)).map((r) => deleteFile(r).catch(() => undefined)));
    created.current = [];
    updateVehicle(v.id, { wrap: preview, ...(usePaint && sideFit ? { color: sideFit.paint } : {}) });
    router.back();
  };
  const removeWrap = async () => {
    const refs = [v.wrap?.side?.ref, v.wrap?.front?.ref, v.wrap?.rear?.ref, ...created.current].filter(Boolean) as string[];
    await Promise.all(refs.map((r) => deleteFile(r).catch(() => undefined)));
    updateVehicle(v.id, { wrap: undefined });
    router.back();
  };

  return (
    <Shell title="Photo wrap" eyebrow={v.nickname || `${v.make} ${v.model}`} back>
      <View style={styles.preview}>
        <Viewer3D
          dims={vehicleDims(v)}
          bodyType={v.bodyType}
          color={usePaint && sideFit ? sideFit.paint : v.color}
          wrap={preview}
          height={260}
          initialYaw={-0.9}
          still
        />
      </View>
      <Text style={T.dim}>
        Everything runs on this device: a segmentation model cuts the vehicle out of the photo, the body is fitted to its
        silhouette and wheel size, and the photo is projected onto the 3D model. Drag the preview to turn it.
      </Text>

      <Segmented options={KINDS.map((k) => ({ ...k, label: k.label + (complete(drafts[k.value]) ? ' ✓' : '') }))} value={kind} onChange={setKind} />

      <Panel title={kind === 'side' ? 'Side photo (required)' : `${kind === 'front' ? 'Front' : 'Rear'} photo (optional)`}>
        {!draft ? (
          <View style={{ gap: 10 }}>
            <Text style={T.dim}>
              {kind === 'side'
                ? 'Stand square to the side of the car, about 6–8 m away, with both wheels and both bumpers in frame. A plain background gives the cleanest cut-out.'
                : `Stand square to the ${kind} of the car at bumper height with both ${kind} tyres in frame.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Platform.OS !== 'web' ? <Button label="Take photo" onPress={() => pick(true)} disabled={busy} style={{ flex: 1 }} /> : null}
              <Button label="Choose photo" tone={Platform.OS === 'web' ? 'primary' : 'secondary'} onPress={() => pick(false)} disabled={busy} style={{ flex: 1 }} />
            </View>
            {busy ? <ActivityIndicator color={C.accent} /> : null}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={T.strong}>{draft.p1 && draft.p2 ? 'Aligned. Tap again to redo.' : HELP[kind][draft.p1 ? 1 : 0]}</Text>
            <TapImage kind={kind} draft={draft} body={body} fit={kind === 'side' ? sideFit : null} onTap={tap} />
            {seg[kind] === 'running' ? (
              <View style={styles.segRow}>
                <ActivityIndicator color={C.accent} />
                <Text style={[T.dim, { flex: 1 }]}>Cutting out the vehicle on this device. The first time, the 30 MB model downloads once.</Text>
              </View>
            ) : draft.mask ? (
              <View style={styles.segRow}>
                <Badge text="AI cut-out" color={C.green} />
                <Text style={T.small}>Segmented on this device{kind === 'side' && !radiusManual ? ' · wheel size detected' : ''}</Text>
              </View>
            ) : seg[kind] === 'fallback' ? (
              <Text style={T.small}>Model unavailable here; using the basic cut-out.</Text>
            ) : null}
            {kind === 'side' && complete(draft) ? (
              <View style={styles.radiusRow}>
                <Text style={[T.dim, { flex: 1 }]}>Match the circles to the tyres</Text>
                <Button label="−" tone="secondary" small onPress={() => nudgeRadius(0.96)} />
                <Button label="+" tone="secondary" small onPress={() => nudgeRadius(1.04)} />
              </View>
            ) : null}
            <Button label="Replace photo" tone="ghost" small onPress={clear} style={{ alignSelf: 'flex-start' }} />
          </View>
        )}
      </Panel>

      {sideFit ? (
        <Panel title="Fit">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Badge text={lowConfidence ? 'weak silhouette' : 'silhouette found'} color={lowConfidence ? C.yellow : C.green} />
            <Text style={T.small}>{Math.round(sideFit.confidence * 100)}% confidence</Text>
          </View>
          <Text style={[T.dim, { marginTop: 8 }]}>
            {lowConfidence
              ? 'The background is too close to the car colour to trace its outline reliably, so the standard body shape is used. A photo against a plain wall or sky works better.'
              : `Length ${(sideFit.xFront - sideFit.xRear).toFixed(2)} m, roof ${Math.max(...sideFit.profile.map((p) => p[1])).toFixed(2)} m, scaled from a ${body} wheelbase.`}
          </Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            {!lowConfidence ? (
              <Segmented
                options={[
                  { value: 'photo', label: 'Shape from photo' },
                  { value: 'standard', label: `Standard ${body}` },
                ]}
                value={useShape ? 'photo' : 'standard'}
                onChange={(x) => setUseShape(x === 'photo')}
              />
            ) : null}
            <Pressable onPress={() => setUsePaint(!usePaint)} style={styles.paintRow} accessibilityRole="checkbox" accessibilityState={{ checked: usePaint }}>
              <View style={[styles.swatch, { backgroundColor: sideFit.paint }]} />
              <Text style={[T.body, { flex: 1 }]}>Use paint colour from photo</Text>
              <View style={[styles.check, usePaint && { backgroundColor: C.accent, borderColor: C.accent }]}>
                {usePaint ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
            </Pressable>
          </View>
        </Panel>
      ) : null}

      {error ? <Text style={[T.dim, { color: C.red }]}>{error}</Text> : null}
      <Button label="Save wrap" onPress={save} disabled={!preview} />
      {v.wrap ? <Button label="Remove photo wrap" tone="danger" onPress={removeWrap} /> : null}
    </Shell>
  );
}

function TapImage({
  kind,
  draft,
  body,
  fit,
  onTap,
}: {
  kind: Kind;
  draft: Draft;
  body: CarBody;
  fit: SideFit | null;
  onTap: (p: Pt) => void;
}) {
  const [uri, setUri] = useState<{ ref: string; uri: string } | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<React.ComponentRef<typeof View>>(null);
  useEffect(() => {
    let live = true;
    fileUrl(draft.ref).then((u) => live && setUri({ ref: draft.ref, uri: u }));
    return () => {
      live = false;
    };
  }, [draft.ref]);

  const k = width ? width / draft.width : 0;
  const maskKey = draft.mask?.rle;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the RLE string identifies the mask
  const overlay2 = useMemo(() => (draft.mask ? maskOverlayUri(decodeMask(draft.mask)) : null), [maskKey]);
  const S = (p: Pt) => `${p[0] * k},${p[1] * k}`;
  const onPress = (e: GestureResponderEvent) => {
    if (!k) return;
    const { locationX, locationY, pageX, pageY } = e.nativeEvent;
    if (Number.isFinite(locationX) && Number.isFinite(locationY)) return onTap([locationX / k, locationY / k]);
    // react-native-web may omit locationX/Y; derive them from the element's position on screen.
    box.current?.measureInWindow((x: number, y: number) => {
      if (Number.isFinite(pageX - x)) onTap([(pageX - x) / k, (pageY - y) / k]);
    });
  };

  let overlay: React.ReactNode = null;
  if (k && draft.p1 && draft.p2) {
    const view = draft as WrapView;
    if (kind === 'side') {
      const f = sideFrame(view, body);
      const r = f.rPx * k;
      overlay = (
        <>
          <Circle cx={view.p1[0] * k} cy={view.p1[1] * k} r={r} stroke={C.accent} strokeWidth={2} fill="none" />
          <Circle cx={view.p2[0] * k} cy={view.p2[1] * k} r={r} stroke={C.accent} strokeWidth={2} fill="none" />
          {fit ? (
            <Polyline
              points={[[fit.xRear, fit.clearance] as Pt, ...fit.profile, [fit.xFront, fit.clearance] as Pt].map((p) => S(toPx(f, p[0], p[1]))).join(' ')}
              stroke={C.green}
              strokeWidth={2}
              fill="none"
            />
          ) : null}
        </>
      );
    } else {
      const f = endFrame(view, body, kind);
      const a = toPx(f, -1.2, 0);
      const b = toPx(f, 1.2, 0);
      overlay = <Line x1={a[0] * k} y1={a[1] * k} x2={b[0] * k} y2={b[1] * k} stroke={C.accent} strokeWidth={2} />;
    }
  }

  return (
    <Pressable
      ref={box}
      onPress={onPress}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel="Photo; tap to place alignment points"
      style={{ width: '100%', aspectRatio: draft.width / draft.height, borderRadius: 14, overflow: 'hidden', backgroundColor: C.surface2 }}>
      {uri?.ref === draft.ref ? <Image source={{ uri: uri.uri }} style={StyleSheet.absoluteFill} resizeMode="stretch" /> : null}
      {overlay2 ? <Image source={{ uri: overlay2 }} style={StyleSheet.absoluteFill} resizeMode="stretch" /> : null}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        {overlay}
        {[draft.p1, draft.p2].map((p, i) =>
          p ? <Circle key={i} cx={p[0] * k} cy={p[1] * k} r={6} fill={i ? C.accent : C.text} stroke={C.bg} strokeWidth={2} /> : null,
        )}
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paintRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.surface3 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: C.onAccent, fontFamily: F.bold, fontSize: 14, lineHeight: 16 },
});

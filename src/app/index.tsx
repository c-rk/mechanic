import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { GarageScene, type GarageCamera } from '../components/garage/GarageScene';
import { ActionTile, Glass, GlassButton, Icon, type IconName } from '../components/garage/Glass';
import { Logo } from '../components/Logo';
import { QuickLog, type QuickKind } from '../components/QuickLog';
import { Bevel, GlassFill } from '../components/ui';
import { vehicleAlerts, type VehicleAlert } from '../lib/alerts';
import { vehicleDims } from '../lib/dimensions';
import { dueInfo, fmtNum, fuelStats, sortByDue, type DueInfo } from '../lib/calc';
import { estimateOdometer, METERS_PER } from '../lib/odometer';
import { useStore } from '../lib/store';
import { AREA, C, F, NUM } from '../lib/theme';
import { useTrip } from '../lib/trip';
import type { Vehicle } from '../lib/types';

const LEVEL_COLOR = { critical: C.red, warn: C.yellow, info: C.accent } as const;
/** Share of the screen the info sheet covers; the 3D scene frames the car above it. */
const SHEET_SHARE = 0.46;

const tick = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
};

export default function Garage() {
  const vehicles = useStore((s) => s.vehicles);
  const trip = useTrip((s) => s.trip);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [quick, setQuick] = useState<QuickKind | null>(null);
  const [help, setHelp] = useState(false);
  const active = Math.min(index, Math.max(0, vehicles.length - 1));
  const v = vehicles[active];

  // Camera state read by the 3D scene every frame; the gesture writes to it without re-rendering.
  const cam = useRef<GarageCamera>({ index: active, drag: 0, bottomInset: SHEET_SHARE });
  useEffect(() => {
    cam.current.index = active;
    // Frame each bay by the real length of its vehicle (with a minimum for small cars).
    cam.current.fits = vehicles.map((x) => Math.max(5.4, (vehicleDims(x).length ?? 4.6) * 1.18));
  }, [active, vehicles]);

  const count = vehicles.length;
  const pan = useMemo(() => {
    const go = (i: number) => {
      cam.current.index = i;
      setIndex(i);
      tick();
    };
    // The gesture only reads and writes the camera ref inside its callbacks, never during render.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        let d = -g.dx / width;
        const i = cam.current.index;
        // Resist past the first and last bay.
        if ((i === 0 && d < 0) || (i >= count - 1 && d > 0)) d *= 0.25;
        cam.current.drag = d * 1.15;
      },
      onPanResponderRelease: (_, g) => {
        const i = cam.current.index;
        cam.current.drag = 0;
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          const cur = useStore.getState().vehicles[i];
          if (cur) router.push(`/vehicle/${cur.id}`);
          return;
        }
        const fling = Math.abs(g.vx) > 0.35;
        if ((g.dx < -width * 0.22 || (fling && g.vx < 0)) && i < count - 1) go(i + 1);
        else if ((g.dx > width * 0.22 || (fling && g.vx > 0)) && i > 0) go(i - 1);
      },
      onPanResponderTerminate: () => {
        cam.current.drag = 0;
      },
    });
  }, [count, width]);

  return (
    <View style={styles.root}>
      <GarageScene vehicles={vehicles} cam={cam} />
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers} />

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Logo size={40} />
          <View>
            <Text style={styles.brand}>
              BAY <Text style={{ color: C.dim }}>ONE</Text>
            </Text>
            <Text style={styles.count}>{count ? `Bay ${String(active + 1).padStart(2, '0')} of ${String(count).padStart(2, '0')}` : 'Empty garage'}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GlassButton icon="plus" label="Add vehicle" onPress={() => router.push('/vehicle/new')} />
          <GlassButton icon="cog-outline" label="Settings" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {trip ? (
        <Pressable onPress={() => router.push('/trip')} style={[styles.live, { top: insets.top + 64 }]} accessibilityRole="button" accessibilityLabel="Open drive recorder">
          <Glass radius={999} style={styles.liveInner}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              Recording · {fmtNum(trip.meters / METERS_PER[useStore.getState().settings.distanceUnit], 1)} {useStore.getState().settings.distanceUnit}
            </Text>
          </Glass>
        </Pressable>
      ) : null}

      {/* Bottom: pager, help, info sheet */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <View style={styles.pagerRow} pointerEvents="box-none">
          <View style={{ width: 48 }} />
          <View style={styles.dots}>
            {vehicles.map((x, i) => (
              <Pressable key={x.id} onPress={() => (setIndex(i), tick())} hitSlop={8} accessibilityLabel={`Show ${x.nickname || x.model}`}>
                <View style={[styles.dot, i === active && styles.dotOn]} />
              </Pressable>
            ))}
          </View>
          {v ? <GlassButton icon="lifebuoy" label="Help" size={48} onPress={() => setHelp(true)} /> : <View style={{ width: 48 }} />}
        </View>
        {v ? <InfoSheet v={v} onQuick={setQuick} /> : <EmptySheet />}
      </View>

      {v ? <QuickLog v={v} kind={quick} onClose={() => setQuick(null)} /> : null}
      {v ? <HelpSheet v={v} visible={help} onClose={() => setHelp(false)} /> : null}
    </View>
  );
}

function InfoSheet({ v, onQuick }: { v: Vehicle; onQuick: (k: QuickKind) => void }) {
  const fuel = useStore((s) => s.fuel);
  const maintenance = useStore((s) => s.maintenance);
  const odoLog = useStore((s) => s.odoLog);
  const recalls = useStore((s) => s.recalls);
  const settings = useStore((s) => s.settings);
  const u = settings.distanceUnit;

  const stats = fuelStats(fuel.filter((f) => f.vehicleId === v.id), settings);
  const odo = estimateOdometer(odoLog.filter((r) => r.vehicleId === v.id), v.odometer);
  const next = sortByDue(maintenance.filter((m) => m.vehicleId === v.id).map((m) => ({ m, due: dueInfo(m, odo.estimate, odo.perDay) }))).find(
    (x) => x.due.state !== 'unknown',
  );
  const alerts = vehicleAlerts(v, { maintenance, odoLog, recalls, settings });

  return (
    <Glass style={styles.sheet}>
      <Pressable onPress={() => router.push(`/vehicle/${v.id}`)} style={styles.head} accessibilityRole="button" accessibilityLabel="Open vehicle details">
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {v.nickname || `${v.make} ${v.model}`}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}
          </Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.detailsText}>Details</Text>
          <Icon name="chevron-right" size={18} color={C.dim} />
        </View>
      </Pressable>

      <View style={styles.stats}>
        <Metric label="Odometer" value={fmtNum(v.odometer)} unit={u} />
        <View style={styles.vr} />
        <Metric label="Consumption" value={stats.economy === null ? '—' : stats.economy.toFixed(1)} unit={stats.economy === null ? '' : stats.economyLabel} />
        <View style={styles.vr} />
        <Metric
          label="Next service"
          value={!next ? '—' : next.due.state === 'overdue' ? 'Overdue' : nextIn(next.due, u)}
          unit={next ? next.m.name : 'Mark a service done'}
          color={next ? STATE_TEXT[next.due.state] : undefined}
        />
      </View>

      {alerts.length ? (
        <View style={{ gap: 6 }}>
          {alerts.slice(0, 2).map((a) => (
            <AlertRow key={a.id} a={a} v={v} />
          ))}
          {alerts.length > 2 ? (
            <Text style={styles.more} onPress={() => router.push(`/vehicle/${v.id}?tab=service`)}>
              +{alerts.length - 2} more
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.allGood}>
          <Icon name="check-circle-outline" size={18} color={C.green} />
          <Text style={styles.allGoodText}>No alerts. Everything logged is up to date.</Text>
        </View>
      )}

      <View style={styles.actions}>
        <ActionTile icon="gas-station-outline" label="Fuel" tint={AREA.fuel} onPress={() => onQuick('fuel')} />
        <ActionTile icon="counter" label="Odometer" tint={AREA.odometer} onPress={() => onQuick('odo')} />
        <ActionTile icon="wrench-outline" label="Service" tint={AREA.service} onPress={() => onQuick('service')} />
        <ActionTile icon="map-marker-path" label="Drive" tint={AREA.drive} onPress={() => router.push('/trip')} />
      </View>
    </Glass>
  );
}

const STATE_TEXT = { overdue: C.red, soon: C.yellow, ok: C.text, unknown: C.text } as const;

/** Shortest useful countdown: days when known, else distance. */
function nextIn(d: DueInfo, u: string) {
  const days = d.daysLeft ?? d.etaDays;
  if (days !== undefined && (d.distanceLeft === undefined || d.etaDays !== undefined || d.daysLeft !== undefined)) {
    return days > 60 ? `${Math.round(days / 30)} mo` : `${days} d`;
  }
  return d.distanceLeft !== undefined ? `${fmtNum(d.distanceLeft)} ${u}` : '—';
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricUnit} numberOfLines={1}>
        {unit}
      </Text>
    </View>
  );
}

function AlertRow({ a, v }: { a: VehicleAlert; v: Vehicle }) {
  const color = LEVEL_COLOR[a.level];
  return (
    <Pressable onPress={() => router.push(`/vehicle/${v.id}?tab=${a.tab}`)} style={({ pressed }) => [styles.alert, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={a.title}>
      <HazardEdge color={color} striped={false} />
      <View style={[styles.alertIcon, { backgroundColor: color + '26' }]}>
        <Icon name={a.icon as IconName} size={16} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.alertTitle} numberOfLines={1}>
          {a.title}
        </Text>
        <Text style={styles.alertDetail} numberOfLines={1}>
          {a.detail}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={C.faint} />
    </Pressable>
  );
}

/** Left edge marker; overdue items get safety striping. */
function HazardEdge({ color, striped }: { color: string; striped: boolean }) {
  return (
    <View style={styles.edge}>
      {striped ? (
        <Svg width={6} height="100%">
          <Defs>
            <Pattern id="hz" width={6} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <Rect width={3} height={8} fill={color} />
            </Pattern>
          </Defs>
          <Rect width={6} height="100%" fill="url(#hz)" />
        </Svg>
      ) : (
        <View style={{ flex: 1, backgroundColor: color }} />
      )}
    </View>
  );
}

function EmptySheet() {
  return (
    <Glass style={styles.sheet}>
      <View style={{ zIndex: 1, position: 'relative' }}>
        <Logo size={56} />
      </View>
      <Text style={[styles.name, { marginTop: 12 }]}>Your garage is empty</Text>
      <Text style={[styles.sub, { marginTop: 4 }]}>
        Park a vehicle by VIN or by make and model. Fuel, service, parts and documents stay on this device.
      </Text>
      <Pressable onPress={() => router.push('/vehicle/new')} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.8 }]} accessibilityRole="button" accessibilityLabel="Add vehicle">
        <Icon name="plus" size={20} color={C.onPrimary} />
        <Text style={styles.ctaText}>Add vehicle</Text>
      </Pressable>
    </Glass>
  );
}

function HelpSheet({ v, visible, onClose }: { v: Vehicle; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };
  const items: { icon: IconName; title: string; detail: string; path: string; tint: string }[] = [
    { icon: 'robot-outline', title: 'Ask the mechanic', detail: 'Describe a symptom, noise or warning light', path: `/vehicle/assistant?id=${v.id}`, tint: AREA.mechanic },
    { icon: 'clipboard-text-outline', title: 'Specifications', detail: 'Engine, dimensions, wheels, fluids', path: `/vehicle/${v.id}?tab=specs`, tint: AREA.specs },
    { icon: 'folder-outline', title: 'Documents', detail: 'Registration, insurance, invoices, manuals', path: `/vehicle/${v.id}?tab=docs`, tint: AREA.docs },
    { icon: 'book-open-variant', title: 'Manuals & research', detail: 'Recalls, videos, forums, saved references', path: `/vehicle/${v.id}?tab=intel`, tint: AREA.research },
    { icon: 'calendar-check-outline', title: 'Service schedule', detail: 'Intervals, history and what is due', path: `/vehicle/${v.id}?tab=service`, tint: AREA.service },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close help" />
      <View style={[styles.helpSheet, { paddingBottom: insets.bottom + 16 }]}>
        <GlassFill strong />
        <Bevel radius={28} />
        <View style={styles.grabber} />
        <Text style={[styles.name, { fontSize: 26 }]}>How can we help?</Text>
        <Text style={[styles.sub, { marginBottom: 8 }]}>{v.nickname || `${v.make} ${v.model}`}</Text>
        {items.map((it) => (
          <Pressable key={it.title} onPress={() => go(it.path)} style={({ pressed }) => [styles.helpRow, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={it.title}>
            <View style={[styles.helpIcon, { backgroundColor: it.tint + '1f' }]}>
              <Icon name={it.icon} size={22} color={it.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>{it.title}</Text>
              <Text style={styles.alertDetail}>{it.detail}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={C.faint} />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0b0d' },
  top: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  brand: { color: C.text, fontFamily: F.semibold, fontSize: 17, letterSpacing: 2.5 },
  count: { color: C.dim, fontFamily: F.mono, fontSize: 11, marginTop: 3, ...NUM },
  live: { position: 'absolute', alignSelf: 'center' },
  liveInner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  liveText: { color: C.text, fontFamily: F.mono, fontSize: 12, letterSpacing: 0.6, ...NUM },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, gap: 12, alignItems: 'center' },
  pagerRow: { width: '100%', maxWidth: 560, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 4 },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 22, backgroundColor: C.text },
  sheet: { width: '100%', maxWidth: 560, padding: 18, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: C.text, fontFamily: F.semibold, fontSize: 28, letterSpacing: -0.9, lineHeight: 32 },
  sub: { color: C.dim, fontFamily: F.regular, fontSize: 13.5, lineHeight: 18, marginTop: 2 },
  details: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 12, paddingRight: 6, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: 'rgba(255,255,255,0.05)' },
  detailsText: { color: C.text, fontFamily: F.medium, fontSize: 13.5 },
  stats: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  vr: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.14)' },
  metricLabel: { color: C.faint, fontFamily: F.mono, fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase' },
  metricValue: { color: C.text, fontFamily: F.semibold, fontSize: 22, letterSpacing: -0.6, ...NUM },
  metricUnit: { color: C.dim, fontFamily: F.regular, fontSize: 12.5, ...NUM },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingLeft: 14, paddingRight: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: C.glassEdge, overflow: 'hidden' },
  alertIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  edge: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, overflow: 'hidden' },
  alertTitle: { color: C.text, fontFamily: F.semibold, fontSize: 14.5 },
  alertDetail: { color: C.dim, fontFamily: F.regular, fontSize: 12.5, marginTop: 1, ...NUM },
  more: { color: C.dim, fontFamily: F.medium, fontSize: 12, paddingLeft: 10 },
  allGood: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  allGoodText: { color: C.dim, fontFamily: F.regular, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  cta: { marginTop: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 14, minHeight: 52 },
  ctaText: { color: C.onPrimary, fontFamily: F.semibold, fontSize: 16 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  helpSheet: {
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 6,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: C.glassEdge,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, alignSelf: 'center', marginBottom: 12 },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  helpIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

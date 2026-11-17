import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Shell } from '../components/Shell';
import { Badge, Button, FormModal, Panel, Stat, T } from '../components/ui';
import { Viewer3D } from '../components/Viewer3D';
import { describeDue, dueInfo, fmtNum, fuelStats, sortByDue } from '../lib/calc';
import { estimateOdometer, METERS_PER } from '../lib/odometer';
import { useStore } from '../lib/store';
import { C, F, NUM, STATE_COLOR } from '../lib/theme';
import { useTrip } from '../lib/trip';

export default function Garage() {
  const vehicles = useStore((s) => s.vehicles);
  const fuel = useStore((s) => s.fuel);
  const maintenance = useStore((s) => s.maintenance);
  const odoLog = useStore((s) => s.odoLog);
  const settings = useStore((s) => s.settings);
  const logOdometer = useStore((s) => s.logOdometer);
  const trip = useTrip((s) => s.trip);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [odoOpen, setOdoOpen] = useState(false);
  const v = vehicles.find((x) => x.id === selectedId) ?? vehicles[0];
  const u = settings.distanceUnit;

  const setup = <Button label="Setup" tone="secondary" small onPress={() => router.push('/settings')} />;

  if (!v) {
    return (
      <Shell title="Garage" right={setup}>
        <View style={styles.hero}>
          <Viewer3D bodyType="coupe" color="#6d737b" height={300} />
        </View>
        <Text style={T.title}>Park your first vehicle</Text>
        <Text style={T.dim}>
          Add it by VIN or by make and model. Bay One keeps its fuel log, service schedule, parts, documents and research
          in one place, stored on this device.
        </Text>
        <Button label="Add vehicle" onPress={() => router.push('/vehicle/new')} />
      </Shell>
    );
  }

  const stats = fuelStats(fuel.filter((f) => f.vehicleId === v.id), settings);
  const odo = estimateOdometer(odoLog.filter((r) => r.vehicleId === v.id), v.odometer);
  const next = sortByDue(maintenance.filter((m) => m.vehicleId === v.id).map((m) => ({ m, due: dueInfo(m, odo.estimate, odo.perDay) }))).find(
    (x) => x.due.state !== 'unknown',
  );
  const stale = settings.odoReminderDays > 0 && odo.daysSinceReading >= settings.odoReminderDays;
  const tripHere = trip && trip.vehicleId === v.id;

  return (
    <Shell title="Garage" right={setup}>
      {trip ? (
        <Pressable onPress={() => router.push('/trip')} style={styles.live} accessibilityRole="button" accessibilityLabel="Open drive recorder">
          <View style={styles.liveDot} />
          <Text style={[T.strong, { flex: 1 }]}>Recording drive</Text>
          <Text style={[T.strong, NUM]}>
            {fmtNum(trip.meters / METERS_PER[u], 1)} {u}
          </Text>
        </Pressable>
      ) : null}

      <Pressable onPress={() => router.push(`/vehicle/${v.id}`)} accessibilityRole="button" accessibilityLabel={`Open ${v.nickname || v.model}`}>
        <View style={styles.hero}>
          <Viewer3D bodyType={v.bodyType} color={v.color} modelRef={v.modelRef} wrap={v.wrap} height={300} />
          <View style={styles.heroCaption} pointerEvents="none">
            <Text style={styles.heroName} numberOfLines={1}>
              {v.nickname || `${v.make} ${v.model}`}
            </Text>
            <Text style={T.dim}>{[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}</Text>
          </View>
        </View>
      </Pressable>

      {stale ? (
        <Panel>
          <Text style={T.strong}>Time for an odometer reading</Text>
          <Text style={[T.dim, { marginTop: 4 }]}>
            Last logged {Math.floor(odo.daysSinceReading)} days ago.
            {odo.perDay !== null ? ` At your average of ${fmtNum(odo.perDay)} ${u}/day it should read about ${fmtNum(odo.estimate)} ${u}.` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Button label="Enter reading" small onPress={() => setOdoOpen(true)} />
            <Button label="Record drives by GPS" tone="secondary" small onPress={() => router.push('/trip')} />
          </View>
        </Panel>
      ) : null}

      <View style={styles.stats}>
        <Stat
          flex={1.25}
          label="Odometer"
          value={fmtNum(v.odometer)}
          unit={u}
          hint={odo.perDay !== null ? `≈ ${fmtNum(odo.perDay)} ${u}/day` : 'Pace not known yet'}
        />
        <Stat
          flex={1}
          label="Consumption"
          value={stats.economy === null ? '—' : stats.economy.toFixed(1)}
          unit={stats.economy === null ? undefined : stats.economyLabel}
          color={stats.economy === null ? C.faint : C.text}
          hint={stats.economy === null ? 'Needs two full fills' : `${stats.series.length} fills`}
        />
      </View>

      <Panel title="Next up" right={<Button label="Schedule" tone="ghost" small onPress={() => router.push(`/vehicle/${v.id}?tab=service`)} />}>
        {next ? (
          <View style={styles.next}>
            <Badge text={next.due.state} color={STATE_COLOR[next.due.state]} />
            <Text style={[T.strong, { flex: 1 }]} numberOfLines={1}>
              {next.m.name}
            </Text>
            <Text style={[T.small, { color: C.dim }]}>{describeDue(next.due, u)}</Text>
          </View>
        ) : (
          <Text style={T.dim}>Mark a service as done to start its countdown.</Text>
        )}
      </Panel>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Open" onPress={() => router.push(`/vehicle/${v.id}`)} style={{ flex: 1 }} />
        <Button label={tripHere ? 'Drive in progress' : 'Record drive'} tone="secondary" onPress={() => router.push('/trip')} style={{ flex: 1 }} />
      </View>

      <Text style={[T.label, { marginTop: 8 }]}>Vehicles</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {vehicles.map((x) => {
          const on = x.id === v.id;
          return (
            <Pressable
              key={x.id}
              onPress={() => setSelectedId(x.id)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${x.nickname || x.model}`}
              style={[styles.slot, on && styles.slotOn]}>
              <View style={[styles.swatch, { backgroundColor: x.color }]} />
              <Text style={T.strong} numberOfLines={1}>
                {x.nickname || x.model}
              </Text>
              <Text style={T.small} numberOfLines={1}>
                {fmtNum(x.odometer)} {u}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => router.push('/vehicle/new')} accessibilityRole="button" accessibilityLabel="Add vehicle" style={[styles.slot, styles.slotAdd]}>
          <Text style={styles.plus}>+</Text>
          <Text style={T.dim}>Add</Text>
        </Pressable>
      </ScrollView>

      <FormModal
        visible={odoOpen}
        title="Odometer reading"
        fields={[{ key: 'odometer', label: `Current reading (${u})`, kind: 'number', required: true }]}
        initial={{ odometer: undefined }}
        onClose={() => setOdoOpen(false)}
        onSave={(x) => {
          logOdometer(v.id, x.odometer as number, 'manual');
          setOdoOpen(false);
        }}
      />
    </Shell>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  heroCaption: { position: 'absolute', left: 18, right: 18, bottom: 16 },
  heroName: { color: C.text, fontFamily: F.bold, fontSize: 28, letterSpacing: -0.8 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.accentSoft,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  stats: { flexDirection: 'row', gap: 10 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slot: { width: 132, padding: 14, gap: 6, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  slotOn: { borderColor: C.accent },
  slotAdd: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: C.borderStrong },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.surface3 },
  plus: { color: C.dim, fontFamily: F.regular, fontSize: 26, lineHeight: 28 },
});

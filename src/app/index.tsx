import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Shell } from '../components/Shell';
import { Badge, GelButton, Lcd, Panel, T } from '../components/ui';
import { Viewer3D } from '../components/Viewer3D';
import { describeDue, dueInfo, fmtNum, fuelStats, sortByDue } from '../lib/calc';
import { useStore } from '../lib/store';
import { C, F, STATE_COLOR } from '../lib/theme';

export default function Garage() {
  const vehicles = useStore((s) => s.vehicles);
  const fuel = useStore((s) => s.fuel);
  const maintenance = useStore((s) => s.maintenance);
  const settings = useStore((s) => s.settings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const v = vehicles.find((x) => x.id === selectedId) ?? vehicles[0];

  const settingsButton = <GelButton label="Setup" tone="steel" small onPress={() => router.push('/settings')} />;

  if (!v) {
    return (
      <Shell title="Personal garage" right={settingsButton}>
        <Panel title="Bay 01 / empty" pad={false}>
          <Viewer3D bodyType="coupe" color="#6d737b" height={300} />
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={T.title}>Park your first vehicle</Text>
            <Text style={T.dim}>
              Enter a VIN or the make and model. Bay One then keeps its fuel log, service schedule, parts list, documents
              and research in one place, stored on this device.
            </Text>
            <GelButton label="Add vehicle" onPress={() => router.push('/vehicle/new')} />
          </View>
        </Panel>
      </Shell>
    );
  }

  const stats = fuelStats(fuel.filter((f) => f.vehicleId === v.id), settings);
  const next = sortByDue(
    maintenance.filter((m) => m.vehicleId === v.id).map((m) => ({ m, due: dueInfo(m, v.odometer) })),
  ).find((x) => x.due.state !== 'unknown');
  const bay = vehicles.indexOf(v) + 1;

  return (
    <Shell title={`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} in garage`} right={settingsButton}>
      <Panel title={`Bay ${String(bay).padStart(2, '0')} / ${v.nickname || v.model}`} pad={false}>
        <Viewer3D bodyType={v.bodyType} color={v.color} modelRef={v.modelRef} height={300} />
        <View style={{ padding: 14, gap: 12 }}>
          <View>
            <Text style={T.title}>{v.nickname || `${v.make} ${v.model}`}</Text>
            <Text style={[T.dim, { fontFamily: F.mono }]}>
              {[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}
            </Text>
          </View>
          <View style={styles.lcds}>
            <Lcd flex={1.2} label="Odometer" value={fmtNum(v.odometer)} unit={settings.distanceUnit} />
            <Lcd flex={1} label="Consumption" value={stats.economy === null ? '--.-' : stats.economy.toFixed(1)} unit={stats.economyLabel} color={C.green} />
          </View>
          {next ? (
            <View style={styles.next}>
              <Badge text={next.due.state} color={STATE_COLOR[next.due.state]} />
              <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>
                {next.m.name}
              </Text>
              <Text style={[T.dim, { fontFamily: F.mono }]}>{describeDue(next.due, settings.distanceUnit)}</Text>
            </View>
          ) : (
            <Text style={T.dim}>Log a service to start the maintenance countdown.</Text>
          )}
          <GelButton label="Open bay" onPress={() => router.push(`/vehicle/${v.id}`)} />
        </View>
      </Panel>

      <Panel title="Garage">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {vehicles.map((x, i) => {
            const on = x.id === v.id;
            return (
              <Pressable
                key={x.id}
                onPress={() => setSelectedId(x.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${x.nickname || x.model}`}
                style={[styles.slot, on && styles.slotOn]}>
                <Text style={[T.label, on && { color: C.blue }]}>Bay {String(i + 1).padStart(2, '0')}</Text>
                <View style={[styles.swatch, { backgroundColor: x.color }]} />
                <Text style={[T.body, { fontSize: 13 }]} numberOfLines={1}>
                  {x.nickname || x.model}
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => router.push('/vehicle/new')} accessibilityRole="button" accessibilityLabel="Add vehicle" style={[styles.slot, styles.slotAdd]}>
            <Text style={styles.plus}>+</Text>
            <Text style={T.label}>Add</Text>
          </Pressable>
        </ScrollView>
      </Panel>
    </Shell>
  );
}

const styles = StyleSheet.create({
  lcds: { flexDirection: 'row', gap: 8 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slot: {
    width: 118,
    padding: 10,
    gap: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.edgeDark,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  slotOn: { borderColor: C.blue, backgroundColor: 'rgba(58,155,255,0.12)' },
  slotAdd: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: C.line },
  swatch: { height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#000' },
  plus: { color: C.dim, fontFamily: F.mono, fontSize: 26, lineHeight: 28 },
});

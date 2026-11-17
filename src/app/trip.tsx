import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Shell } from '../components/Shell';
import { Button, Empty, Panel, Row, Segmented, T } from '../components/ui';
import { fmtNum } from '../lib/calc';
import { METERS_PER } from '../lib/odometer';
import { useStore } from '../lib/store';
import { C, F, NUM } from '../lib/theme';
import { startTrip, stopTrip, useTrip } from '../lib/trip';

const fmtDuration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
};

export default function TripScreen() {
  const vehicles = useStore((s) => s.vehicles);
  const trips = useStore((s) => s.trips);
  const unit = useStore((s) => s.settings.distanceUnit);
  const { trip, error } = useTrip();
  const [vehicleId, setVehicleId] = useState(trip?.vehicleId ?? vehicles[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!trip) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trip]);

  const per = METERS_PER[unit];
  const v = vehicles.find((x) => x.id === (trip?.vehicleId ?? vehicleId));
  const history = trips
    .filter((t) => !v || t.vehicleId === v.id)
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, 30);

  const start = async () => {
    setBusy(true);
    setResult('');
    try {
      await startTrip(vehicleId);
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    setBusy(true);
    try {
      const added = await stopTrip();
      setResult(added > 0 ? `Added ${fmtNum(added, 1)} ${unit} to the odometer.` : 'Drive was under 50 m; nothing was added.');
    } finally {
      setBusy(false);
    }
  };

  if (!vehicles.length) {
    return (
      <Shell title="Drive recorder" back>
        <Empty text="Add a vehicle first." />
      </Shell>
    );
  }

  return (
    <Shell title="Drive recorder" back>
      {!trip ? (
        <Panel title="Vehicle">
          <Segmented options={vehicles.map((x) => ({ value: x.id, label: x.nickname || x.model }))} value={vehicleId} onChange={setVehicleId} scroll />
        </Panel>
      ) : null}

      <View style={styles.dial}>
        <Text style={T.label}>{trip ? `Recording · ${v?.nickname || v?.model}` : 'Ready'}</Text>
        <Text style={styles.big}>{fmtNum((trip?.meters ?? 0) / per, 1)}</Text>
        <Text style={[T.dim, { marginTop: -6 }]}>{unit}</Text>
        <View style={styles.dialRow}>
          <View style={styles.dialCell}>
            <Text style={T.label}>Time</Text>
            <Text style={styles.mid}>{trip ? fmtDuration(now - Date.parse(trip.startedAt)) : '0:00'}</Text>
          </View>
          <View style={styles.dialCell}>
            <Text style={T.label}>Speed</Text>
            <Text style={styles.mid}>{trip?.speed !== undefined ? fmtNum((trip.speed * 3600) / per) : '—'}</Text>
            <Text style={T.small}>{unit}/h</Text>
          </View>
          <View style={styles.dialCell}>
            <Text style={T.label}>Odometer</Text>
            <Text style={styles.mid}>{v ? fmtNum(v.odometer + (trip?.meters ?? 0) / per) : '—'}</Text>
          </View>
        </View>
      </View>

      {error ? <Text style={[T.dim, { color: C.red }]}>{error}</Text> : null}
      {result ? <Text style={[T.dim, { color: C.green }]}>{result}</Text> : null}

      {trip ? (
        <Button label="Stop and add to odometer" tone="danger" onPress={stop} disabled={busy} />
      ) : (
        <Button label="Start drive" onPress={start} disabled={busy || !vehicleId} />
      )}

      <Text style={T.dim}>
        {Platform.OS === 'web'
          ? 'In the browser, recording continues only while this page stays open and the screen is on.'
          : trip?.background === false
            ? 'Background location was not allowed, so recording pauses when the app is closed or the screen locks. Allow "Always" location access for Bay One to record with the screen off.'
            : 'With "Always" location access, recording continues with the screen off. GPS distance usually reads within 1–3 % of the car odometer.'}
      </Text>

      <Panel title="Recent drives">
        {history.length === 0 ? <Empty text="No recorded drives yet." /> : null}
        {history.map((t, i) => (
          <Row key={t.id} last={i === history.length - 1}>
            <View style={{ flex: 1 }}>
              <Text style={T.strong}>
                {fmtNum(t.meters / per, 1)} {unit}
              </Text>
              <Text style={T.small}>
                {t.start.slice(0, 10)} · {fmtDuration(Date.parse(t.end) - Date.parse(t.start))}
              </Text>
            </View>
            <Text style={T.small}>{vehicles.find((x) => x.id === t.vehicleId)?.nickname || ''}</Text>
          </Row>
        ))}
      </Panel>
    </Shell>
  );
}

const styles = StyleSheet.create({
  dial: { alignItems: 'center', backgroundColor: C.surface, borderRadius: 28, borderWidth: 1, borderColor: C.border, paddingVertical: 26, gap: 4 },
  big: { color: C.text, fontFamily: F.bold, fontSize: 72, letterSpacing: -3, ...NUM },
  dialRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 18, paddingHorizontal: 10 },
  dialCell: { flex: 1, alignItems: 'center', gap: 4 },
  mid: { color: C.text, fontFamily: F.semibold, fontSize: 20, ...NUM },
});

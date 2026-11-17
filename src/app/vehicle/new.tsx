import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Shell } from '../../components/Shell';
import { Button, Input, Panel, Segmented, T } from '../../components/ui';
import { Viewer3D } from '../../components/Viewer3D';
import { vehicleDims } from '../../lib/dimensions';
import { decodeVin } from '../../lib/nhtsa';
import { useStore } from '../../lib/store';
import { C, F, PAINTS } from '../../lib/theme';
import { BODY_TYPES, BodyType, FuelType, Vehicle } from '../../lib/types';

type Draft = Omit<Vehicle, 'id' | 'createdAt' | 'odometer'> & { odometer: string };

const BLANK: Draft = {
  nickname: '', year: '', make: '', model: '', trim: '', vin: '', plate: '',
  bodyType: 'sedan', color: PAINTS[0], engine: '', fuelType: 'petrol', transmission: '',
  odometer: '', specs: {}, notes: '',
};

const FUELS: FuelType[] = ['petrol', 'diesel', 'hybrid', 'electric', 'other'];

/** Create a vehicle, or edit one when opened with ?edit=<id>. */
export default function VehicleForm() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const existing = useStore((s) => s.vehicles.find((v) => v.id === edit));
  const addVehicle = useStore((s) => s.addVehicle);
  const updateVehicle = useStore((s) => s.updateVehicle);
  const unit = useStore((s) => s.settings.distanceUnit);

  const [d, setD] = useState<Draft>(existing ? { ...existing, odometer: String(existing.odometer) } : BLANK);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const put = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const decode = async () => {
    if (d.vin.trim().length !== 17) return setMessage('A VIN has 17 characters.');
    setBusy(true);
    setMessage('');
    try {
      const found = await decodeVin(d.vin);
      put(found);
      setMessage(`Decoded: ${found.year} ${found.make} ${found.model}`);
    } catch (e) {
      setMessage(`${(e as Error).message}. Enter the details manually.`);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const odometer = Number(d.odometer.replace(',', '.') || 0);
    if (!d.make.trim() || !d.model.trim()) return setMessage('Make and model are required.');
    if (!Number.isFinite(odometer) || odometer < 0) return setMessage('Odometer must be a positive number.');
    const record = { ...d, odometer, vin: d.vin.trim().toUpperCase() };
    if (existing) {
      updateVehicle(existing.id, record);
      router.back();
    } else {
      router.replace(`/vehicle/${addVehicle(record)}`);
    }
  };

  const text = (key: keyof Draft, label: string, opts: { mono?: boolean; numeric?: boolean; placeholder?: string } = {}) => (
    <View style={styles.field}>
      <Text style={T.label}>{label}</Text>
      <Input
        accessibilityLabel={label}
        value={String(d[key])}
        onChangeText={(t) => put({ [key]: t } as Partial<Draft>)}
        placeholder={opts.placeholder}
        keyboardType={opts.numeric ? 'decimal-pad' : 'default'}
        autoCapitalize="none"
        style={opts.mono ? { fontFamily: F.medium } : undefined}
      />
    </View>
  );

  return (
    <Shell title={existing ? 'Edit vehicle' : 'New vehicle'} back>
      <Panel title="Preview" pad={false}>
        <Viewer3D dims={vehicleDims(d)} bodyType={d.bodyType} color={d.color} modelRef={d.modelRef} height={220} />
      </Panel>

      <Panel title="Identify by VIN">
        <View style={{ gap: 10 }}>
          <View style={styles.vinRow}>
            <Input
              accessibilityLabel="VIN"
              value={d.vin}
              onChangeText={(t) => put({ vin: t.toUpperCase() })}
              placeholder="17-character VIN"
              autoCapitalize="characters"
              maxLength={17}
              style={{ flex: 1, fontFamily: F.medium, letterSpacing: 1 }}
            />
            {busy ? <ActivityIndicator color={C.accent} /> : <Button label="Decode" small onPress={decode} />}
          </View>
          <Text style={T.dim}>
            Decoding sends only the VIN to the public NHTSA database (US-market vehicles). Skip it to enter details by hand.
          </Text>
          {message ? <Text style={[T.dim, { color: C.accent }]}>{message}</Text> : null}
        </View>
      </Panel>

      <Panel title="Details">
        <View style={{ gap: 12 }}>
          {text('nickname', 'Nickname', { placeholder: 'Optional' })}
          <View style={styles.pair}>
            {text('year', 'Year', { mono: true, numeric: true })}
            {text('make', 'Make')}
          </View>
          <View style={styles.pair}>
            {text('model', 'Model')}
            {text('trim', 'Trim')}
          </View>
          <View style={styles.pair}>
            {text('engine', 'Engine')}
            {text('transmission', 'Transmission')}
          </View>
          <View style={styles.pair}>
            {text('odometer', `Odometer (${unit})`, { mono: true, numeric: true })}
            {text('plate', 'Plate', { mono: true })}
          </View>
          <View style={styles.field}>
            <Text style={T.label}>Body</Text>
            <Segmented options={BODY_TYPES.map((b) => ({ value: b, label: b }))} value={d.bodyType} onChange={(b: BodyType) => put({ bodyType: b })} />
          </View>
          <View style={styles.field}>
            <Text style={T.label}>Fuel</Text>
            <Segmented options={FUELS.map((f) => ({ value: f, label: f }))} value={d.fuelType} onChange={(f) => put({ fuelType: f })} />
          </View>
          <View style={styles.field}>
            <Text style={T.label}>Paint</Text>
            <View style={styles.paints}>
              {PAINTS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => put({ color: p })}
                  accessibilityRole="button"
                  accessibilityLabel={`Paint ${p}`}
                  style={[styles.paint, { backgroundColor: p }, d.color === p && styles.paintOn]}
                />
              ))}
            </View>
          </View>
          {text('notes', 'Notes', { placeholder: 'Known issues, modifications…' })}
        </View>
      </Panel>

      <Button label={existing ? 'Save changes' : 'Park in garage'} onPress={save} />
    </Shell>
  );
}

const styles = StyleSheet.create({
  field: { gap: 5, flex: 1, minWidth: 0 },
  pair: { flexDirection: 'row', gap: 10 },
  vinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  paints: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paint: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#000' },
  paintOn: { borderColor: C.accent, borderWidth: 3 },
});

import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Shell } from '../../components/Shell';
import { FuelTab, ServiceTab } from '../../components/tabs/FuelService';
import { AssistantTab, IntelTab } from '../../components/tabs/IntelAssistant';
import { DocsTab, PartsTab } from '../../components/tabs/PartsDocs';
import { Badge, Empty, FormModal, GelButton, Lcd, Panel, Row, Segmented, T } from '../../components/ui';
import { Viewer3D } from '../../components/Viewer3D';
import { describeDue, dueInfo, fmtNum, fuelStats, sortByDue } from '../../lib/calc';
import { confirm } from '../../lib/confirm';
import { deleteFile, PickedFile, saveFile } from '../../lib/files';
import { useStore } from '../../lib/store';
import { C, F, STATE_COLOR } from '../../lib/theme';
import type { Vehicle } from '../../lib/types';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'service', label: 'Service' },
  { value: 'parts', label: 'Parts' },
  { value: 'docs', label: 'Docs' },
  { value: 'intel', label: 'Intel' },
  { value: 'ask', label: 'Mechanic' },
] as const;
type Tab = (typeof TABS)[number]['value'];

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useStore((s) => s.vehicles.find((x) => x.id === id));
  const [tab, setTab] = useState<Tab>('overview');

  if (!v) {
    return (
      <Shell title="Not found" back>
        <Panel title="Empty bay">
          <Empty text="This vehicle is no longer in the garage." />
        </Panel>
      </Shell>
    );
  }

  return (
    <Shell title={[v.year, v.make, v.model].filter(Boolean).join(' ')} back>
      <Panel title={v.nickname || `${v.make} ${v.model}`} pad={false}>
        <Viewer3D bodyType={v.bodyType} color={v.color} modelRef={v.modelRef} height={tab === 'overview' ? 250 : 150} />
      </Panel>
      <Segmented options={[...TABS]} value={tab} onChange={setTab} scroll />
      {tab === 'overview' ? <Overview v={v} onTab={setTab} /> : null}
      {tab === 'fuel' ? <FuelTab v={v} /> : null}
      {tab === 'service' ? <ServiceTab v={v} /> : null}
      {tab === 'parts' ? <PartsTab v={v} /> : null}
      {tab === 'docs' ? <DocsTab v={v} /> : null}
      {tab === 'intel' ? <IntelTab v={v} /> : null}
      {tab === 'ask' ? <AssistantTab v={v} /> : null}
    </Shell>
  );
}

function Overview({ v, onTab }: { v: Vehicle; onTab: (t: Tab) => void }) {
  const settings = useStore((s) => s.settings);
  const fuel = useStore((s) => s.fuel);
  const maintenance = useStore((s) => s.maintenance);
  const services = useStore((s) => s.services);
  const updateVehicle = useStore((s) => s.updateVehicle);
  const removeVehicle = useStore((s) => s.removeVehicle);
  const [odo, setOdo] = useState(false);
  const [message, setMessage] = useState('');
  const [showSpecs, setShowSpecs] = useState(false);

  const stats = fuelStats(fuel.filter((f) => f.vehicleId === v.id), settings);
  const serviceSpend = services.filter((r) => r.vehicleId === v.id).reduce((a, r) => a + r.cost, 0);
  const due = sortByDue(maintenance.filter((m) => m.vehicleId === v.id).map((m) => ({ m, due: dueInfo(m, v.odometer) })));
  const attention = due.filter((x) => x.due.state === 'overdue' || x.due.state === 'soon');
  const upcoming = (attention.length ? attention : due.filter((x) => x.due.state === 'ok')).slice(0, 4);
  const specs = Object.entries(v.specs);

  const uploadModel = async () => {
    setMessage('');
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled) return;
    const asset = res.assets[0] as PickedFile;
    if (!/\.(glb|gltf)$/i.test(asset.name)) return setMessage('Choose a .glb file (binary glTF).');
    try {
      const ref = await saveFile(asset);
      if (v.modelRef) await deleteFile(v.modelRef).catch(() => undefined);
      updateVehicle(v.id, { modelRef: ref });
    } catch (e) {
      setMessage(`Could not store the model: ${(e as Error).message}`);
    }
  };

  const facts: [string, string][] = [
    ['Engine', v.engine],
    ['Gearbox', v.transmission],
    ['Fuel', v.fuelType],
    ['Body', v.bodyType],
    ['VIN', v.vin],
    ['Plate', v.plate],
  ];

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Lcd flex={1.3} label="Odometer" value={fmtNum(v.odometer)} unit={settings.distanceUnit} />
        <Lcd flex={1} label="Consumption" value={stats.economy === null ? '--.-' : stats.economy.toFixed(1)} unit={stats.economyLabel} color={C.green} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Lcd flex={1} label="Fuel spend" value={fmtNum(stats.totalCost, 2)} unit={settings.currency} />
        <Lcd flex={1} label="Service spend" value={fmtNum(serviceSpend, 2)} unit={settings.currency} />
      </View>
      <GelButton label="Update odometer" tone="steel" onPress={() => setOdo(true)} />

      <Panel title={attention.length ? `Needs attention (${attention.length})` : 'Coming up'} right={<GelButton label="Schedule" small onPress={() => onTab('service')} />}>
        {upcoming.length === 0 ? <Empty text="Log when each task was last done to start the countdown." /> : null}
        {upcoming.map(({ m, due: d }, i) => (
          <Row key={m.id} last={i === upcoming.length - 1}>
            <Text style={[T.body, { flex: 1 }]} numberOfLines={1}>
              {m.name}
            </Text>
            <Text style={[T.dim, { fontFamily: F.mono, fontSize: 12 }]}>{describeDue(d, settings.distanceUnit)}</Text>
            <Badge text={d.state} color={STATE_COLOR[d.state]} />
          </Row>
        ))}
      </Panel>

      <Panel title="Vehicle data" right={<GelButton label="Edit" small onPress={() => router.push(`/vehicle/new?edit=${v.id}`)} />}>
        {facts.map(([k, val], i) => (
          <Row key={k} last={i === facts.length - 1 && !specs.length && !v.notes}>
            <Text style={[T.label, { width: 104 }]}>{k}</Text>
            <Text style={[T.body, { flex: 1, fontFamily: k === 'VIN' || k === 'Plate' ? F.mono : F.body }]} selectable>
              {val || '—'}
            </Text>
          </Row>
        ))}
        {v.notes ? <Text style={[T.dim, { marginTop: 8 }]}>{v.notes}</Text> : null}
        {specs.length ? (
          <>
            <GelButton label={showSpecs ? 'Hide decoded specs' : `Decoded specs (${specs.length})`} tone="steel" small onPress={() => setShowSpecs(!showSpecs)} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
            {showSpecs
              ? specs.map(([k, val]) => (
                  <Row key={k}>
                    <Text style={[T.dim, { flex: 1 }]}>{k}</Text>
                    <Text style={[T.body, { flex: 1, fontSize: 13 }]}>{val}</Text>
                  </Row>
                ))
              : null}
          </>
        ) : null}
      </Panel>

      <Panel title="3D model">
        <Text style={T.dim}>
          {v.modelRef
            ? 'Showing your uploaded model.'
            : `Showing the built-in ${v.bodyType} body. Upload a .glb scan or model of this exact vehicle to replace it.`}
        </Text>
        {message ? <Text style={[T.dim, { color: C.red, marginTop: 6 }]}>{message}</Text> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <GelButton label="Upload .glb" small onPress={uploadModel} />
          {v.modelRef ? (
            <GelButton
              label="Use built-in"
              tone="steel"
              small
              onPress={() => {
                deleteFile(v.modelRef!).catch(() => undefined);
                updateVehicle(v.id, { modelRef: undefined });
              }}
            />
          ) : null}
        </View>
      </Panel>

      <GelButton
        label="Remove vehicle"
        tone="red"
        onPress={() =>
          confirm('Remove vehicle', `${v.nickname || v.model} and all of its logs, parts and documents will be deleted from this device.`, () => {
            const s = useStore.getState();
            s.docs.filter((d) => d.vehicleId === v.id).forEach((d) => deleteFile(d.fileRef).catch(() => undefined));
            if (v.modelRef) deleteFile(v.modelRef).catch(() => undefined);
            removeVehicle(v.id);
            router.replace('/');
          })
        }
      />

      <FormModal
        visible={odo}
        title="Odometer"
        fields={[{ key: 'odometer', label: `Current reading (${settings.distanceUnit})`, kind: 'number', required: true }]}
        initial={{ odometer: v.odometer }}
        onClose={() => setOdo(false)}
        onSave={(x) => {
          updateVehicle(v.id, { odometer: x.odometer as number });
          setOdo(false);
        }}
      />
    </>
  );
}
